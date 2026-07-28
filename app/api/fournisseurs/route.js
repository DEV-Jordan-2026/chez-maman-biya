import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const fournisseurs = await prisma.fournisseur.findMany({
    where:   { restaurantId: rid },
    orderBy: { nom: 'asc' },
  })
  return NextResponse.json(fournisseurs)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { nom, tel, categorie, note } = await request.json()
    if (!nom || !categorie) return NextResponse.json({ error: 'nom et categorie requis' }, { status: 400 })
    const f = await prisma.fournisseur.create({
      data: { restaurantId: session.restaurantId, nom, tel: tel || null, categorie, note: note || null },
    })
    return NextResponse.json(f, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
