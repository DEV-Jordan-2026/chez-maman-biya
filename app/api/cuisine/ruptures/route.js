// app/api/cuisine/ruptures/route.js — v25-fixed
//
// PATCH /api/cuisine/ruptures
//   Déclare ou retire la rupture d'un article en cuisine
//   en manipulant le stock du StockItem lié au plat.
//
// FIX I6 — Utilise menuItemId (Int) au lieu de menuItemNom (fuzzy match)
//   pour éviter les effets de bord entre plats aux noms similaires
//   (ex: "Poulet DG" et "Poulet braisé" → un seul PATCH peut mettre à zéro les deux).
//
// Body JSON :
//   { menuItemId: number, enRupture: boolean }
//   Compatibilité ascendante : menuItemNom toujours accepté comme fallback (déprécié)
//
// Accès : staff uniquement (role === 'staff')

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { cookies }      from 'next/headers'
import { requireAuth }  from '@/lib/auth'

export async function PATCH(request) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)

  if (!session || session.role !== 'staff') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const rid = session.restaurantId

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const { menuItemId, menuItemNom, enRupture } = body

  // FIX I6 — Priorité à menuItemId (exact), fallback menuItemNom (déprécié, fuzzy)
  const hasId  = menuItemId !== undefined && menuItemId !== null
  const hasNom = typeof menuItemNom === 'string' && menuItemNom.trim() !== ''

  if (!hasId && !hasNom) {
    return NextResponse.json({ error: 'menuItemId (number) ou menuItemNom (string) requis' }, { status: 400 })
  }
  if (typeof enRupture !== 'boolean') {
    return NextResponse.json({ error: 'enRupture (boolean) requis' }, { status: 400 })
  }

  try {
    let recettes

    if (hasId) {
      // FIX I6 — Recherche exacte par ID : aucun risque de collision entre plats
      const menuItemIdInt = parseInt(menuItemId)
      if (isNaN(menuItemIdInt) || menuItemIdInt <= 0) {
        return NextResponse.json({ error: 'menuItemId invalide' }, { status: 400 })
      }
      recettes = await prisma.recetteIngredient.findMany({
        where: {
          restaurantId: rid,
          menuItemId:   menuItemIdInt,  // correspondance exacte — pas de fuzzy
        },
        select: { stockItemId: true },
      })
    } else {
      // Fallback déprécié — fuzzy match par nom (à migrer côté client vers menuItemId)
      console.warn(`[cuisine/ruptures] Utilisation dépréciée de menuItemNom="${menuItemNom}" — migrer vers menuItemId`)
      recettes = await prisma.recetteIngredient.findMany({
        where: {
          restaurantId: rid,
          menuItemNom:  { contains: menuItemNom, mode: 'insensitive' },
        },
        select: { stockItemId: true },
      })
    }

    if (recettes.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Aucun stock lié — rupture gérée localement uniquement',
        updated: 0,
      })
    }

    const stockIds = [...new Set(recettes.map(r => r.stockItemId))]

    if (enRupture) {
      await prisma.stockItem.updateMany({
        where: {
          id:           { in: stockIds },
          restaurantId: rid,
        },
        data: { stock: 0 },
      })
    } else {
      const items = await prisma.stockItem.findMany({
        where: { id: { in: stockIds }, restaurantId: rid },
        select: { id: true, seuil: true },
      })

      await prisma.$transaction(
        items.map(item =>
          prisma.stockItem.update({
            where: { id: item.id },
            data:  { stock: Math.max(item.seuil + 1, 1) },
          })
        )
      )
    }

    return NextResponse.json({
      ok:      true,
      message: enRupture ? 'Rupture déclarée' : 'Rupture levée',
      updated: stockIds.length,
    })
  } catch (err) {
    console.error('[PATCH /api/cuisine/ruptures]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
