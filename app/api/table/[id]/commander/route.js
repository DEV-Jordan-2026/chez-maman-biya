// app/api/table/[id]/commander/route.js
// Soumet une commande depuis la page QR code (client non authentifié)
// Crée ou met à jour la CommandeTable associée à la table
// v2 — N5 : prix revalidés côté serveur depuis la BDD (anti-fraude prix 0 FCFA)

import { NextResponse }  from 'next/server'
import prisma            from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { sanitize }      from '@/lib/validate'
import { randomBytes }   from 'crypto'
import { publish }       from '@/lib/eventBus'

function genId() { return 'TBL-' + randomBytes(4).toString('hex').toUpperCase() }

export async function POST(request, context) {
  const ip = getClientIp(request)
  const { ok } = await rateLimit(`table-cmd:${ip}`, { limit: 10, windowMs: 60_000 }) // max 10 soumissions/min
  if (!ok) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

  try {
    const { id } = await context.params
    const body   = await request.json()
    const { items, note, nbCouverts, clientNom } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Le panier est vide' }, { status: 400 })
    }

    const table = await prisma.table.findUnique({ where: { id } })
    if (!table) return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })

    if (table.status === 'nettoyage') {
      return NextResponse.json({ error: 'Table en nettoyage, veuillez patienter' }, { status: 409 })
    }

    // N5 — Revalider les prix depuis la BDD (le client ne fait pas autorité sur les prix)
    const itemIds = items.map(it => parseInt(it.id)).filter(Boolean)
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id:           { in: itemIds },
        restaurantId: table.restaurantId,
      },
      select: { id: true, price: true, name: true },
    })
    const priceMap = Object.fromEntries(menuItems.map(m => [m.id, m.price]))

    // Construire les items sanitizés avec prix serveur
    const itemsSanitizes = items
      .slice(0, 50)
      .map(it => {
        const menuId    = parseInt(it.id) || 0
        const prixReel  = priceMap[menuId]
        if (!prixReel) return null  // article inconnu ou hors restaurant → rejeté
        return {
          id:    menuId,
          name:  String(it.name || '').slice(0, 100),
          price: prixReel,  // prix serveur — le prix client est ignoré
          qty:   Math.max(1, Math.min(99, parseInt(it.qty) || 1)),
        }
      })
      .filter(Boolean)

    if (itemsSanitizes.length === 0) {
      return NextResponse.json({ error: 'Aucun article valide dans le panier' }, { status: 422 })
    }

    const total = itemsSanitizes.reduce((s, it) => s + it.price * it.qty, 0)

    let cmd

    // Si une commande est déjà ouverte sur la table → ajouter les articles
    if (table.commandeId) {
      const existing = await prisma.commandeTable.findUnique({ where: { id: table.commandeId } })

      if (existing && !['ferme', 'annule'].includes(existing.status)) {
        const existingItems = Array.isArray(existing.items) ? existing.items : []
        const mergedItems   = [...existingItems]

        for (const ni of itemsSanitizes) {
          const idx = mergedItems.findIndex(e => e.id === ni.id)
          if (idx >= 0) mergedItems[idx] = { ...mergedItems[idx], qty: mergedItems[idx].qty + ni.qty }
          else mergedItems.push(ni)
        }

        // Recalculer le total fusionné depuis les prix serveur stockés
        const newTotal = mergedItems.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
        cmd = await prisma.commandeTable.update({
          where: { id: existing.id },
          data: {
            items:      mergedItems,
            total:      newTotal,
            status:     'ouvert',
            note:       note ? sanitize(note, 300) : existing.note,
            nbCouverts: nbCouverts ? parseInt(nbCouverts) : existing.nbCouverts,
          },
        })
      }
    }

    // Sinon créer une nouvelle commande
    if (!cmd) {
      cmd = await prisma.commandeTable.create({
        data: {
          id:         genId(),
          tableId:    id,
          serveurId:  `client-qr:${sanitize(clientNom || 'Anonyme', 50)}`,
          items:      itemsSanitizes,
          total,
          note:       note ? sanitize(note, 300) : null,
          nbCouverts: nbCouverts ? parseInt(nbCouverts) : 1,
          status:     'ouvert',
        },
      })

      await prisma.table.update({
        where: { id },
        data:  { status: 'occupee', commandeId: cmd.id },
      })
    }

    // Notifier le staff en temps réel
    publish(
      { type: 'commande_nouvelle', data: { ...cmd, _source: 'qr_table', tableNumero: table.numero } },
      table.restaurantId || null
    )

    return NextResponse.json({ ok: true, commandeId: cmd.id, total: cmd.total }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/table/[id]/commander]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
