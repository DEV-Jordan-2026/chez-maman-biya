import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth, requireAdmin, hashPassword } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { id } = await context.params
    const body = await request.json()

    // Vérifier ownership — B4 : super_admin a restaurantId null donc on l'exclut du filtre
    const ownershipWhere = session.role === 'super_admin'
      ? { id }
      : { id, restaurantId: session.restaurantId }
    const existing = await prisma.livreur.findFirst({ where: ownershipWhere })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    const allowed = ['status', 'nom', 'tel', 'zones', 'actif']
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

    // v26 — Changement de PIN (4 chiffres) — réservé à un admin/manager
    if (body.pin !== undefined) {
      if (!/^\d{4}$/.test(body.pin)) {
        return NextResponse.json({ error: 'Le PIN doit comporter 4 chiffres' }, { status: 400 })
      }
      data.pinHash = await hashPassword(body.pin)
    }

    const l = await prisma.livreur.update({ where: { id }, data })
    const { pinHash, ...safe } = l
    return NextResponse.json({ ...safe, hasPin: !!pinHash })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { id } = await context.params

    // Vérifier ownership — B4 : super_admin a restaurantId null donc on l'exclut du filtre
    const ownershipWhere = session.role === 'super_admin'
      ? { id }
      : { id, restaurantId: session.restaurantId }
    const existing = await prisma.livreur.findFirst({ where: ownershipWhere })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    await prisma.livreur.update({ where: { id }, data: { actif: false } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
