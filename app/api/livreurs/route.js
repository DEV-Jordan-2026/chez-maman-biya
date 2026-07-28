import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, requireAdmin, hashPassword } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const livreurs = await prisma.livreur.findMany({
    where:   { restaurantId: rid, actif: true },
    orderBy: { nom: 'asc' },
  })
  // Ne jamais exposer le hash du PIN ; indiquer juste s'il est défini
  const safe = livreurs.map(({ pinHash, ...l }) => ({ ...l, hasPin: !!pinHash }))
  return NextResponse.json(safe)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { nom, tel, zones = [], pin } = await request.json()
    if (!nom || !tel) return NextResponse.json({ error: 'nom et tel requis' }, { status: 400 })
    if (pin && !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Le PIN doit comporter 4 chiffres' }, { status: 400 })
    }
    const pinHash = pin ? await hashPassword(pin) : null
    const l = await prisma.livreur.create({
      data: { restaurantId: session.restaurantId, nom, tel, zones, pinHash },
    })
    const { pinHash: _ph, ...safe } = l
    return NextResponse.json({ ...safe, hasPin: !!pinHash }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
