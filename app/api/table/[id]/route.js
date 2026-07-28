// app/api/table/[id]/route.js
// Route PUBLIQUE — retourne les infos d'une table + menu actif + commande ouverte
// Utilisée par la page /table/[id] scannée via QR code
// Pas d'auth car le client ne sera jamais connecté

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(request, context) {
  // Rate limit : 60 req/min par IP (anti-scraping)
  const ip = getClientIp(request)
  const { ok, remaining } = await rateLimit(`table-info:${ip}`, { limit: 60, windowMs: 60_000 })
  if (!ok) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

  try {
    const { id } = await context.params

    const table = await prisma.table.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: { id: true, nom: true, ville: true, quartier: true, tel: true },
        },
      },
    })

    if (!table) {
      return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })
    }

    // Menu actif filtré par restaurant
    const menu = await prisma.menuItem.findMany({
      where: {
        actif: true,
        ...(table.restaurantId ? { restaurantId: table.restaurantId } : {}),
      },
      orderBy: [{ cat: 'asc' }, { popular: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, price: true, cat: true, emoji: true, desc: true, popular: true, tempsPrep: true },
    })

    // Commande ouverte sur cette table (si existante)
    const commandeOuverte = table.commandeId
      ? await prisma.commandeTable.findUnique({
          where:  { id: table.commandeId },
          select: { id: true, items: true, total: true, status: true, nbCouverts: true, note: true },
        })
      : null

    return NextResponse.json({
      table: {
        id:       table.id,
        numero:   table.numero,
        zone:     table.zone,
        capacite: table.capacite,
        status:   table.status,
      },
      restaurant: table.restaurant,
      menu,
      commandeOuverte,
    })
  } catch (err) {
    console.error('[GET /api/table/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
