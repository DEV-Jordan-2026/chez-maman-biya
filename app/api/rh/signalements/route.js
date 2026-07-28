import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session || session.role !== 'super_admin')
    return NextResponse.json({ error: 'Réservé au propriétaire' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const signalements = await prisma.signalement.findMany({
    where: { ...(restaurantId && { restaurantId }) },
    orderBy: [{ gravite: 'desc' }, { createdAt: 'desc' }], take: 100,
  })
  return NextResponse.json(signalements)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { restaurantId, categorie, description, gravite } = await req.json()
  if (!categorie || !description?.trim())
    return NextResponse.json({ error: 'Catégorie et description requis' }, { status: 400 })
  const restoId = restaurantId || session.restaurantId
  if (!restoId) return NextResponse.json({ error: 'Restaurant non défini' }, { status: 400 })
  // Anonymat total — aucun userId
  const s = await prisma.signalement.create({
    data: { restaurantId: restoId, categorie, description: description.trim(), gravite: gravite || 'normale' },
  })
  await prisma.journalActivite.create({
    data: { auteur: 'Système (anonyme)', action: `🚨 Signalement ${categorie} (${gravite || 'normale'})`, type: 'rh', ref: s.id },
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(req) {
  const session = await requireAuth(await cookies())
  if (!session || session.role !== 'super_admin')
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { id, statut, commentaireTraitement } = await req.json()
  const updated = await prisma.signalement.update({
    where: { id }, data: { statut, traitePar: session.name, commentaireTraitement: commentaireTraitement || null },
  })
  return NextResponse.json(updated)
}
