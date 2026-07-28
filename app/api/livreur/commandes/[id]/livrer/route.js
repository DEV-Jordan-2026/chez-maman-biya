import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireLivreur, getInternalKey } from '@/lib/auth'
import { signerFacture, urlQR } from '@/lib/factureQR'
import { cookies } from 'next/headers'
import { publish } from '@/lib/eventBus'

const METHODES_VALIDES = ['especes', 'mtn_momo', 'orange_money', 'deja_paye']

// v26 — Le livreur marque une commande comme livrée et confirme le moyen
// d'encaissement (espèces / MTN MoMo / Orange Money / déjà payé en ligne).
//
// Correctifs v28 :
//   B1 — Guard statut : rejette si commande déjà livrée ou non en cours de livraison
//   B2 — 'deja_paye' → encaisseMontant = 0 (paiement déjà fait en ligne)
//   B3 — Génère numeroFacture + qrHash (parité avec /api/commandes/[id]/encaisser)
//   B7 — Écrit une entrée JournalActivite pour la traçabilité caisse
export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireLivreur(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await context.params
    const { encaisseMethode, encaisseMontant } = await request.json()

    if (!METHODES_VALIDES.includes(encaisseMethode)) {
      return NextResponse.json({ error: 'Moyen d\'encaissement invalide' }, { status: 400 })
    }

    const existing = await prisma.commande.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    if (existing.livreurId !== session.livreurId) {
      return NextResponse.json({ error: 'Cette commande ne vous est pas assignée' }, { status: 403 })
    }

    // B1 — Guard statut : évite la double-livraison et les états incohérents
    if (existing.status === 'livre') {
      return NextResponse.json({ error: 'Commande déjà marquée comme livrée' }, { status: 409 })
    }
    if (existing.status === 'annule') {
      return NextResponse.json({ error: 'Impossible de livrer une commande annulée' }, { status: 422 })
    }

    // B2 — 'deja_paye' : le client a payé en ligne, le livreur n'encaisse rien
    const montantAttendu = encaisseMethode === 'deja_paye'
      ? 0
      : (existing.acompte > 0 && existing.acompteStatut === 'paye')
          ? existing.resteARegler
          : existing.total
    const montant = (encaisseMethode === 'deja_paye')
      ? 0
      : (Number.isFinite(encaisseMontant) ? encaisseMontant : montantAttendu)

    // B3 — Générer numéro de facture + signature QR (parité avec encaisser route)
    const annee      = new Date().getFullYear()
    const ridFacture = existing.restaurantId || 'default'

    const seq = await prisma.factureSequence.upsert({
      where:  { restaurantId_type: { restaurantId: ridFacture, type: 'facture' } },
      update: { derniereValeur: { increment: 1 } },
      create: { restaurantId: ridFacture, type: 'facture', derniereValeur: 1 },
    })
    const numeroFacture = `FAC-${annee}-${String(seq.derniereValeur).padStart(6, '0')}`

    const qrHash = await signerFacture({
      id,
      numeroFacture,
      total:        existing.total,
      restaurantId: existing.restaurantId,
      createdAt:    existing.createdAt,
    })
    const qrUrl = urlQR(id, qrHash)

    const commande = await prisma.$transaction(async (tx) => {
      const updated = await tx.commande.update({
        where: { id },
        data: {
          status:          'livre',
          encaisseMethode,
          encaisseMontant: montant,
          encaisseAt:      new Date(),
          numeroFacture,
          qrHash,
        },
      })
      // Le livreur redevient disponible
      await tx.livreur.update({
        where: { id: session.livreurId },
        data:  { status: 'disponible' },
      })
      return updated
    })

    // B7 — Journal activité (traçabilité caisse, non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: commande.restaurantId,
      auteur:       session.nom || `Livreur #${session.livreurId}`,
      action:       `Livraison confirmée ${id} — ${montant.toLocaleString('fr-FR')} FCFA (${encaisseMethode})`,
      type:         'livreur',
      ref:          id,
    }}).catch(err => console.error('[livrer journal]', err.message))

    publish({ type: 'commande_status', data: { id, status: 'livre', updatedAt: commande.updatedAt } }, commande.restaurantId || null)

    // Notification WhatsApp au client (livraison effectuée)
    if (commande.tel) {
      try {
        const _wac = new AbortController(), _wat = setTimeout(() => _wac.abort(), 5000)
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        await fetch(`${baseUrl}/api/whatsapp`, {
          method: 'POST',
          signal: _wac.signal,
          headers: { 'Content-Type': 'application/json', 'x-internal-key': getInternalKey() },
          body: JSON.stringify({ type: 'statut_commande', data: { ...commande, nouveauStatut: 'livre' } }),
        })
        clearTimeout(_wat)
      } catch {}
    }

    return NextResponse.json({ ok: true, id, status: 'livre', encaisseMethode, encaisseMontant: montant, numeroFacture, qrUrl })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    console.error('[livreur/commandes/[id]/livrer]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
