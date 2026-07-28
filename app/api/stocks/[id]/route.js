// app/api/stocks/[id]/route.js — v15
// PATCH : ajustement manuel du stock (magasinier / manager / super_admin)
//         → logue un MouvementStock pour traçabilité complète
// DELETE : suppression fiche stock (manager / super_admin uniquement)

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { cookies }      from 'next/headers'
import { publish }      from '@/lib/eventBus'

const ROLES_AJUSTEMENT = ['super_admin', 'manager', 'magasinier']

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session || !ROLES_AJUSTEMENT.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id }             = await context.params
    const { delta, stock, note } = await request.json()

    // ── Lecture de l'état AVANT modification ──────────────────────────────
    const current = await prisma.stockItem.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

    let stockApres
    let typeMvt   // 'entree' | 'sortie' | 'ajustement'
    let quantite  // valeur absolue du mouvement

    if (delta !== undefined) {
      const d = parseFloat(delta)
      stockApres = Math.max(0, current.stock + d)
      quantite   = Math.abs(d)
      typeMvt    = d >= 0 ? 'entree' : 'sortie'
    } else if (stock !== undefined) {
      stockApres = Math.max(0, parseFloat(stock))
      quantite   = Math.abs(stockApres - current.stock)
      typeMvt    = 'ajustement'
    } else {
      return NextResponse.json({ error: 'delta ou stock requis' }, { status: 400 })
    }

    // ── Mise à jour du stock ───────────────────────────────────────────────
    const item = await prisma.stockItem.update({
      where: { id },
      data:  { stock: stockApres },
    })

    // ── Enregistrement du mouvement (non-bloquant) ─────────────────────────
    prisma.mouvementStock.create({
      data: {
        stockItemId:  id,
        restaurantId: session.restaurantId || current.restaurantId || null,
        type:         typeMvt,
        source:       'manuel',
        quantite,
        stockAvant:   current.stock,
        stockApres,
        auteur:       session.name || session.login,
        note:         note?.trim() || null,
      },
    }).catch(err => console.error('[stocks/[id] PATCH] mouvement log failed:', err.message))

    // ── SSE alerte si seuil franchi ────────────────────────────────────────
    if (item.seuil !== null && item.stock <= item.seuil) {
      publish(
        { type: 'stock_alerte', data: { id: item.id, nom: item.nom, stock: item.stock, seuil: item.seuil, unite: item.unite } },
        session.restaurantId || null
      )
    }

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: session.restaurantId || current.restaurantId || null,
      auteur: session.name || session.login,
      action: `Stock "${item.nom}" ajusté : ${current.stock} → ${stockApres} ${item.unite || ''}`.trim(),
      type: 'stocks', ref: String(id),
    }}).catch(err => console.error('[journal stocks PATCH]', err.message))

    return NextResponse.json(item)
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }
    console.error('[PATCH /api/stocks/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, context) {
  const cookieStore = await cookies()
  if (!await requireAdmin(cookieStore)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const session = await requireAuth(await cookies())

    const item = await prisma.stockItem.findUnique({
      where: { id },
      select: { nom: true, restaurantId: true },
    })

    await prisma.stockItem.delete({ where: { id } })

    // Journal d'activité (non-bloquant)
    if (item && session) {
      prisma.journalActivite.create({ data: {
        restaurantId: session.restaurantId || item.restaurantId || null,
        auteur: session.name || session.login,
        action: `Article stock supprimé : "${item.nom}"`,
        type: 'stocks', ref: String(id),
      }}).catch(err => console.error('[journal stocks DELETE]', err.message))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }
    console.error('[DELETE /api/stocks/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
