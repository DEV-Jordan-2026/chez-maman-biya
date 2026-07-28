// app/api/analytics/previsions/route.js — v19
// Prévisions CA basées sur moyennes glissantes 28 jours.
//
// Fix v19 : la version précédente lisait AnalyticsDailySummary, une table
// jamais alimentée (pas de cron). On calcule désormais directement depuis
// les commandes livrées — même source que /api/analytics — ce qui garantit
// des données réelles dès le premier jour d'utilisation.

import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma           from '@/lib/db'

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['manager', 'super_admin'].includes(session.role))
    return NextResponse.json({ error: 'Accès restreint' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId

  // ── 1. Charger 28 jours de commandes réelles ──────────────────────────────
  const depuis = new Date()
  depuis.setDate(depuis.getDate() - 28)

  const commandes = await prisma.commande.findMany({
    where: {
      status:    'livre',
      createdAt: { gte: depuis },
      ...(restaurantId ? { restaurantId } : {}),
    },
    select: { total: true, items: true, createdAt: true },
  })

  // ── 2. Agréger par date et par jour de semaine ────────────────────────────
  const parDate       = {}   // { 'YYYY-MM-DD': { ca, parHeure:[...] } }
  const parDow        = Array(7).fill(null).map(() => ({ total: 0, count: 0 }))
  const parDowHeure   = Array(7).fill(null).map(() => Array(24).fill(0))
  const platsMap      = {}

  for (const c of commandes) {
    const date = c.createdAt.toISOString().split('T')[0]
    const dow  = c.createdAt.getDay()
    const hour = c.createdAt.getHours()
    const ca   = c.total || 0

    if (!parDate[date]) parDate[date] = { ca: 0 }
    parDate[date].ca += ca

    parDow[dow].total += ca
    parDow[dow].count  = (parDow[dow].count || 0) + 1
    parDowHeure[dow][hour] += ca

    // Top plats
    const items = Array.isArray(c.items) ? c.items : []
    for (const it of items) {
      if (!it.name) continue
      if (!platsMap[it.name]) platsMap[it.name] = { nom: it.name, qte: 0, ca: 0 }
      platsMap[it.name].qte += it.qty || 1
      platsMap[it.name].ca  += (it.price || 0) * (it.qty || 1)
    }
  }

  // Moyenne CA par jour de semaine
  const moyParJour = parDow.map(d => d.count > 0 ? Math.round(d.total / d.count) : 0)

  // ── 3. Prévisions 7 prochains jours ──────────────────────────────────────
  const today     = new Date()
  const previsions = []

  for (let i = 1; i <= 7; i++) {
    const d    = new Date(today)
    d.setDate(d.getDate() + i)
    const dow  = d.getDay()
    const date = d.toISOString().split('T')[0]

    // CA semaine précédente même jour
    const dPrec = new Date(today)
    dPrec.setDate(dPrec.getDate() + i - 7)
    const datePrec = dPrec.toISOString().split('T')[0]
    const caPrec   = parDate[datePrec]?.ca || 0

    const caPrev = moyParJour[dow]
    const alerte = caPrec > 0 && caPrev < caPrec * 0.8

    previsions.push({
      date,
      jourLabel:           JOURS[dow],
      caPrevision:         caPrev,
      caSemainePrecedente: caPrec,
      alerte,
    })
  }

  // ── 4. Heatmap jours × heures ─────────────────────────────────────────────
  const heatmap = parDowHeure  // Array[7][24]

  // ── 5. Top plats ──────────────────────────────────────────────────────────
  const topPlats = Object.values(platsMap).sort((a, b) => b.qte - a.qte).slice(0, 10)

  // Suggestion pour demain : quantité moyenne × 1.1
  const demainDow = (today.getDay() + 1) % 7
  const nbDemainHistorique = commandes.filter(c => c.createdAt.getDay() === demainDow).length
  const suggPlats = topPlats.slice(0, 5).map(p => ({
    ...p,
    suggestion: nbDemainHistorique > 0
      ? Math.ceil((p.qte / nbDemainHistorique) * 1.1)
      : p.qte,
  }))

  return NextResponse.json({
    previsions,
    heatmap,
    topPlats,
    suggPlats,
    moyParJour,
    nbJoursAnalyses: Object.keys(parDate).length,
    source:          'commandes_directes',   // vs 'analytics_daily' (ancienne version)
  })
}
