import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { validateAmount, sanitize } from '@/lib/validate'
import { cookies } from 'next/headers'

async function checkSuperAdmin(cookieStore) {
  const session = await requireAuth(cookieStore)
  if (!session || session.role !== 'super_admin') return null
  return session
}

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await checkSuperAdmin(cookieStore)
  if (!session) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const depuis = searchParams.get('depuis')

    const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
      ? searchParams.get('restaurantId')
      : session.restaurantId

    const where = { restaurantId: rid }
    if (depuis) where.date = { gte: depuis }

    const depenses = await prisma.depense.findMany({
      where,
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(depenses)
  } catch (err) {
    console.error('[GET /api/depenses]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await checkSuperAdmin(cookieStore)
  if (!session) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { libelle, montant, categorie, date } = await request.json()

    if (!libelle || !montant || !categorie) {
      return NextResponse.json({ error: 'Champs requis : libelle, montant, categorie' }, { status: 400 })
    }
    if (!validateAmount(montant)) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    const depense = await prisma.depense.create({
      data: {
        restaurantId: session.restaurantId,
        libelle:      sanitize(libelle, 200),
        montant:      Number(montant),
        categorie:    sanitize(categorie, 50),
        date:         date || new Date().toISOString().split('T')[0],
      },
    })

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: session.restaurantId,
      auteur: session.name || session.login,
      action: `Dépense créée : ${sanitize(libelle, 80)} — ${Number(montant).toLocaleString('fr-FR')} FCFA (${sanitize(categorie, 50)})`,
      type: 'comptabilite', ref: depense.id,
    }}).catch(err => console.error('[journal depenses POST]', err.message))

    return NextResponse.json(depense, { status: 201 })
  } catch (err) {
    console.error('[POST /api/depenses]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
