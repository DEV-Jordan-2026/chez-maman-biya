// app/api/achats/previsions/route.js
// Prévisions d'achats intelligentes
//
// Algorithme :
//   1. Charge les analytics des 28 derniers jours (ventes réelles par plat/jour)
//   2. Calcule la consommation moyenne d'ingrédients par jour de semaine
//      via les recettes configurées (RecetteIngredient)
//   3. Projette sur les 7 prochains jours en tenant compte du profil hebdo
//   4. Compare avec le stock actuel → calcule la quantité à commander
//   5. Détermine l'urgence (critique / haute / normale) selon le ratio stock/besoin
//
// GET /api/achats/previsions?restaurantId=xxx&horizon=7
//
// Retourne :
//   { suggestions: [...], resume: {...}, topPlats: [...], fiabilite: 0-100 }

import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { requireAuth }  from '@/lib/auth'
import prisma           from '@/lib/db'

const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const HORIZON_DEFAULT = 7  // jours à prévoir

export async function GET(request) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['manager','super_admin'].includes(session.role))
    return NextResponse.json({ error: 'Accès restreint — manager ou super_admin requis' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId || null
  const horizon      = Math.min(30, Math.max(1, parseInt(searchParams.get('horizon') || HORIZON_DEFAULT)))

  try {
    // ── 1. Données historiques : 28 jours de commandes réelles ────────────────
    const depuis = new Date()
    depuis.setDate(depuis.getDate() - 28)

    const commandes = await prisma.commande.findMany({
      where: {
        status: 'livre',
        updatedAt: { gte: depuis },
        ...(restaurantId ? { restaurantId } : {}),
      },
      select: { items: true, updatedAt: true, total: true },
    })

    // ── 2. Quantité vendue par plat (menuItemId ou name) par jour de semaine ──
    // Structure : { menuItemId/name → { dowQte: [0,0,0,0,0,0,0], totalQte: N } }
    const ventesParPlat = {}  // clé = name (dénormalisé dans items)

    for (const cmd of commandes) {
      const dow   = new Date(cmd.updatedAt).getDay()
      const items = Array.isArray(cmd.items) ? cmd.items : []

      for (const it of items) {
        const key = String(it.id || it.name || '?')
        if (!ventesParPlat[key]) {
          ventesParPlat[key] = {
            menuItemId: parseInt(it.id) || null,
            nom:        it.name || it.nom || key,
            emoji:      it.emoji || '🍽️',
            price:      it.price || 0,
            dowQte:     Array(7).fill(0),
            nbJours:    Array(7).fill(0),
            totalQte:   0,
          }
        }
        ventesParPlat[key].dowQte[dow]  += it.qty || 1
        ventesParPlat[key].totalQte     += it.qty || 1
      }
    }

    // Compter le nombre de jours distincts par DOW dans la fenêtre 28j
    const nbJoursParDow = Array(7).fill(0)
    const joursDistincts = new Set(commandes.map(c => c.updatedAt.toISOString().split('T')[0]))
    for (const d of joursDistincts) {
      nbJoursParDow[new Date(d).getDay()]++
    }

    // Moyenne de ventes par plat par DOW (qte/jour de ce DOW)
    for (const v of Object.values(ventesParPlat)) {
      v.moyParDow = v.dowQte.map((qte, dow) =>
        nbJoursParDow[dow] > 0 ? qte / nbJoursParDow[dow] : 0
      )
    }

    const nbJoursAnalyses = joursDistincts.size
    // Score de fiabilité : 100% si 28j de données, proportionnel sinon
    const fiabilite = Math.min(100, Math.round((nbJoursAnalyses / 28) * 100))

    // ── 3. Recettes configurées ───────────────────────────────────────────────
    const recettes = await prisma.recetteIngredient.findMany({
      where: restaurantId ? { restaurantId } : {},
      include: { stockItem: true },
    })

    // ── 4. Stocks actuels ─────────────────────────────────────────────────────
    const stocks = await prisma.stockItem.findMany({
      where: restaurantId ? { restaurantId } : {},
    })
    const stockMap = Object.fromEntries(stocks.map(s => [s.id, s]))

    // ── 5. Projection consommation sur l'horizon ──────────────────────────────
    // Pour chaque ingrédient : somme(recette.quantite × ventes_prévues_du_plat_par_jour)

    const besoinsMap = {}  // stockItemId → { stockItem, besoinTotal, detail }

    const today = new Date()

    for (let i = 1; i <= horizon; i++) {
      const d   = new Date(today)
      d.setDate(d.getDate() + i)
      const dow = d.getDay()

      // Ventes prévues ce jour : moy du DOW × facteur de tendance (dernier vs avg)
      for (const [key, vente] of Object.entries(ventesParPlat)) {
        const qtePrevue = vente.moyParDow[dow]
        if (qtePrevue <= 0) continue

        const menuItemId = vente.menuItemId
        if (!menuItemId) continue

        // Trouver les ingrédients de ce plat
        const ingredientsPlat = recettes.filter(r => r.menuItemId === menuItemId)
        if (ingredientsPlat.length === 0) continue

        for (const ingr of ingredientsPlat) {
          const sid = ingr.stockItemId
          if (!besoinsMap[sid]) {
            besoinsMap[sid] = {
              stockItem:    ingr.stockItem,
              besoinTotal:  0,
              detail:       [],
            }
          }
          const consommation = ingr.quantite * qtePrevue
          besoinsMap[sid].besoinTotal += consommation
          besoinsMap[sid].detail.push({
            plat:   vente.nom,
            jour:   JOURS[dow],
            qte:    consommation,
          })
        }
      }
    }

    // ── 6. Calcul suggestion d'achat par ingrédient ──────────────────────────
    const suggestions = []

    for (const [sid, besoin] of Object.entries(besoinsMap)) {
      const stock     = stockMap[sid]
      if (!stock) continue

      const stockActuel  = stock.stock
      const besoinNet    = Math.max(0, besoin.besoinTotal - stockActuel)
      const ratio        = stockActuel / Math.max(besoin.besoinTotal, 0.001)

      if (besoinNet <= 0 && ratio > 1.5) continue  // Stock largement suffisant

      // Arrondir à l'unité d'achat raisonnable (kg → 0.5kg, L → 0.5L, pièce → 1)
      const qteSuggested = arrondirQte(besoinNet * 1.15, stock.unite) // 15% marge sécurité

      // Urgence
      let urgence = 'normale'
      if (ratio < 0.2 || stockActuel <= stock.seuil)         urgence = 'critique'
      else if (ratio < 0.5 || stockActuel < stock.seuil * 2) urgence = 'haute'

      // Estimation coût (si prix unitaire connu dans notes de frais précédentes — sinon null)
      const montantEstime = null  // À enrichir quand l'historique prix fournisseur existera

      suggestions.push({
        stockItemId:   sid,
        nom:           stock.nom,
        unite:         stock.unite,
        stockActuel,
        seuil:         stock.seuil,
        besoinBrut:    Math.round(besoin.besoinTotal * 100) / 100,
        besoinNet:     Math.round(besoinNet * 100) / 100,
        qteSuggested,
        urgence,
        ratio:         Math.round(ratio * 100) / 100,
        platsImpactes: [...new Set(besoin.detail.map(d => d.plat))],
        montantEstime,
      })
    }

    // Trier : critiques d'abord, puis par besoin net décroissant
    suggestions.sort((a, b) => {
      const ord = { critique: 0, haute: 1, normale: 2 }
      const cmp = ord[a.urgence] - ord[b.urgence]
      return cmp !== 0 ? cmp : b.besoinNet - a.besoinNet
    })

    // ── 7. Résumé ─────────────────────────────────────────────────────────────
    const resume = {
      horizon,
      nbSuggestions:  suggestions.length,
      nbCritiques:    suggestions.filter(s => s.urgence === 'critique').length,
      nbHautes:       suggestions.filter(s => s.urgence === 'haute').length,
      nbJoursAnalyses,
      fiabilite,
      dateGeneration: new Date().toISOString(),
    }

    // Top plats sur la période (pour affichage contexte)
    const topPlats = Object.values(ventesParPlat)
      .sort((a, b) => b.totalQte - a.totalQte)
      .slice(0, 8)
      .map(v => ({ nom: v.nom, emoji: v.emoji, totalQte: v.totalQte }))

    return NextResponse.json({ suggestions, resume, topPlats })

  } catch (err) {
    console.error('[GET /api/achats/previsions]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function arrondirQte(qte, unite) {
  if (qte <= 0) return 0
  const u = (unite || '').toLowerCase()
  if (['kg', 'l', 'litre', 'litre(s)'].includes(u)) {
    // Arrondir au 0.5 supérieur
    return Math.ceil(qte * 2) / 2
  }
  if (['g', 'ml', 'cl'].includes(u)) {
    // Arrondir à la centaine supérieure
    return Math.ceil(qte / 100) * 100
  }
  // Pièces, sachets, boîtes → arrondir à l'entier supérieur
  return Math.ceil(qte)
}
