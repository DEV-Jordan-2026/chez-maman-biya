import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { decrementerStockCommande } from '@/lib/stockDecrement'

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await context.params
    const body = await request.json()
    const { action, items, status, note, paiement, nbCouverts, remise } = body

    const existing = await prisma.commandeTable.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

    let data = {}

    if (action === 'add_items') {
      // Ajouter/modifier des articles
      const existingItems = Array.isArray(existing.items) ? existing.items : []
      const newItems = [...existingItems]
      for (const ni of (items || [])) {
        const idx = newItems.findIndex(e => e.id === ni.id)
        if (idx >= 0) {
          if (ni.qty === 0) newItems.splice(idx, 1)
          else newItems[idx] = { ...newItems[idx], ...ni }
        } else if (ni.qty > 0) {
          newItems.push(ni)
        }
      }
      const total = newItems.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
      data = { items: newItems, total }

    } else if (action === 'envoyer_cuisine') {
      data = { status: 'envoye' }
      // Décrément stock dès l'envoi en cuisine (best-effort)
      const itemsParsed = Array.isArray(existing.items) ? existing.items : []
      decrementerStockCommande(itemsParsed, session.restaurantId || null)
        .catch(err => console.error('[commandes-table] stockDecrement:', err.message))

    } else if (action === 'fermer') {
      // Clôture de la commande de table — libérer la table
      data = { status: 'ferme' }
      await prisma.table.update({
        where: { id: existing.tableId },
        data: { status: 'nettoyage', commandeId: null },
      })

    } else if (action === 'annuler') {
      data = { status: 'annule' }
      await prisma.table.update({
        where: { id: existing.tableId },
        data: { status: 'libre', commandeId: null },
      })

    } else {
      // Mise à jour directe de champs
      if (status)     data.status     = status
      if (note)       data.note       = note
      if (nbCouverts) data.nbCouverts = parseInt(nbCouverts)
      if (items) {
        data.items = items
        data.total = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
      }
    }

    const cmd = await prisma.commandeTable.update({ where: { id }, data })
    return NextResponse.json(cmd)
  } catch (err) {
    console.error('[PATCH /api/commandes-table/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  if (!await requireAuth(cookieStore)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { id } = await context.params
    const cmd = await prisma.commandeTable.findUnique({ where: { id } })
    if (cmd) {
      await prisma.table.update({ where: { id: cmd.tableId }, data: { status: 'libre', commandeId: null } }).catch(() => {})
    }
    await prisma.commandeTable.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
