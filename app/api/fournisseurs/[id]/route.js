import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { id } = await context.params
    const body = await request.json()

    // Vérifier ownership
    const existing = await prisma.fournisseur.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    const f = await prisma.fournisseur.update({ where: { id }, data: body })
    return NextResponse.json(f)
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

    // Vérifier ownership
    const existing = await prisma.fournisseur.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    await prisma.fournisseur.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
