import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const where = { restaurantId: rid }
  if (status) where.status = status

  const bons = await prisma.bonCommande.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 })
  return NextResponse.json(bons)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { fournisseurId, items = [], dateLivraison, note } = await request.json()
    if (!fournisseurId || items.length === 0) return NextResponse.json({ error: 'fournisseurId et items requis' }, { status: 400 })
    const total = items.reduce((s, it) => s + (it.prixUnit || 0) * (it.qte || 1), 0)
    const bon = await prisma.bonCommande.create({
      data: {
        restaurantId:  session.restaurantId,
        fournisseurId,
        items,
        total,
        status: 'brouillon',
        dateCommande:  new Date().toISOString().split('T')[0],
        dateLivraison: dateLivraison || null,
        note:          note || null,
      },
    })
    return NextResponse.json(bon, { status: 201 })
  } catch (err) {
    console.error('[POST /api/bons-commande]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
