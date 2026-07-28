import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { validateStatutReservation, sanitize } from '@/lib/validate'
import { requireAdmin, getInternalKey } from '@/lib/auth'
import { notifyWA } from '@/lib/notifyWA'
import { cookies } from 'next/headers'
import { publish } from '@/lib/eventBus'

const NOTIFIER_CLIENT = ['confirmee', 'annulee']

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) {
    return NextResponse.json({ error: 'Accès refusé — admin ou manager requis' }, { status: 403 })
  }

  try {
    const { id }            = await context.params
    const { status, notes } = await request.json()

    if (status && !validateStatutReservation(status)) {
      return NextResponse.json({ error: 'Statut de commande invalide' }, { status: 400 })
    }

    const data = {}
    if (status !== undefined) data.status = status
    if (notes  !== undefined) data.notes  = sanitize(notes, 500)

    const reservation = await prisma.reservation.update({ where: { id }, data })

    // SSE temps réel
    publish({ type: 'reservation_status', data: { id, status: reservation.status } }, reservation.restaurantId || null)

    // WhatsApp client sur confirmation / annulation
    if (status && NOTIFIER_CLIENT.includes(status) && reservation.tel) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const _wac=new AbortController(),_wat=setTimeout(()=>_wac.abort(),5000)
      await fetch(`${baseUrl}/api/whatsapp`, {
          method:  'POST',
          signal:  _wac.signal,
          headers: {
            'Content-Type':   'application/json',
            'x-internal-key': getInternalKey(),
          },
          body:    JSON.stringify({
            type: status === 'confirmee' ? 'reservation_confirmee' : 'reservation_annulee',
            data: reservation,
          }),
        })
      } catch {}
    }

    return NextResponse.json(reservation)
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }
    console.error('[PATCH /api/reservations/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
