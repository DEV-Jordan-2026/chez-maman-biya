// app/api/cuisine/stocks/route.js — v22
// GET /api/cuisine/stocks
//
// Endpoint dédié au staff cuisine (role === 'staff').
// Retourne tous les StockItems du restaurant avec :
//   - les champs habituels (nom, unite, stock, seuil, cat)
//   - un champ calculé `niveauPct` (0–100) et `alerte` ('ok'|'faible'|'rupture')
//   - la liste des plats liés via RecetteIngredient (pour contextualiser)
//
// Accès : staff, magasinier, manager, super_admin (lecture uniquement)
// Mutation : AUCUNE — ce endpoint est read-only, toute écriture reste sur /api/stocks

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { cookies }      from 'next/headers'
import { requireAuth }  from '@/lib/auth'

const ROLES_AUTORISES = ['super_admin', 'manager', 'magasinier', 'staff']

// Calcule le niveau relatif par rapport au seuil d'alerte.
// – stock ≤ 0              → rupture (0%)
// – seuil = 0              → pas de référence, toujours "ok" (100%)
// – stock ≤ seuil × 0.5   → rupture imminente (0–50%)
// – stock ≤ seuil          → faible (50–99%)
// – stock > seuil          → ok (référence = seuil × 3 = 100%)
function calcNiveau(stock, seuil) {
  if (stock <= 0)             return { niveauPct: 0,                                                  alerte: 'rupture' }
  if (seuil <= 0)             return { niveauPct: 100,                                                alerte: 'ok'      }
  if (stock <= seuil * 0.5)  return { niveauPct: Math.round((stock / seuil) * 50),                   alerte: 'rupture' }
  if (stock <= seuil)         return { niveauPct: Math.round(50 + ((stock - seuil * 0.5) / (seuil * 0.5)) * 50), alerte: 'faible'  }
  const ref = seuil * 3
  return { niveauPct: Math.min(100, Math.round((stock / ref) * 100)), alerte: 'ok' }
}

export async function GET(request) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)

  if (!session || !ROLES_AUTORISES.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const rid = session.restaurantId

  try {
    const items = await prisma.stockItem.findMany({
      where:   { restaurantId: rid },
      orderBy: [{ cat: 'asc' }, { nom: 'asc' }],
      include: {
        recettes: {
          select: {
            menuItemNom: true,
            quantite:    true,
            unite:       true,
          },
        },
      },
    })

    const enriched = items.map(item => {
      const { niveauPct, alerte } = calcNiveau(item.stock, item.seuil)
      return {
        id:        item.id,
        nom:       item.nom,
        unite:     item.unite,
        stock:     item.stock,
        seuil:     item.seuil,
        cat:       item.cat,
        niveauPct,
        alerte,
        enRupture: item.stock <= 0,  // raccourci booléen pour le client
        platsLies: item.recettes.map(r => ({
          nom:      r.menuItemNom,
          quantite: r.quantite,
          unite:    r.unite,
        })),
      }
    })

    const stats = {
      total:    enriched.length,
      ruptures: enriched.filter(i => i.alerte === 'rupture').length,
      faibles:  enriched.filter(i => i.alerte === 'faible').length,
      ok:       enriched.filter(i => i.alerte === 'ok').length,
    }

    return NextResponse.json({ items: enriched, stats })
  } catch (err) {
    console.error('[GET /api/cuisine/stocks]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
