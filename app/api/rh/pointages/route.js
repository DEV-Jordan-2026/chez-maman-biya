// app/api/rh/pointages/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['manager','super_admin'].includes(session.role))
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const userId = searchParams.get('userId')
  const mois   = searchParams.get('mois') // ex: "2026-05"

  const where = {
    ...(restaurantId && { restaurantId }),
    ...(userId && { userId }),
  }

  if (mois) {
    // Filtrage par mois : calculer les bornes proprement
    const [y, m] = mois.split('-').map(Number)
    const debut = new Date(y, m - 1, 1)
    const fin   = new Date(y, m, 1)
    where.heure = { gte: debut, lt: fin }
  }

  const pointages = await prisma.pointage.findMany({
    where, orderBy: { heure: 'desc' }, take: 200,
  })
  return NextResponse.json(pointages)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { restaurantId, userId, userName, type, heure, noteManager } = body

  if (!type || !['arrivee','depart','pause_debut','pause_fin'].includes(type))
    return NextResponse.json({ error: 'Type de pointage invalide' }, { status: 400 })

  const restoId = restaurantId || session.restaurantId
  if (!restoId) return NextResponse.json({ error: 'Restaurant non défini' }, { status: 400 })

  const pointage = await prisma.pointage.create({
    data: {
      restaurantId: restoId,
      userId:       userId || session.userId || session.login,
      userName:     userName || session.name,
      type,
      heure:        heure ? new Date(heure) : new Date(),
      noteManager:  noteManager?.trim() || null,
    },
  })
  return NextResponse.json(pointage, { status: 201 })
}
