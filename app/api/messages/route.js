import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const nonLus = searchParams.get('nonLus') === '1'

  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const where = {
    restaurantId: rid,
    OR: [
      { destinataire: 'tous' },
      { destinataire: session.role },
      { auteur: session.login },
    ],
    ...(nonLus ? { lu: false } : {}),
  }

  const messages = await prisma.messageInterne.findMany({
    where,
    orderBy: [{ priorite: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  })
  return NextResponse.json(messages)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { contenu, destinataire = 'tous', priorite = 'normal' } = await request.json()
    if (!contenu?.trim()) return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })

    const msg = await prisma.messageInterne.create({
      data: {
        restaurantId: session.restaurantId,
        auteur:       session.name || session.login,
        auteurRole:   session.role,
        destinataire,
        contenu:      contenu.trim(),
        priorite,
      },
    })
    return NextResponse.json(msg, { status: 201 })
  } catch (err) {
    console.error('[POST /api/messages]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
