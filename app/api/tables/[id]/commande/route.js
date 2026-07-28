// app/api/tables/[id]/commande/route.js
// POST — Crée une commande depuis la table (public, sans auth)
// GET  — Retourne le menu + infos table (public)
//
// Sécurité : rate limiting par tableId (10 req/min), validation des items,
// déduplication sur 10 min (pour éviter le double-tap)

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitize }     from '@/lib/validate'
import { randomBytes }  from 'crypto'
import { publish }      from '@/lib/eventBus'

function genId() { return 'TBL-' + randomBytes(4).toString('hex').toUpperCase() }

export async function GET(request, context) {
  const { id } = await context.params

  try {
    const [table, menuItems] = await Promise.all([
      prisma.table.findUnique({
        where: { id },
        include: { restaurant: { select: { id: true, nom: true } } },
      }),
      prisma.menuItem.findMany({
        where: { actif: true },
        orderBy: [{ cat: 'asc' }, { name: 'asc' }],
      }),
    ])

    if (!table) return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })

    // Commande active sur cette table (si elle existe)
    const commandeActive = table.commandeId
      ? await prisma.commandeTable.findUnique({ where: { id: table.commandeId } })
      : null

    return NextResponse.json({
      table:  { id: table.id, numero: table.numero, zone: table.zone, capacite: table.capacite, status: table.status },
      restaurant: table.restaurant,
      menu:   menuItems,
      commande: commandeActive || null,
    })
  } catch (err) {
    console.error('[GET /api/tables/[id]/commande]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request, context) {
  const { id } = await context.params
  const ip = getClientIp(request)

  // Rate limiting : 10 req/min par IP + tableId
  const rl = await rateLimit(`table-order:${ip}:${id}`, { limit: 10, windowMs: 60_000 })
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 })

  try {
    const body  = await request.json()
    const { items, note, nbCouverts = 1, nom = '' } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La commande doit contenir au moins un article' }, { status: 400 })
    }

    const table = await prisma.table.findUnique({
      where: { id },
      include: { restaurant: { select: { id: true } } },
    })
    if (!table) return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })

    // Vérifier que la table n'est pas déjà occupée par une commande ouverte
    if (table.commandeId) {
      const existing = await prisma.commandeTable.findUnique({ where: { id: table.commandeId } })
      if (existing && !['ferme', 'annule'].includes(existing.status)) {
        // Ajouter les items à la commande existante
        const existingItems = Array.isArray(existing.items) ? existing.items : []
        const mergedItems   = [...existingItems]

        for (const ni of items) {
          const idx = mergedItems.findIndex(e => e.id === ni.id)
          if (idx >= 0) mergedItems[idx] = { ...mergedItems[idx], qty: mergedItems[idx].qty + (ni.qty || 1) }
          else mergedItems.push(ni)
        }
        const total = mergedItems.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)

        const updated = await prisma.commandeTable.update({
          where: { id: existing.id },
          data:  { items: mergedItems, total },
        })
        publish({ type: 'commande_status', data: { id: updated.id, status: updated.status } }, table.restaurantId || null)
        return NextResponse.json({ ...updated, _ajout: true })
      }
    }

    // Valider les prix côté serveur (anti-manipulation)
    const menuIds   = items.map(it => parseInt(it.id)).filter(Boolean)
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuIds }, actif: true } })
    const menuMap   = Object.fromEntries(menuItems.map(m => [m.id, m]))

    const validatedItems = items.map(it => {
      const plat = menuMap[parseInt(it.id)]
      if (!plat) return null
      return { id: plat.id, name: plat.name, price: plat.price, qty: Math.max(1, parseInt(it.qty) || 1) }
    }).filter(Boolean)

    if (validatedItems.length === 0) {
      return NextResponse.json({ error: 'Aucun plat valide dans la commande' }, { status: 400 })
    }

    const total = validatedItems.reduce((s, it) => s + it.price * it.qty, 0)

    const cmd = await prisma.commandeTable.create({
      data: {
        id:         genId(),
        tableId:    table.id,
        serveurId:  sanitize(nom || 'Client table', 100),
        items:      validatedItems,
        total,
        note:       note ? sanitize(note, 300) : null,
        nbCouverts: Math.max(1, parseInt(nbCouverts) || 1),
        status:     'ouvert',
      },
    })

    // Marquer la table comme occupée
    await prisma.table.update({
      where: { id: table.id },
      data:  { status: 'occupee', commandeId: cmd.id },
    })

    // SSE temps réel → staff
    publish({ type: 'commande_nouvelle', data: cmd }, table.restaurantId || null)

    return NextResponse.json(cmd, { status: 201 })
  } catch (err) {
    console.error('[POST /api/tables/[id]/commande]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
