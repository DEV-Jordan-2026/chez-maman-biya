// app/api/commandes/[id]/encaisser/route.js
// POST : marque une commande comme encaissée (statut → "livre")
// Supporte le paiement simple (string) et le paiement mixte (array [{mode, label, montant}])
// Accès : caissier, staff, manager, super_admin

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE, getInternalKey } from '@/lib/auth'
import { cookies } from 'next/headers'
import { publish } from '@/lib/eventBus'
import { signerFacture, urlQR } from '@/lib/factureQR'

const MODES_VALIDES  = ['especes', 'mtn', 'orange', 'cinetpay', 'resto', 'livraison']
const ROLES_CAISSIER = ['super_admin', 'manager', 'staff', 'caissier']

export async function POST(request, context) {
  // Auth
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || !ROLES_CAISSIER.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id }      = await context.params
    const body        = await request.json()
    const { paiement } = body

    // ── Validation du paiement ────────────────────────────────────────────
    const estMixte = Array.isArray(paiement)

    if (estMixte) {
      if (paiement.length < 2) {
        return NextResponse.json({ error: 'Le paiement mixte requiert au moins 2 modes.' }, { status: 400 })
      }
      for (const p of paiement) {
        if (!MODES_VALIDES.includes(p.mode)) {
          return NextResponse.json({ error: `Mode invalide : ${p.mode}` }, { status: 400 })
        }
        if (!p.montant || parseInt(p.montant) <= 0) {
          return NextResponse.json({ error: `Montant invalide pour ${p.mode}` }, { status: 400 })
        }
      }
    } else {
      if (!paiement || !MODES_VALIDES.includes(paiement)) {
        return NextResponse.json(
          { error: `Mode de paiement invalide. Valeurs acceptées : ${MODES_VALIDES.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // ── Vérifier la commande ──────────────────────────────────────────────
    const existing = await prisma.commande.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    if (session.restaurantId && existing.restaurantId &&
        existing.restaurantId !== session.restaurantId) {
      return NextResponse.json(
        { error: 'Commande hors de votre restaurant' },
        { status: 403 }
      )
    }
    if (existing.status === 'livre') {
      return NextResponse.json({ error: 'Commande déjà encaissée' }, { status: 409 })
    }
    if (!['pret', 'nouveau', 'en_cours'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Impossible d'encaisser une commande au statut "${existing.status}"` },
        { status: 422 }
      )
    }

    // ── Vérifier que le total mixte correspond au total commande ──────────
    if (estMixte) {
      const totalVerse = paiement.reduce((s, p) => s + parseInt(p.montant), 0)
      if (Math.abs(totalVerse - existing.total) > 1) {
        return NextResponse.json({
          error: `Total versé (${totalVerse} FCFA) ≠ total commande (${existing.total} FCFA)`,
        }, { status: 422 })
      }
    }

    // ── Déterminer la valeur stockée en base ──────────────────────────────
    let paiementFinal
    if (estMixte) {
      paiementFinal = JSON.stringify(paiement)
    } else {
      paiementFinal = paiement === 'mtn'    ? 'mtn_paye'
                    : paiement === 'orange' ? 'orange_paye'
                    : paiement
    }

    // ── FIX C1 — Numéro de facture atomique ───────────────────────────────
    // Stratégie : transaction interactive Prisma 5+
    //   1. Incrémenter la séquence et récupérer la valeur réelle retournée
    //   2. Calculer le numeroFacture depuis cette valeur (pas depuis une lecture préalable)
    //   3. Calculer la signature HMAC (Web Crypto, hors transaction car async)
    //   4. Mettre à jour la commande avec le numéro et la signature
    //
    // Ce pattern élimine la race condition : deux encaissements simultanés
    // obtiennent deux valeurs différentes depuis l'upsert atomique PostgreSQL.

    const annee      = new Date().getFullYear()
    const ridFacture = existing.restaurantId || 'default'

    // Étape 1 : incrémenter atomiquement et obtenir le numéro réel
    const seq = await prisma.factureSequence.upsert({
      where:  { restaurantId_type: { restaurantId: ridFacture, type: 'facture' } },
      update: { derniereValeur: { increment: 1 } },
      create: { restaurantId: ridFacture, type: 'facture', derniereValeur: 1 },
    })

    // Étape 2 : construire le numéro depuis la valeur RETOURNÉE (après increment)
    const numeroFacture = `FAC-${annee}-${String(seq.derniereValeur).padStart(6, '0')}`

    // Étape 3 : signature HMAC (Web Crypto — async, hors transaction)
    const qrHash = await signerFacture({
      id,
      numeroFacture,
      total:        existing.total,
      restaurantId: existing.restaurantId,
      createdAt:    existing.createdAt,
    })
    const qrUrl = urlQR(id, qrHash)

    // Étape 4 : stocker le résultat (le numéro est déjà réservé en séquence)
    const commande = await prisma.commande.update({
      where: { id },
      data:  {
        status:        'livre',
        paiement:      paiementFinal,
        numeroFacture,
        qrHash,
        updatedAt:     new Date(),
      },
    })

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: commande.restaurantId,
      auteur: session.name || session.login,
      action: `Encaissement commande ${id} — ${existing.total} FCFA (${paiementFinal})`,
      type: 'caisse', ref: id,
    }}).catch(err => console.error('[journal]', err.message))

    // SSE temps réel
    publish({
      type: 'commande_status',
      data: { id, status: 'livre', paiement: paiementFinal, updatedAt: commande.updatedAt },
    }, commande.restaurantId || null)

    // Notification WhatsApp (non bloquant)
    try {
      const _wac=new AbortController(),_wat=setTimeout(()=>_wac.abort(),5000)
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      await fetch(`${baseUrl}/api/whatsapp`, {
        method:  'POST',
        signal:  _wac.signal,
        headers: {
          'Content-Type':   'application/json',
          'x-internal-key': getInternalKey(),
        },
        body: JSON.stringify({
          type: 'statut_commande',
          data: { ...commande, nouveauStatut: 'livre' },
        }),
      })
    } catch (waErr) {
      console.warn('[WhatsApp] Notification encaissement échouée (non bloquant):', waErr.message)
    }

    return NextResponse.json({
      id,
      status:        'livre',
      paiement:      paiementFinal,
      numeroFacture,
      qrUrl,
      updatedAt:     commande.updatedAt,
    })
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }
    console.error('[POST /api/commandes/[id]/encaisser]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
