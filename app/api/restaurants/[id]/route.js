// app/api/restaurants/[id]/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req, { params }) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { _count: { select: { users: true, commandes: true, stockItems: true } } },
  })
  if (!restaurant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(restaurant)
}

export async function PATCH(req, { params }) {
  const session = await requireAuth(await cookies())
  if (!session || session.role !== 'super_admin')
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { nom, ville, quartier, adresse, tel, couleur, actif, ouvert } = body
  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      ...(nom      !== undefined && { nom:      nom.trim() }),
      ...(ville    !== undefined && { ville:    ville.trim() }),
      ...(quartier !== undefined && { quartier: quartier.trim() }),
      ...(adresse  !== undefined && { adresse:  adresse?.trim() || null }),
      ...(tel      !== undefined && { tel:      tel?.trim() || null }),
      ...(couleur  !== undefined && { couleur }),
      ...(actif    !== undefined && { actif }),
      ...(ouvert   !== undefined && { ouvert }),
    },
  })
  await prisma.journalActivite.create({
    data: { auteur: session.name, action: `Restaurant "${updated.nom}" modifié`, type: 'restaurants', ref: id },
  })
  return NextResponse.json(updated)
}
