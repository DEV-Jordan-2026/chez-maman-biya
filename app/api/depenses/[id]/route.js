import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await context.params

    // Vérifier ownership avant suppression
    const existing = await prisma.depense.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable ou accès refusé' }, { status: 404 })
    }

    await prisma.depense.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }
    console.error('[DELETE /api/depenses/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
