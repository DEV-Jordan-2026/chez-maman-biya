// app/api/restaurants/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.role !== 'super_admin')
    return NextResponse.json({ error: 'Réservé au propriétaire' }, { status: 403 })

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { users: true, commandes: true } },
    },
  })
  return NextResponse.json(restaurants)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session || session.role !== 'super_admin')
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { nom, ville, quartier, adresse, tel, couleur } = body

  if (!nom?.trim() || !ville?.trim() || !quartier?.trim())
    return NextResponse.json({ error: 'Nom, ville et quartier sont requis' }, { status: 400 })

  const restaurant = await prisma.restaurant.create({
    data: { nom: nom.trim(), ville: ville.trim(), quartier: quartier.trim(),
            adresse: adresse?.trim() || null, tel: tel?.trim() || null,
            couleur: couleur || null },
  })

  await prisma.journalActivite.create({
    data: { auteur: session.name, action: `Restaurant "${nom}" créé`, type: 'restaurants', ref: restaurant.id },
  })

  return NextResponse.json(restaurant, { status: 201 })
}
