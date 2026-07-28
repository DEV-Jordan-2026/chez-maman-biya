// app/api/recettes/route.js
// Gestion des recettes (nomenclatures plat → ingrédients stock)
//
// GET  /api/recettes?menuItemId=X   — liste des ingrédients d'un plat
// GET  /api/recettes                — toutes les recettes du restaurant
// POST /api/recettes                — ajouter un ingrédient à un plat
// DELETE /api/recettes/:id          — supprimer un ingrédient d'une recette

import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import prisma           from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const menuItemId = searchParams.get('menuItemId')

  try {
    const where = {
      ...(session.role !== 'super_admin' && { restaurantId: session.restaurantId }),
      ...(menuItemId && { menuItemId: parseInt(menuItemId) }),
    }

    const recettes = await prisma.recetteIngredient.findMany({
      where,
      include: { stockItem: { select: { id: true, nom: true, unite: true, stock: true, seuil: true } } },
      orderBy: { menuItemNom: 'asc' },
    })

    return NextResponse.json(recettes)
  } catch (err) {
    console.error('[GET /api/recettes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const { menuItemId, menuItemNom, stockItemId, quantite, unite } = await request.json()

    if (!menuItemId || !stockItemId || !quantite || quantite <= 0) {
      return NextResponse.json(
        { error: 'menuItemId, stockItemId et quantite (> 0) sont requis' },
        { status: 400 }
      )
    }

    // Vérifier que le StockItem appartient bien au restaurant
    const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } })
    if (!stockItem) return NextResponse.json({ error: 'Ingrédient stock introuvable' }, { status: 404 })

    if (session.role !== 'super_admin' && stockItem.restaurantId !== session.restaurantId) {
      return NextResponse.json({ error: 'Accès refusé — ingrédient hors restaurant' }, { status: 403 })
    }

    const recette = await prisma.recetteIngredient.upsert({
      where: { menuItemId_stockItemId: { menuItemId: parseInt(menuItemId), stockItemId } },
      create: {
        menuItemId:  parseInt(menuItemId),
        menuItemNom: menuItemNom || `Plat #${menuItemId}`,
        stockItemId,
        quantite:    parseFloat(quantite),
        unite:       unite || stockItem.unite,
        restaurantId: session.restaurantId || stockItem.restaurantId,
      },
      update: {
        quantite:    parseFloat(quantite),
        unite:       unite || stockItem.unite,
        menuItemNom: menuItemNom || `Plat #${menuItemId}`,
      },
      include: { stockItem: { select: { id: true, nom: true, unite: true } } },
    })

    return NextResponse.json(recette, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Cet ingrédient est déjà dans la recette' }, { status: 409 })
    }
    console.error('[POST /api/recettes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request) {
  const cookieStore = await cookies()
  const session = await requireAdmin(cookieStore)
  if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    await prisma.recetteIngredient.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 })
    console.error('[DELETE /api/recettes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
