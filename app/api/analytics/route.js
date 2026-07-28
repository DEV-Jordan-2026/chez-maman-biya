import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || !['super_admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const periode = searchParams.get('periode') || '30'

  // Résoudre le restaurantId (super_admin peut filtrer par restaurant)
  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : session.restaurantId

  const depuis = new Date()
  depuis.setDate(depuis.getDate() - parseInt(periode))

  const commandes = await prisma.commande.findMany({
    where: {
      restaurantId: rid,
      status:       'livre',
      createdAt:    { gte: depuis },
    },
    orderBy: { createdAt: 'asc' },
  })

  // ── Ventes par jour ───────────────────────────────────────────────────────
  const parJour = {}
  for (const c of commandes) {
    const d = c.createdAt.toISOString().split('T')[0]
    if (!parJour[d]) parJour[d] = { ca: 0, nb: 0 }
    parJour[d].ca += c.total || 0
    parJour[d].nb += 1
  }
  const ventesJour = Object.entries(parJour).map(([date, v]) => ({ date, ...v }))

  // ── Top plats ─────────────────────────────────────────────────────────────
  const topPlats = {}
  for (const c of commandes) {
    const items = Array.isArray(c.items) ? c.items : []
    for (const it of items) {
      if (!it.name) continue
      if (!topPlats[it.name]) topPlats[it.name] = { nom: it.name, qte: 0, ca: 0 }
      topPlats[it.name].qte += it.qty || 1
      topPlats[it.name].ca  += (it.price || 0) * (it.qty || 1)
    }
  }
  const topPlatsList = Object.values(topPlats).sort((a, b) => b.qte - a.qte).slice(0, 10)

  // ── Heures de pointe ──────────────────────────────────────────────────────
  const parHeure = Array(24).fill(null).map((_, h) => ({ heure: h, nb: 0 }))
  for (const c of commandes) {
    const h = new Date(c.createdAt).getHours()
    parHeure[h].nb += 1
  }

  // ── Modes de paiement ─────────────────────────────────────────────────────
  const paiements = {}
  for (const c of commandes) {
    const p = c.paiement || 'inconnu'
    const cat = ['mtn', 'mtn_paye', 'orange', 'orange_paye', 'cinetpay', 'cinetpay_confirme'].includes(p)
      ? 'Mobile Money'
      : p === 'especes' ? 'Espèces'
      : p === 'livraison' ? 'Espèces livraison'
      : p === 'resto' ? 'Au restaurant'
      : 'Autre'
    if (!paiements[cat]) paiements[cat] = { label: cat, montant: 0, nb: 0 }
    paiements[cat].montant += c.total || 0
    paiements[cat].nb += 1
  }
  const paiementsList = Object.values(paiements).sort((a, b) => b.montant - a.montant)

  // ── Modes de livraison ────────────────────────────────────────────────────
  const modes = {}
  for (const c of commandes) {
    const m = c.mode || 'Livraison'
    if (!modes[m]) modes[m] = { label: m, nb: 0, ca: 0 }
    modes[m].nb += 1
    modes[m].ca += c.total || 0
  }

  // ── KPIs globaux ──────────────────────────────────────────────────────────
  const caTotal     = commandes.reduce((s, c) => s + (c.total || 0), 0)
  const nbCmd       = commandes.length
  const panier      = nbCmd > 0 ? Math.round(caTotal / nbCmd) : 0
  const clientsUniq = new Set(commandes.map(c => c.tel)).size

  return NextResponse.json({
    periode: parseInt(periode),
    kpis: { caTotal, nbCmd, panier, clientsUniq },
    ventesJour,
    topPlats: topPlatsList,
    heuresPointe: parHeure,
    paiements: paiementsList,
    modes: Object.values(modes),
  })
}
