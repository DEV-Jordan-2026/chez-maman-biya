// app/api/paiement/initier/route.js
// Initier un paiement CinetPay pour une commande
// POST { commandeId, tel, type? } → { paymentUrl, transactionId }
//
// type = 'complet'  (défaut) → paiement total CinetPay  — transactionId: CMB-CMD-XXXX-HHHH
// type = 'acompte'           → dépôt 30% livraison      — transactionId: CMB-ACP-CMD-XXXX-HHHH
//
// Sécurité : route publique — ownership vérifié via numéro de téléphone si fourni.

import { NextResponse }    from 'next/server'
import prisma              from '@/lib/db'
import { initierPaiement } from '@/lib/cinetpay'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitize } from '@/lib/validate'

export async function POST(request) {
  // Rate limiting : 5 tentatives / 5 min par IP
  const ip = getClientIp(request)
  const rl = await rateLimit(`paiement:${ip}`, { limit: 5, windowMs: 5 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 }
    )
  }

  try {
    const { commandeId, tel, type = 'complet' } = await request.json()

    if (!commandeId) {
      return NextResponse.json({ error: 'commandeId requis' }, { status: 400 })
    }

    const commande = await prisma.commande.findUnique({ where: { id: commandeId } })

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // Vérification de propriété : tel fourni doit correspondre
    if (tel) {
      const telNorm    = sanitize(tel, 20).replace(/[\s\-().]/g, '')
      const cmdTelNorm = (commande.tel || '').replace(/[\s\-().]/g, '')
      if (telNorm !== cmdTelNorm) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }

    if (commande.status === 'livre') {
      return NextResponse.json({ error: 'Commande déjà livrée' }, { status: 409 })
    }

    // ── Branche ACOMPTE ───────────────────────────────────────────────────────
    if (type === 'acompte') {
      if (commande.acompteStatut === 'paye') {
        return NextResponse.json({ error: 'Acompte déjà confirmé' }, { status: 409 })
      }
      if (commande.acompteStatut !== 'requis') {
        return NextResponse.json({ error: 'Acompte non requis pour cette commande' }, { status: 400 })
      }
      if (!commande.acompte || commande.acompte <= 0) {
        return NextResponse.json({ error: 'Montant acompte invalide' }, { status: 400 })
      }

      const paiement = await initierPaiement({
        commandeId:  commande.id,
        montant:     commande.acompte,
        description: `Acompte ${commande.id} — ${commande.acompte.toLocaleString('fr-FR')} XAF`,
        nomClient:   commande.client,
        telClient:   commande.tel,
        typePrefix:  'ACP-',           // → CMB-ACP-CMD-XXXX-HHHH dans le webhook
      })

      // Stocker l'acompteTransId provisoire pour l'idempotence
      await prisma.commande.update({
        where: { id: commandeId },
        data:  { acompteTransId: paiement.transactionId },
      })

      return NextResponse.json({
        paymentUrl:    paiement.paymentUrl,
        transactionId: paiement.transactionId,
        montant:       commande.acompte,
        type:          'acompte',
      })
    }

    // ── Branche PAIEMENT COMPLET (défaut) ─────────────────────────────────────
    if (commande.paiement === 'cinetpay_confirme') {
      return NextResponse.json({ error: 'Paiement déjà confirmé' }, { status: 409 })
    }

    // C10 — Bloquer la création d'un nouveau lien si déjà en cours
    if (commande.paiement === 'cinetpay_pending' && commande.transactionId) {
      return NextResponse.json(
        { error: 'Un paiement est déjà en cours pour cette commande.' },
        { status: 409 }
      )
    }

    const paiement = await initierPaiement({
      commandeId: commande.id,
      montant:    commande.total,
      description:`Commande ${commande.id} — Chez Maman Biya`,
      nomClient:  commande.client,
      telClient:  commande.tel,
    })

    await prisma.commande.update({
      where: { id: commandeId },
      data:  {
        paiement:      'cinetpay_pending',
        transactionId: paiement.transactionId,
      },
    })

    return NextResponse.json({
      paymentUrl:    paiement.paymentUrl,
      transactionId: paiement.transactionId,
      type:          'complet',
    })
  } catch (err) {
    console.error('[POST /api/paiement/initier]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
