// app/api/achats/receptions/route.js — v15
// + enregistrement MouvementStock (type='entree', source='reception') à chaque réception

import { NextResponse }                from 'next/server'
import { cookies }                     from 'next/headers'
import { requireAuth, hasPermission }  from '@/lib/auth'
import prisma                          from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const receptions = await prisma.reception.findMany({
    where: restaurantId ? { restaurantId } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(receptions)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!await hasPermission(session, 'receptionner_marchandises'))
    return NextResponse.json({ error: 'Permission insuffisante — contactez votre manager' }, { status: 403 })

  const body = await req.json()
  const { restaurantId, bonCommandeId, items, observation, status } = body
  if (!bonCommandeId || !Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'Bon de commande et articles requis' }, { status: 400 })

  const restoId = restaurantId || session.restaurantId
  if (!restoId) return NextResponse.json({ error: 'Restaurant non défini' }, { status: 400 })

  const reception = await prisma.reception.create({
    data: {
      restaurantId:    restoId,
      bonCommandeId,
      receptionnePar:  session.name,
      items,
      observation:     observation?.trim() || null,
      status:          status || 'complete',
    },
  })

  await prisma.bonCommande.update({ where: { id: bonCommandeId }, data: { status: 'recu' } })

  if (status === 'partielle' || status === 'litige') {
    await prisma.journalActivite.create({
      data: {
        auteur: session.name,
        action: `⚠️ Réception ${status} — BC ${bonCommandeId}`,
        type:   'achats',
        ref:    reception.id,
        meta:   { observation },
      },
    })
  }

  // ── Mise à jour des stocks + enregistrement mouvements ───────────────────
  if (status !== 'litige') {
    for (const item of items) {
      if (!item.article || !item.qteRecue) continue
      const qteRecue = parseFloat(item.qteRecue)
      if (qteRecue <= 0) continue

      const stockItem = await prisma.stockItem.findFirst({
        where: {
          restaurantId: restoId,
          nom: { contains: item.article, mode: 'insensitive' },
        },
      })

      if (stockItem) {
        const stockAvant = stockItem.stock

        await prisma.stockItem.update({
          where: { id: stockItem.id },
          data:  { stock: { increment: qteRecue } },
        })

        // Enregistrement du mouvement (non-bloquant)
        prisma.mouvementStock.create({
          data: {
            stockItemId:  stockItem.id,
            restaurantId: restoId,
            type:         'entree',
            source:       'reception',
            quantite:     qteRecue,
            stockAvant,
            stockApres:   stockAvant + qteRecue,
            reference:    reception.id,
            auteur:       session.name,
            note:         `Réception BC #${bonCommandeId.slice(-6)}${observation ? ' — ' + observation : ''}`,
          },
        }).catch(err => console.error('[receptions POST] mouvement log failed:', err.message))
      }
    }
  }

  return NextResponse.json(reception, { status: 201 })
}
