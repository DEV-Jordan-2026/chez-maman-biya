import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const tables = await prisma.table.findMany({
    where:   { restaurantId: rid },
    orderBy: [{ zone: 'asc' }, { numero: 'asc' }],
  })
  return NextResponse.json(tables)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { numero, zone = 'salle', capacite = 4 } = await request.json()
    if (!numero) return NextResponse.json({ error: 'Numéro requis' }, { status: 400 })
    const table = await prisma.table.create({
      data: {
        restaurantId: session.restaurantId,
        numero:   parseInt(numero),
        zone,
        capacite: parseInt(capacite),
      },
    })
    return NextResponse.json(table, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Ce numéro de table existe déjà' }, { status: 409 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
