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
    const { status, items, dateLivraison, note } = body

    const existing = await prisma.bonCommande.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    const data = {}
    if (status)        data.status        = status
    if (items)         data.items         = items
    if (dateLivraison) data.dateLivraison = dateLivraison
    if (note)          data.note          = note
    if (items)         data.total         = items.reduce((s, it) => s + (it.prixUnit || 0) * (it.qte || 1), 0)

    // Si passage à "recu" → mettre à jour les stocks (filtrés par restaurant)
    if (status === 'recu') {
      const lignes = items || (Array.isArray(existing.items) ? existing.items : [])
      for (const ligne of lignes) {
        if (!ligne.nom || !ligne.qte) continue
        const stockItem = await prisma.stockItem.findFirst({
          where: {
            restaurantId: session.restaurantId,
            nom: { contains: ligne.nom, mode: 'insensitive' },
          },
        })
        if (stockItem) {
          await prisma.stockItem.update({
            where: { id: stockItem.id },
            data:  { stock: { increment: parseFloat(ligne.qte) } },
          })
        }
      }
    }

    const bon = await prisma.bonCommande.update({ where: { id }, data })
    return NextResponse.json(bon)
  } catch (err) {
    console.error('[PATCH /api/bons-commande/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  try {
    const { id } = await context.params

    const existing = await prisma.bonCommande.findFirst({
      where: { id, restaurantId: session.restaurantId },
    })
    if (!existing) return NextResponse.json({ error: 'Introuvable ou accès refusé' }, { status: 404 })

    await prisma.bonCommande.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
