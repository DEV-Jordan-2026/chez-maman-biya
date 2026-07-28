// app/api/commandes/[id]/annuler/route.js
// Annulation commande — accessible client (par tel) ou staff
// Si paiement cinetpay_confirme → tente remboursement CinetPay

import { NextResponse }       from 'next/server'
import prisma                  from '@/lib/db'
import { rembourserPaiement }  from '@/lib/cinetpay'
import { verifyToken, SESSION_COOKIE, getInternalKey } from '@/lib/auth'
import { cookies }             from 'next/headers'

const DELAI_ANNULATION_MIN = 10
const STATUTS_ANNULABLES   = ['nouveau', 'en_cours']
const PAIEMENTS_REMBOURS   = ['cinetpay_confirme', 'cinetpay']

export async function POST(request, context) {
  try {
    const { id } = await context.params
    const body   = await request.json()
    const { tel, motif } = body

    const cookieStore = await cookies()
    const token   = cookieStore.get(SESSION_COOKIE)?.value
    const session = await verifyToken(token)
    const isStaff = session && ['super_admin', 'manager', 'staff', 'caissier'].includes(session.role)

    const commande = await prisma.commande.findUnique({ where: { id } })
    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // Vérification d'ownership multi-tenant (pour le staff connecté)
    if (isStaff && session.role !== 'super_admin' && commande.restaurantId && commande.restaurantId !== session.restaurantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Vérification identité client (si pas staff)
    if (!isStaff) {
      if (!tel) {
        return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })
      }
      const telNorm = tel.replace(/[\s\-+]/g, '')
      const cmdTel  = commande.tel.replace(/[\s\-+]/g, '')
      if (telNorm !== cmdTel) {
        return NextResponse.json({ error: 'Numéro de téléphone incorrect' }, { status: 403 })
      }
    }

    if (commande.status === 'annule') {
      return NextResponse.json({ error: 'Commande déjà annulée' }, { status: 409 })
    }
    if (commande.status === 'livre') {
      return NextResponse.json({ error: 'Commande déjà livrée — annulation impossible' }, { status: 422 })
    }

    if (!isStaff) {
      const minutesEcoulees = (Date.now() - new Date(commande.createdAt).getTime()) / 60_000
      if (minutesEcoulees > DELAI_ANNULATION_MIN) {
        return NextResponse.json({
          error: `Annulation impossible — délai de ${DELAI_ANNULATION_MIN} minutes dépassé. Contactez le restaurant au +237 677 000 000.`,
          delaiDepasse: true,
          minutesEcoulees: Math.round(minutesEcoulees),
        }, { status: 422 })
      }
      if (!STATUTS_ANNULABLES.includes(commande.status)) {
        return NextResponse.json({
          error: `Votre commande est déjà en préparation — annulation impossible en ligne. Appelez le +237 677 000 000.`,
          enPreparation: true,
        }, { status: 422 })
      }
    }

    let rembStatut = null
    let rembMontant = null
    let rembAt = null
    let messageRemb = ''

    if (PAIEMENTS_REMBOURS.includes(commande.paiement) && commande.transactionId) {
      try {
        const resultat = await rembourserPaiement(commande.transactionId, commande.total)
        if (resultat.ok) {
          rembStatut  = 'rembourse'
          rembMontant = commande.total
          rembAt      = new Date()
          messageRemb = `Remboursement de ${commande.total.toLocaleString('fr-FR')} FCFA initié. Vous recevrez les fonds sur votre Mobile Money sous 24-72h.`
        } else {
          rembStatut  = 'echec'
          rembMontant = commande.total
          messageRemb = `Remboursement automatique échoué. Le restaurant vous contactera pour procéder manuellement.`
          console.warn(`[Annulation] Remboursement échoué pour ${id}:`, resultat.message)
        }
      } catch (rembErr) {
        rembStatut  = 'echec'
        rembMontant = commande.total
        messageRemb = `Le restaurant vous contactera pour le remboursement de ${commande.total.toLocaleString('fr-FR')} FCFA.`
        console.warn(`[Annulation] Erreur remboursement CinetPay pour ${id}:`, rembErr.message)
      }
    } else if (['especes', 'livraison'].includes(commande.paiement)) {
      messageRemb = "Aucun paiement n'avait été effectué — aucun remboursement nécessaire."
    } else if (commande.paiement === 'resto') {
      messageRemb = 'Aucun paiement effectué en ligne — aucun remboursement nécessaire.'
    }

    const commandeAnnulee = await prisma.commande.update({
      where: { id },
      data:  { status: 'annule', rembStatut, rembMontant, rembAt, updatedAt: new Date() },
    })

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
          type: 'commande_annulee',
          data: { ...commandeAnnulee, messageRemb, annulePar: isStaff ? session.name : 'client' },
        }),
      })
    } catch {}

    if (isStaff && rembStatut === 'echec') {
      console.warn(`[Annulation] Remboursement manuel requis pour ${id} — ${commande.total} FCFA — ${commande.tel}`)
    }

    return NextResponse.json({
      ok: true,
      commandeId: id,
      rembStatut,
      rembMontant,
      messageRemb,
      annulePar: isStaff ? 'staff' : 'client',
    })

  } catch (err) {
    console.error('[POST /api/commandes/[id]/annuler]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
