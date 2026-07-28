// lib/stockDecrement.js — v18
// Décrément automatique du stock lors de la validation d'une commande
// + enregistrement d'un MouvementStock pour chaque décrément
// + détection des ruptures de stock (stockApres < 0)
//
// Appelé par :
//   - POST /api/commandes/[id]/valider   (action: 'accepter')
//   - PATCH /api/commandes/[id]          (status: 'en_cours' — commandes table)
//
// Stratégie :
//   1. Pour chaque article (item) de la commande, cherche ses ingrédients en base
//   2. Multiplie quantite_recette × qty_commandée
//   3. Détecte les ruptures (stockApres < 0) → flag rupture: true dans rapport.alertes
//   4. Décrémente le stock (min 0 — jamais négatif en base)
//   5. Logue un MouvementStock (type='sortie', source='commande') — best-effort
//   6. Si stock résultant ≤ seuil → publie une alerte SSE
//   7. Retourne un rapport {decrements, alertes, erreurs}
//
// Paramètre optionnel `bloquer` (défaut: false) :
//   Si true → passe de simulation complète avant tout update BD.
//   En cas de rupture détectée, throw Object.assign(new Error('RUPTURE_STOCK'), { code, ruptures })
//   avant tout prisma.stockItem.update. Rétrocompatible avec les appelants existants (2 params).
//
// Paramètre optionnel `simulationSeulement` (défaut: false) :
//   Si true ET bloquer true → vérifie les stocks et throw RUPTURE_STOCK si insuffisant,
//   mais ne fait AUCUN write en base (utile pour vérifier avant de committer une transaction).

import prisma        from '@/lib/db'
import { publish }   from '@/lib/eventBus'

/**
 * @param {Array<{name?: string, nom?: string, id?: number, qty?: number}>} items
 * @param {string|null} restaurantId
 * @param {string|null} [commandeId]   — optionnel, stocké comme référence dans le mouvement
 * @param {string}      [auteur]       — nom de l'utilisateur déclencheur (défaut: 'Système')
 * @param {object}      [options]
 * @param {boolean}     [options.bloquer=false]           — si true, bloque en cas de rupture avant tout update
 * @param {boolean}     [options.simulationSeulement=false] — si true+bloquer, vérifie sans écrire en BD
 * @returns {Promise<{ decrements: Array, alertes: Array, erreurs: Array }>}
 */
export async function decrementerStockCommande(items, restaurantId = null, commandeId = null, auteur = 'Système', { bloquer = false, simulationSeulement = false } = {}) {
  const rapport = { decrements: [], alertes: [], erreurs: [] }

  if (!Array.isArray(items) || items.length === 0) return rapport

  try {
    // Extraire les menuItemId depuis les items de la commande
    const menuItemIds = items
      .map(it => parseInt(it.id || it.menuItemId))
      .filter(id => !isNaN(id) && id > 0)

    if (menuItemIds.length === 0) return rapport

    // Charger toutes les recettes concernées en une seule requête
    const recettes = await prisma.recetteIngredient.findMany({
      where: {
        menuItemId: { in: menuItemIds },
        ...(restaurantId ? { restaurantId } : {}),
      },
      include: { stockItem: true },
    })

    if (recettes.length === 0) return rapport

    // Agréger les quantités à décrémenter par stockItemId
    const decrementMap = new Map()

    for (const item of items) {
      const menuItemId = parseInt(item.id || item.menuItemId)
      if (isNaN(menuItemId)) continue
      const qty = Math.max(1, parseInt(item.qty) || 1)

      const recettesPlat = recettes.filter(r => r.menuItemId === menuItemId)
      for (const r of recettesPlat) {
        const existing  = decrementMap.get(r.stockItemId)
        const decrement = r.quantite * qty
        if (existing) {
          existing.totalDecrement += decrement
        } else {
          decrementMap.set(r.stockItemId, {
            stockItem:      r.stockItem,
            totalDecrement: decrement,
            menuItemNom:    r.menuItemNom,
          })
        }
      }
    }

    if (decrementMap.size === 0) return rapport

    // ── Passe de simulation si bloquer === true ────────────────────────────────
    if (bloquer) {
      const stockItemIds = Array.from(decrementMap.keys())
      const stocksActuels = await prisma.stockItem.findMany({
        where: { id: { in: stockItemIds } },
        select: { id: true, nom: true, unite: true, stock: true },
      })

      const stockMap = new Map(stocksActuels.map(s => [s.id, s]))
      const ruptures = []

      for (const [stockItemId, { totalDecrement }] of decrementMap.entries()) {
        const s = stockMap.get(stockItemId)
        if (!s) continue
        const stockApres = s.stock - totalDecrement
        if (stockApres < 0) {
          ruptures.push({
            id:          stockItemId,
            nom:         s.nom,
            unite:       s.unite,
            stockActuel: s.stock,
            deficit:     Math.abs(stockApres),
          })
        }
      }

      if (ruptures.length > 0) {
        throw Object.assign(
          new Error('RUPTURE_STOCK'),
          { code: 'RUPTURE_STOCK', ruptures }
        )
      }

      // FIX I1 — Si simulationSeulement: true, retourner sans écrire en base
      // Utilisé par valider/route.js et vente-directe/route.js pour vérifier
      // les stocks AVANT de committer la transaction commande.
      if (simulationSeulement) return rapport
    }

    // ── Phase 1 : calcul en mémoire (avant tout write) ─────────────────────
    const planDecrement = []
    for (const [stockItemId, { stockItem, totalDecrement }] of decrementMap.entries()) {
      const stockAvant = stockItem.stock
      const stockApres = stockAvant - totalDecrement  // Valeur réelle (peut être négative)
      const newStock   = Math.max(0, stockApres)      // Valeur stockée en base (jamais négative)

      if (stockApres < 0) {
        const alerteRupture = {
          id:      stockItemId,
          nom:     stockItem.nom,
          stock:   newStock,
          deficit: Math.abs(stockApres),
          seuil:   stockItem.seuil,
          unite:   stockItem.unite,
          rupture: true,
        }
        rapport.alertes.push(alerteRupture)
      }

      planDecrement.push({ stockItemId, stockItem, stockAvant, stockApres, newStock, totalDecrement })
    }

    // ── Phase 2 : transaction atomique — tous les updates ou aucun ─────────
    await prisma.$transaction(
      planDecrement.map(({ stockItemId, newStock }) =>
        prisma.stockItem.update({
          where: { id: stockItemId },
          data:  { stock: newStock, updatedAt: new Date() },
        })
      )
    )

    // ── Phase 3 : post-commit — alertes SSE + logs mouvements (best-effort) ─
    for (const { stockItemId, stockItem, stockAvant, newStock, totalDecrement } of planDecrement) {
      rapport.decrements.push({
        stockItemId,
        nom:       stockItem.nom,
        avant:     stockAvant,
        decrement: totalDecrement,
        apres:     newStock,
        unite:     stockItem.unite,
      })

      // Alertes SSE rupture
      const alerteRupture = rapport.alertes.find(a => a.id === stockItemId && a.rupture)
      if (alerteRupture) {
        publish({ type: 'stock_alerte', data: alerteRupture }, restaurantId)
      }

      // Alerte SSE seuil (hors rupture)
      if (!alerteRupture && stockItem.seuil !== null && newStock <= stockItem.seuil) {
        const alerte = {
          id:      stockItemId,
          nom:     stockItem.nom,
          stock:   newStock,
          seuil:   stockItem.seuil,
          unite:   stockItem.unite,
          rupture: false,
        }
        rapport.alertes.push(alerte)
        publish({ type: 'stock_alerte', data: alerte }, restaurantId)
      }

      // Log mouvement (non-bloquant)
      prisma.mouvementStock.create({
        data: {
          stockItemId,
          restaurantId: restaurantId || stockItem.restaurantId || null,
          type:         'sortie',
          source:       'commande',
          quantite:     totalDecrement,
          stockAvant,
          stockApres:   newStock,
          reference:    commandeId,
          auteur,
          note:         null,
        },
      }).catch(err => console.error('[stockDecrement] mouvement log failed:', err.message))
    }

  } catch (err) {
    // Remonter les erreurs RUPTURE_STOCK sans les absorber
    if (err.code === 'RUPTURE_STOCK') throw err
    rapport.erreurs.push({ global: true, err: err.message })
    console.error('[stockDecrement] Erreur globale:', err.message)
  }

  if (rapport.decrements.length > 0) {
    const ruptures = rapport.alertes.filter(a => a.rupture).length
    console.log(
      `[stockDecrement] ${rapport.decrements.length} décrément(s), ` +
      `${rapport.alertes.length} alerte(s)` +
      (ruptures > 0 ? `, ${ruptures} RUPTURE(S)` : '')
    )
  }

  return rapport
}
