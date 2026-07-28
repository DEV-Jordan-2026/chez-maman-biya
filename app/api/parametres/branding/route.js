// app/api/parametres/branding/route.js — Config branding par restaurant
import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import prisma           from '@/lib/db'
import { requireAuth }  from '@/lib/auth'

// GET — retourne la config branding du restaurant courant
export async function GET() {
  try {
    const cookieStore = await cookies()
    const session     = await requireAuth(cookieStore)
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    if (!session.restaurantId) return NextResponse.json({ parametres: null })

    const restaurant = await prisma.restaurant.findUnique({
      where:  { id: session.restaurantId },
      select: { parametres: true },
    })

    return NextResponse.json({ parametres: restaurant?.parametres || null })
  } catch (err) {
    console.error('[GET /api/parametres/branding]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — sauvegarde la config branding en DB
export async function PUT(request) {
  try {
    const cookieStore = await cookies()
    const session     = await requireAuth(cookieStore)
    if (!session || !['super_admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    if (!session.restaurantId) {
      return NextResponse.json({ error: 'Aucun restaurant associé' }, { status: 400 })
    }

    const newConfig = await request.json()

    await prisma.restaurant.update({
      where: { id: session.restaurantId },
      data:  { parametres: newConfig },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/parametres/branding]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
