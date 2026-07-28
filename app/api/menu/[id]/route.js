// app/api/menu/[id]/route.js
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

async function requireSuperAdmin() {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || session.role !== 'super_admin') return null
  return session
}

export async function DELETE(request, context) {
  const session = await requireSuperAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  try {
    const { id } = await context.params

    // Vérifier que le plat appartient au restaurant de l'admin
    const existing = await prisma.menuItem.findFirst({
      where: { id: Number(id), restaurantId: session.restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Plat introuvable ou accès refusé' }, { status: 404 })
    }

    await prisma.menuItem.delete({ where: { id: Number(id) } })

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: session.restaurantId,
      auteur: session.name || session.login,
      action: `Plat supprimé : ${existing.name}`,
      type: 'menu', ref: String(id),
    }}).catch(err => console.error('[journal]', err.message))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Plat introuvable' }, { status: 404 })
    }
    console.error('[DELETE /api/menu/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
