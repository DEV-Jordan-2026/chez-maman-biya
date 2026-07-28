import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { id } = await context.params
    const body = await request.json()

    // Vérifier que la table appartient au restaurant
    const existing = await prisma.table.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Table introuvable ou accès refusé' }, { status: 404 })

    const allowed = ['status', 'capacite', 'zone', 'commandeId']
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
    const table = await prisma.table.update({ where: { id }, data })
    return NextResponse.json(table)
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { id } = await context.params

    // Vérifier que la table appartient au restaurant
    const existing = await prisma.table.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Table introuvable ou accès refusé' }, { status: 404 })

    await prisma.table.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
