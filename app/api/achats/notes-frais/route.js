// app/api/achats/notes-frais/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const status = searchParams.get('status')
  const notes = await prisma.noteFrais.findMany({
    where: { ...(restaurantId && { restaurantId }), ...(status && { status }) },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  return NextResponse.json(notes)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  const { restaurantId, montant, categorie, description, justificatif } = body
  if (!montant || !categorie?.trim() || !description?.trim())
    return NextResponse.json({ error: 'Montant, catégorie et description requis' }, { status: 400 })
  const restoId = restaurantId || session.restaurantId
  if (!restoId) return NextResponse.json({ error: 'Restaurant non défini' }, { status: 400 })
  const note = await prisma.noteFrais.create({
    data: { restaurantId: restoId, employeId: session.userId || session.login,
            employeNom: session.name, montant: parseInt(montant),
            categorie: categorie.trim(), description: description.trim(),
            justificatif: justificatif?.trim() || null, status: 'en_attente' },
  })
  return NextResponse.json(note, { status: 201 })
}

export async function PATCH(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['manager','super_admin'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { id, status } = await req.json()
  if (!id || !['validee','refusee'].includes(status))
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const updated = await prisma.noteFrais.update({
    where: { id }, data: { status, valideePar: session.name },
  })
  return NextResponse.json(updated)
}
