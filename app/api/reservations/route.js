import { NextResponse } from 'next/server'
import { notifyWA } from '@/lib/notifyWA'
import { cookies }      from 'next/headers'
import { requireAuth, getInternalKey }  from '@/lib/auth'
import prisma from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validatePhone, validateDate, validateTime, sanitize } from '@/lib/validate'
import { randomBytes } from 'crypto'
import { publish } from '@/lib/eventBus'

function generateResaId() {
  return 'CMB-' + randomBytes(4).toString('hex').toUpperCase()
}

export async function GET(request) {
  // 🔒 Protégé — admin/staff uniquement
  try {
    const cookieStore = await cookies()
    const session     = await requireAuth(cookieStore)
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    const where = {}

    if (session.role === 'super_admin') {
      const rid = searchParams.get('restaurantId')
      if (rid) where.restaurantId = rid
    } else if (session.restaurantId) {
      where.restaurantId = session.restaurantId
    }

    if (date) where.date = date

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: [{ date: 'asc' }, { heure: 'asc' }],
      take: 500,  // Filtre ?date= recommandé pour les historiques longs
    })

    return NextResponse.json(reservations)
  } catch (err) {
    console.error('[GET /api/reservations]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  // Déterminer si l'appel vient du staff connecté (manager, serveur, super_admin)
  // → bypass rate limit + restaurantId forcé depuis la session
  const cookieStore  = await cookies()
  const session      = await requireAuth(cookieStore)
  const ROLES_STAFF  = ['super_admin', 'manager', 'serveur']
  const isStaff      = session && ROLES_STAFF.includes(session.role)

  // Rate limiting : 5 réservations / 10 min par IP — clients publics uniquement
  if (!isStaff) {
    const ip = getClientIp(request)
    const rl = await rateLimit(`reservations:${ip}`, { limit: 5, windowMs: 10 * 60_000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      )
    }
  }

  try {
    const body = await request.json()
    const { nom, tel, date, heure, personnes, zone, notes, note, restaurantId: bodyRestaurantId } = body
    const noteFinale = notes || note || null
    // Staff : restaurantId forcé depuis la session pour éviter restaurantId: null
    const restaurantId = isStaff
      ? (session.restaurantId || bodyRestaurantId || null)
      : (bodyRestaurantId || null)

    // Validation
    if (!nom || !tel || !date || !heure) {
      return NextResponse.json({ error: 'Champs obligatoires : nom, téléphone, date et heure' }, { status: 400 })
    }
    if (!validatePhone(tel)) {
      return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 })
    }
    if (!validateDate(date)) {
      return NextResponse.json({ error: 'Date invalide (format YYYY-MM-DD)' }, { status: 400 })
    }
    if (!validateTime(heure)) {
      return NextResponse.json({ error: 'Heure invalide (format HH:MM)' }, { status: 400 })
    }

    const nbPersonnes = Number(personnes)
    if (!Number.isInteger(nbPersonnes) || nbPersonnes < 1 || nbPersonnes > 50) {
      return NextResponse.json({ error: 'Nombre de personnes invalide (1-50)' }, { status: 400 })
    }

    const reservation = await prisma.reservation.create({
      data: {
        id:           generateResaId(),
        restaurantId: restaurantId,
        nom:          sanitize(nom, 100),
        tel:          sanitize(tel, 20),
        date,
        heure,
        personnes:    nbPersonnes,
        zone:         zone        ? sanitize(zone, 100)        : null,
        notes:        noteFinale  ? sanitize(noteFinale, 500)  : null,
        status:       'en_attente',
      },
    })

    // SSE temps réel
    publish({ type: 'reservation_nouvelle', data: reservation }, reservation.restaurantId || null)

    // Notification WhatsApp (non bloquant)
    try {
      await notifyWA('nouvelle_reservation', reservation)
    } catch (waErr) {
      console.warn('[WhatsApp] Notification échouée (non bloquant):', waErr.message)
    }

    return NextResponse.json(reservation, { status: 201 })
  } catch (err) {
    console.error('[POST /api/reservations]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
