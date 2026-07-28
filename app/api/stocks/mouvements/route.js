// app/api/stocks/mouvements/route.js — v15
// Historique des mouvements de stock (entrées, sorties, ajustements)
//
// GET /api/stocks/mouvements
//   ?restaurantId=...   filtre par restaurant (défaut : session.restaurantId)
//   ?stockItemId=...    filtre sur un article précis
//   ?type=entree|sortie|ajustement|inventaire
//   ?source=reception|commande|manuel|inventaire
//   ?from=YYYY-MM-DD    borne début (incluse)
//   ?to=YYYY-MM-DD      borne fin (incluse)
//   ?limit=100          max 500, défaut 100

import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { requireAuth }  from '@/lib/auth'
import prisma           from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const stockItemId  = searchParams.get('stockItemId')
  const type         = searchParams.get('type')
  const source       = searchParams.get('source')
  const from         = searchParams.get('from')   // YYYY-MM-DD
  const to           = searchParams.get('to')     // YYYY-MM-DD
  const limit        = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

  // ── Construction du filtre Prisma ─────────────────────────────────────────
  const where = {}

  if (restaurantId) where.restaurantId = restaurantId
  if (stockItemId)  where.stockItemId  = stockItemId
  if (type)         where.type         = type
  if (source)       where.source       = source

  if (from || to) {
    where.createdAt = {}
    if (from) {
      where.createdAt.gte = new Date(`${from}T00:00:00.000Z`)
    }
    if (to) {
      // Borne to incluse → on va jusqu'au lendemain 00:00
      const toDate = new Date(`${to}T00:00:00.000Z`)
      toDate.setDate(toDate.getDate() + 1)
      where.createdAt.lt = toDate
    }
  }

  try {
    const mouvements = await prisma.mouvementStock.findMany({
      where,
      include: {
        stockItem: { select: { nom: true, unite: true, cat: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // ── Stats agrégées (calculées côté serveur pour éviter un aller-retour) ──
    const stats = {
      totalEntrees:    0,
      totalSorties:    0,
      totalAjustements:0,
      volumeEntrees:   0,
      volumeSorties:   0,
      count:           mouvements.length,
    }
    for (const m of mouvements) {
      if (m.type === 'entree')      { stats.totalEntrees++;     stats.volumeEntrees   += m.quantite }
      else if (m.type === 'sortie') { stats.totalSorties++;     stats.volumeSorties   += m.quantite }
      else                          { stats.totalAjustements++ }
    }

    return NextResponse.json({ mouvements, stats })
  } catch (err) {
    console.error('[GET /api/stocks/mouvements]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
