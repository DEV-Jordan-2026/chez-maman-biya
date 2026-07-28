import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || !['super_admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type  = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)

  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const where = { restaurantId: rid }
  if (type) where.type = type

  const entries = await prisma.journalActivite.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(entries)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { action, type, ref, meta } = await request.json()
    if (!action || !type) return NextResponse.json({ error: 'action et type requis' }, { status: 400 })

    const entry = await prisma.journalActivite.create({
      data: {
        restaurantId: session.restaurantId,
        auteur: session.name || session.login,
        action,
        type,
        ref:  ref  || null,
        meta: meta || null,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    console.error('[POST /api/journal]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
