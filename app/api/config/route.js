// app/api/config/route.js
// Paramètres publics exposés au frontend client (aucune auth requise)
// Uniquement les clés sans valeur sensible : frais livraison, taux acompte, seuils promos.

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'

// Clés autorisées à être exposées publiquement
const PUBLIC_KEYS = [
  'taux_acompte_livraison',
  'livraison_gratuite_de',
  'reduction_seuil',
  'reduction_taux',
]

const DEFAULTS = {
  'taux_acompte_livraison': '30',
  'livraison_gratuite_de':  '5000',
  'reduction_seuil':        '15000',
  'reduction_taux':         '10',
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const restaurantId = searchParams.get('restaurantId') || ''

  try {
    const rows = await prisma.parametre.findMany({
      where: {
        id:  { in: PUBLIC_KEYS },
        OR: [
          { restaurantId: '' },       // valeurs globales (défaut)
          { restaurantId },           // surcharges du restaurant
        ],
      },
    })

    const result = { ...DEFAULTS }
    // Globaux d'abord, surcharges restaurant ensuite
    for (const r of rows.filter(r => r.restaurantId === ''))           result[r.id] = r.valeur
    for (const r of rows.filter(r => r.restaurantId === restaurantId && restaurantId)) result[r.id] = r.valeur

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch {
    // Si la table n'existe pas encore, retourner les défauts
    return NextResponse.json(DEFAULTS)
  }
}
