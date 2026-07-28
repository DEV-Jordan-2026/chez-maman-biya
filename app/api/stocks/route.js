import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { cookies }    from 'next/headers'
import { requireAuth } from '@/lib/auth'
import { sanitize }  from '@/lib/validate'

// Rôles pouvant LIRE les stocks
const ROLES_LECTURE  = ['super_admin', 'manager', 'magasinier']
// Rôles pouvant CRÉER un article stock (ajout fiche)
const ROLES_CREATION = ['super_admin', 'manager']

// Résout le restaurantId effectif (super_admin peut cibler un autre restaurant)
function resolveRid(session, searchParams) {
  if (session.role === 'super_admin' && searchParams?.get('restaurantId')) {
    return searchParams.get('restaurantId')
  }
  return session.restaurantId
}

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session || !ROLES_LECTURE.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rid = resolveRid(session, searchParams)

  try {
    const stocks = await prisma.stockItem.findMany({
      where:   { restaurantId: rid },
      orderBy: { nom: 'asc' },
    })
    return NextResponse.json(stocks)
  } catch (err) {
    console.error('[GET /api/stocks]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session || !ROLES_CREATION.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé — manager ou super_admin requis' }, { status: 403 })
  }

  try {
    const { nom, unite, stock, seuil, cat } = await request.json()

    if (!nom || stock === undefined) {
      return NextResponse.json({ error: 'Champs requis : nom, stock' }, { status: 400 })
    }

    const item = await prisma.stockItem.create({
      data: {
        restaurantId: session.restaurantId,
        nom:   sanitize(nom, 100),
        unite: sanitize(unite || 'kg', 20),
        stock: parseFloat(stock) || 0,
        seuil: parseFloat(seuil) || 0,
        cat:   sanitize(cat || 'Autre', 50),
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    console.error('[POST /api/stocks]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
