// app/api/rh/primes/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const userId = searchParams.get('userId')

  const primes = await prisma.primePerformance.findMany({
    where: {
      ...(restaurantId && { restaurantId }),
      ...(userId && { userId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(primes)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['manager','super_admin'].includes(session.role))
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 })

  const body = await req.json()
  const { restaurantId, userId, userName, montant, motif, periode } = body

  if (!userId || !montant || !motif?.trim() || !periode?.trim())
    return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })

  const restoId = restaurantId || session.restaurantId
  if (!restoId) return NextResponse.json({ error: 'Restaurant non défini' }, { status: 400 })

  const prime = await prisma.primePerformance.create({
    data: {
      restaurantId: restoId,
      userId, userName,
      montant:  parseInt(montant),
      motif:    motif.trim(),
      periode:  periode.trim(),
      accordePar: session.name,
    },
  })

  await prisma.journalActivite.create({
    data: {
      auteur: session.name,
      action: `Prime de ${montant.toLocaleString()} FCFA attribuée à ${userName} — "${motif}"`,
      type: 'equipe', ref: userId,
    },
  })

  return NextResponse.json(prime, { status: 201 })
}
