// tests/unit/stockDecrement.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock est hissé avant les imports par vitest — ne pas déplacer ces blocs.

vi.mock('@/lib/db', () => ({
  default: {
    recetteIngredient: { findMany: vi.fn() },
    stockItem:         { findMany: vi.fn(), update: vi.fn() },
    mouvementStock:    { create: vi.fn().mockResolvedValue({}) },
    $transaction:      vi.fn(ops => Promise.all(ops)),
  },
}))

vi.mock('@/lib/eventBus', () => ({
  publish: vi.fn(),
}))

import prisma                        from '@/lib/db'
import { publish }                   from '@/lib/eventBus'
import { decrementerStockCommande }  from '@/lib/stockDecrement'

// ── Fixtures ──────────────────────────────────────────────────────────────────
const RESTAURANT_ID = 'resto-test-001'
const COMMANDE_ID   = 'CMD-ABCD1234'

function makeStockItem({ id = 'stock-1', nom = 'Huile', stock = 10, seuil = 2, unite = 'L', restaurantId = RESTAURANT_ID } = {}) {
  return { id, nom, stock, seuil, unite, restaurantId }
}

function makeRecette({ stockItemId = 'stock-1', menuItemId = 1, quantite = 0.5, stockItem = null } = {}) {
  return {
    stockItemId,
    menuItemId,
    quantite,
    stockItem: stockItem ?? makeStockItem({ id: stockItemId }),
    restaurantId: RESTAURANT_ID,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.$transaction.mockImplementation(ops => Promise.all(ops))
  prisma.stockItem.update.mockResolvedValue(makeStockItem({ stock: 9 }))
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('decrementerStockCommande — cas nominal', () => {
  it('retourne un rapport vide si items est vide', async () => {
    const rapport = await decrementerStockCommande([], RESTAURANT_ID)
    expect(rapport.decrements).toHaveLength(0)
    expect(rapport.alertes).toHaveLength(0)
    expect(rapport.erreurs).toHaveLength(0)
    expect(prisma.recetteIngredient.findMany).not.toHaveBeenCalled()
  })

  it('retourne un rapport vide si aucune recette trouvée', async () => {
    prisma.recetteIngredient.findMany.mockResolvedValue([])
    const rapport = await decrementerStockCommande([{ id: 1, qty: 2 }], RESTAURANT_ID, COMMANDE_ID)
    expect(rapport.decrements).toHaveLength(0)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('décrémente le stock via $transaction pour une recette valide', async () => {
    prisma.recetteIngredient.findMany.mockResolvedValue([
      makeRecette({ stockItemId: 'stock-1', menuItemId: 1, quantite: 0.5 }),
    ])

    const rapport = await decrementerStockCommande(
      [{ id: 1, qty: 2 }], // 2 portions × 0.5 = 1 L
      RESTAURANT_ID, COMMANDE_ID, 'Caissier Test',
    )

    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(rapport.decrements).toHaveLength(1)
    expect(rapport.decrements[0].decrement).toBe(1)
    expect(rapport.decrements[0].avant).toBe(10)
    expect(rapport.erreurs).toHaveLength(0)
  })

  it('logue un MouvementStock après le commit (best-effort)', async () => {
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 1 })])
    prisma.mouvementStock.create.mockResolvedValue({})

    await decrementerStockCommande([{ id: 1, qty: 1 }], RESTAURANT_ID, COMMANDE_ID)
    await new Promise(r => setTimeout(r, 0)) // attendre les microtasks fire-and-forget

    expect(prisma.mouvementStock.create).toHaveBeenCalledOnce()
    expect(prisma.mouvementStock.create.mock.calls[0][0].data).toMatchObject({
      type:      'sortie',
      source:    'commande',
      reference: COMMANDE_ID,
    })
  })
})

describe('decrementerStockCommande — alertes seuil', () => {
  it('publie une alerte SSE quand le stock passe sous le seuil', async () => {
    // stock = 3, decrement = 2, seuil = 2 → newStock = 1 ≤ seuil
    const stockItem = makeStockItem({ stock: 3, seuil: 2 })
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 2, stockItem })])

    const rapport = await decrementerStockCommande([{ id: 1, qty: 1 }], RESTAURANT_ID)

    expect(rapport.alertes).toHaveLength(1)
    expect(rapport.alertes[0].rupture).toBe(false)
    expect(rapport.alertes[0].stock).toBe(1)
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stock_alerte' }),
      RESTAURANT_ID,
    )
  })

  it('NE publie PAS d\'alerte seuil si stock reste au-dessus du seuil', async () => {
    const stockItem = makeStockItem({ stock: 10, seuil: 2 })
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 1, stockItem })])

    const rapport = await decrementerStockCommande([{ id: 1, qty: 1 }], RESTAURANT_ID)

    expect(rapport.alertes).toHaveLength(0)
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('decrementerStockCommande — rupture de stock', () => {
  it('détecte une rupture (stockApres < 0) et la signale dans rapport.alertes', async () => {
    // stock = 1, decrement = 3 → stockApres = -2
    const stockItem = makeStockItem({ stock: 1, seuil: 0 })
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 3, stockItem })])

    const rapport = await decrementerStockCommande([{ id: 1, qty: 1 }], RESTAURANT_ID)

    expect(rapport.alertes).toHaveLength(1)
    expect(rapport.alertes[0].rupture).toBe(true)
    expect(rapport.alertes[0].deficit).toBe(2)
  })

  it('mode bloquer=true : lève RUPTURE_STOCK avant tout prisma.$transaction', async () => {
    const stockItem = makeStockItem({ stock: 1, seuil: 0 })
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 3, stockItem })])
    prisma.stockItem.findMany.mockResolvedValue([
      { id: 'stock-1', nom: 'Huile', unite: 'L', stock: 1 },
    ])

    await expect(
      decrementerStockCommande([{ id: 1, qty: 1 }], RESTAURANT_ID, null, 'Test', { bloquer: true })
    ).rejects.toMatchObject({ code: 'RUPTURE_STOCK' })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('mode bloquer=true : passe sans erreur si stock suffisant', async () => {
    const stockItem = makeStockItem({ stock: 10, seuil: 0 })
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 1, stockItem })])
    prisma.stockItem.findMany.mockResolvedValue([
      { id: 'stock-1', nom: 'Huile', unite: 'L', stock: 10 },
    ])

    const rapport = await decrementerStockCommande(
      [{ id: 1, qty: 1 }], RESTAURANT_ID, null, 'Test', { bloquer: true }
    )
    expect(rapport.erreurs).toHaveLength(0)
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })
})

describe('decrementerStockCommande — robustesse', () => {
  it('agrège correctement plusieurs portions du même ingrédient', async () => {
    const stockItem = makeStockItem({ stock: 10 })
    prisma.recetteIngredient.findMany.mockResolvedValue([
      makeRecette({ menuItemId: 1, quantite: 1, stockItem }),
      makeRecette({ menuItemId: 2, quantite: 2, stockItem }),
    ])

    // 1 portion menu 1 (1L) + 2 portions menu 2 (2×2L=4L) → 5L total sur stock-1
    const rapport = await decrementerStockCommande(
      [{ id: 1, qty: 1 }, { id: 2, qty: 2 }], RESTAURANT_ID,
    )

    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(rapport.decrements[0].decrement).toBe(5)
  })

  it('retourne rapport.erreurs si la transaction échoue', async () => {
    prisma.recetteIngredient.findMany.mockResolvedValue([makeRecette({ quantite: 1 })])
    prisma.$transaction.mockRejectedValue(new Error('DB timeout'))

    const rapport = await decrementerStockCommande([{ id: 1, qty: 1 }], RESTAURANT_ID)

    expect(rapport.erreurs).toHaveLength(1)
    expect(rapport.erreurs[0].global).toBe(true)
    expect(rapport.erreurs[0].err).toMatch(/timeout/)
  })
})
