import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { id } = await context.params
    const { lu } = await request.json()

    // Vérifier que le message appartient au restaurant
    const existing = await prisma.messageInterne.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    const msg = await prisma.messageInterne.update({ where: { id }, data: { lu: Boolean(lu) } })
    return NextResponse.json(msg)
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || !['super_admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  try {
    const { id } = await context.params

    // Vérifier que le message appartient au restaurant
    const existing = await prisma.messageInterne.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    await prisma.messageInterne.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
