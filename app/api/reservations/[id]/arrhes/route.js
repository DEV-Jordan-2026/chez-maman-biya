// app/api/reservations/[id]/arrhes/route.js
// POST { action: 'initier' }  → initie le paiement CinetPay des arrhes
// POST { action: 'annuler', tel } → annule la réservation avec règles de remboursement

import { NextResponse }       from 'next/server'
import prisma                  from '@/lib/db'
import { initierPaiement, rembourserPaiement } from '@/lib/cinetpay'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies }             from 'next/headers'

function calculerArrhes(reservation) {
  if (reservation.zone === 'vip' && reservation.personnes >= 5) return 5000
  if (reservation.personnes >= 8) return 10000
  if (reservation.zone === 'vip') return 5000
  return 0
}

export async function POST(request, context) {
  try {
    const { id } = await context.params
    const body   = await request.json()
    const { action, tel } = body

    const reservation = await prisma.reservation.findUnique({ where: { id } })
    if (!reservation) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

    // Vérification d'ownership multi-tenant
    const cookieStore = await cookies()
    const token   = cookieStore.get(SESSION_COOKIE)?.value
    const session = await verifyToken(token)
    const isStaff = session && ['super_admin', 'manager', 'staff', 'caissier', 'serveur'].includes(session.role)

    if (isStaff && session.role !== 'super_admin' && reservation.restaurantId && reservation.restaurantId !== session.restaurantId) {
      return NextResponse.json({ error: 'Accès refusé — réservation appartenant à un autre restaurant' }, { status: 403 })
    }

    // ── Action : initier paiement arrhes ─────────────────────────────────────
    if (action === 'initier') {
      const montant = calculerArrhes(reservation)
      if (montant === 0) {
        return NextResponse.json({ gratuit: true, message: 'Aucune arrhes requise pour cette réservation' })
      }
      if (reservation.arrhesPaie) {
        return NextResponse.json({ error: 'Arrhes déjà payées' }, { status: 409 })
      }

      try {
        const result = await initierPaiement({
          commandeId:  `RES-${id}`,
          montant,
          description: `Arrhes réservation ${reservation.date} ${reservation.heure} — ${reservation.personnes} pers.`,
          nomClient:   reservation.nom,
          telClient:   reservation.tel,
        })

        await prisma.reservation.update({
          where: { id },
          data:  { arrhes: montant },
        })

        return NextResponse.json({ paymentUrl: result.paymentUrl, montant })
      } catch (err) {
        console.warn('[arrhes] Erreur initiation CinetPay:', err.message)
        return NextResponse.json({ demo: true, montant, message: 'Mode démo — arrhes simulées' })
      }
    }

    // ── Action : annuler la réservation ──────────────────────────────────────
    if (action === 'annuler') {
      if (!isStaff) {
        if (!tel) return NextResponse.json({ error: 'Numéro de téléphone requis' }, { status: 400 })
        const telNorm = tel.replace(/[\s\-+]/g, '')
        const resTel  = reservation.tel.replace(/[\s\-+]/g, '')
        if (telNorm !== resTel) return NextResponse.json({ error: 'Numéro incorrect' }, { status: 403 })
      }

      if (['annulee', 'arrivee'].includes(reservation.status)) {
        return NextResponse.json({ error: 'Réservation déjà annulée ou terminée' }, { status: 409 })
      }

      const dateRes     = new Date(`${reservation.date}T${reservation.heure}:00`)
      const heuresAvant = (dateRes.getTime() - Date.now()) / 3_600_000
      const montantArrhes = reservation.arrhes || 0
      let rembStatut    = null
      let messageRemb   = ''

      if (reservation.arrhesPaie && montantArrhes > 0 && reservation.arrhesTransId) {
        if (heuresAvant >= 24) {
          try {
            const res = await rembourserPaiement(reservation.arrhesTransId, montantArrhes)
            rembStatut  = res.ok ? 'rembourse' : 'echec'
            messageRemb = res.ok
              ? `Remboursement de ${montantArrhes.toLocaleString('fr-FR')} FCFA initié — délai 24-72h.`
              : `Remboursement échoué. Le restaurant vous contactera.`
          } catch {
            rembStatut  = 'echec'
            messageRemb = `Le restaurant vous contactera pour le remboursement de ${montantArrhes.toLocaleString('fr-FR')} FCFA.`
          }
        } else {
          rembStatut  = 'forfait'
          messageRemb = `Annulation dans les 24h précédant la réservation — les arrhes de ${montantArrhes.toLocaleString('fr-FR')} FCFA sont retenues selon nos conditions.`
        }
      } else if (montantArrhes === 0 || !reservation.arrhesPaie) {
        messageRemb = 'Aucune arrhes à rembourser.'
      }

      await prisma.reservation.update({
        where: { id },
        data:  { status: 'annulee', arrhesRembStatut: rembStatut },
      })

      return NextResponse.json({
        ok: true,
        rembStatut,
        messageRemb,
        montantArrhes,
        heuresAvant: Math.round(heuresAvant),
      })
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })

  } catch (err) {
    console.error('[POST /api/reservations/[id]/arrhes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
