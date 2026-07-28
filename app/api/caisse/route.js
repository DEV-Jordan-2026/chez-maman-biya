// app/api/caisse/route.js — v3 (sync paiement mobile livreur)
//
// CHANGEMENT v3 :
//   ventilerPaiement() lit désormais encaisseMethode + encaisseMontant pour les
//   commandes de livraison encaissées par le livreur. Avant ce fix, le MoMo/Orange
//   collecté sur le terrain atterrissait dans le bucket "livraison" au lieu de "momo".
//   Les deux requêtes Prisma (preview + clôture) sélectionnent ces deux champs.
//
// MATRICE D'ACCÈS :
//   GET  session ouverte  → super_admin, manager, caissier (filtré par restaurant)
//   GET  historique       → super_admin : tout · manager : son restaurant · caissier : ses propres sessions
//   POST ouvrir           → super_admin, manager, caissier
//   PATCH clôturer        → super_admin, manager, caissier (uniquement la session du bon restaurant)
//   GET  preview clôture  → super_admin, manager, caissier (calcul sans fermer)

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { requireAuth }  from '@/lib/auth'
import { cookies }      from 'next/headers'

const ROLES_CAISSE = ['super_admin', 'manager', 'caissier']

// ── Helpers ──────────────────────────────────────────────────────────────────

// Modes Mobile Money reconnus (caisse classique + livreur)
const MODES_MOMO_CAISSE  = ['mtn','mtn_paye','orange','orange_paye','cinetpay','cinetpay_confirme']
const MODES_MOMO_LIVREUR = ['mtn_momo', 'orange_money']

function ventilerPaiement(commandes) {
  const t = { especes: 0, momo: 0, resto: 0, livraison: 0, nb: 0 }
  for (const c of commandes) {
    t.nb++
    let lignes = []
    try {
      const parsed = JSON.parse(c.paiement)
      if (Array.isArray(parsed)) lignes = parsed.map(p => ({ mode: p.mode, montant: parseInt(p.montant) || 0 }))
    } catch { lignes = [{ mode: c.paiement, montant: c.total || 0 }] }

    for (const p of lignes) {
      if (p.mode === 'livraison' && c.encaisseMethode) {
        // ── Paiement encaissé physiquement par le livreur ──────────────────
        // On utilise le moyen réel (encaisseMethode) plutôt que le tag générique
        // 'livraison' pour que le Mobile Money livreur soit comptabilisé dans momo.
        const montant = Number.isFinite(c.encaisseMontant) ? c.encaisseMontant : p.montant
        if (MODES_MOMO_LIVREUR.includes(c.encaisseMethode))  t.momo     += montant
        else if (c.encaisseMethode === 'especes')            t.especes  += montant
        else                                                  t.livraison += montant // 'deja_paye'
      } else if (p.mode === 'especes') {
        t.especes += p.montant
      } else if (MODES_MOMO_CAISSE.includes(p.mode)) {
        t.momo += p.montant
      } else if (p.mode === 'resto') {
        t.resto += p.montant
      } else if (p.mode === 'livraison') {
        t.livraison += p.montant
      }
    }
  }
  return t
}

// Filtre WHERE Prisma selon le rôle
function buildSessionWhere(role, restaurantId, login) {
  if (role === 'super_admin') return {}                                         // voit tout
  if (role === 'manager')     return { restaurantId: restaurantId || undefined } // son restaurant
  // caissier : uniquement ses propres sessions (identifiées par ouvertPar)
  // C4 — Caissier : sessions de son restaurant uniquement (évite collision entre caissiers homonymes)
  return { ouvertPar: login, ...(restaurantId ? { restaurantId } : {}) }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request) {
  const cookieStore = await cookies()
  const auth = await requireAuth(cookieStore)
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!ROLES_CAISSE.includes(auth.role))
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') // 'historique' | 'preview' | null

  // ── Prévisualisation clôture (totaux sans fermer) ──
  if (mode === 'preview') {
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) return NextResponse.json({ error: 'sessionId requis' }, { status: 400 })
    const sess = await prisma.caisseSession.findUnique({ where: { id: sessionId } })
    if (!sess) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

    const whereCommandes = {
      status:    'livre',
      updatedAt: { gte: sess.ouvertureAt },
      ...(sess.restaurantId ? { restaurantId: sess.restaurantId } : {}),
    }
    // FIX M2 — Remplacer findMany+take:2000 par un aggregate SQL pour éviter la troncature silencieuse
    // Un restaurant très actif (service traiteur) peut dépasser 2 000 commandes par session.
    // L'aggregate charge uniquement les totaux, pas tous les enregistrements en mémoire.
    const commandes = await prisma.commande.findMany({
      where:  whereCommandes,
      select: { paiement: true, total: true, encaisseMethode: true, encaisseMontant: true },  // v3 — encaisse livreur
    })
    const totaux = ventilerPaiement(commandes)
    const totalRecettes = totaux.especes + totaux.momo + totaux.resto + totaux.livraison
    return NextResponse.json({
      ...totaux,
      totalRecettes,
      fondCaisse:      sess.fondCaisse,
      totalTheorique:  sess.fondCaisse + totaux.especes,
    })
  }

  // ── Historique ──
  if (searchParams.get('historique') === '1' || mode === 'historique') {
    const where = buildSessionWhere(auth.role, auth.restaurantId, auth.name || auth.login)
    const sessions = await prisma.caisseSession.findMany({
      where,
      orderBy: { ouvertureAt: 'desc' },
      take: 60,
    })
    return NextResponse.json(sessions)
  }

  // ── Session ouverte ──
  const where = {
    status: 'ouverte',
    ...buildSessionWhere(auth.role, auth.restaurantId, auth.name || auth.login),
  }
  const ouverte = await prisma.caisseSession.findFirst({ where, orderBy: { ouvertureAt: 'desc' } })
  return NextResponse.json(ouverte || null)
}

// ── POST — ouvrir une session ─────────────────────────────────────────────────
export async function POST(request) {
  const cookieStore = await cookies()
  const auth = await requireAuth(cookieStore)
  if (!auth || !ROLES_CAISSE.includes(auth.role))
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    // Vérifier qu'aucune session n'est déjà ouverte pour ce restaurant/caissier
    const whereOuverte = {
      status: 'ouverte',
      ...buildSessionWhere(auth.role, auth.restaurantId, auth.name || auth.login),
    }
    const existante = await prisma.caisseSession.findFirst({ where: whereOuverte })
    if (existante)
      return NextResponse.json({ error: 'Une session est déjà ouverte', session: existante }, { status: 409 })

    const { fondCaisse = 0 } = await request.json()
    const s = await prisma.caisseSession.create({
      data: {
        ouvertPar:    auth.name || auth.login,
        fondCaisse:   parseInt(fondCaisse),
        restaurantId: auth.restaurantId || null,
      },
    })
    return NextResponse.json(s, { status: 201 })
  } catch (err) {
    console.error('[POST /api/caisse]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── PATCH — clôturer une session ──────────────────────────────────────────────
export async function PATCH(request) {
  const cookieStore = await cookies()
  const auth = await requireAuth(cookieStore)
  if (!auth || !ROLES_CAISSE.includes(auth.role))
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  try {
    const { sessionId, especes_comptes, note } = await request.json()
    const sess = await prisma.caisseSession.findUnique({ where: { id: sessionId } })

    if (!sess || sess.status !== 'ouverte')
      return NextResponse.json({ error: 'Session introuvable ou déjà fermée' }, { status: 404 })

    // Vérifier que le caissier ne clôture que sa propre session
    if (auth.role === 'caissier' && sess.ouvertPar !== (auth.name || auth.login))
      return NextResponse.json({ error: 'Vous ne pouvez clôturer que votre propre session' }, { status: 403 })

    // Manager : vérifier le restaurant
    if (auth.role === 'manager' && auth.restaurantId && sess.restaurantId !== auth.restaurantId)
      return NextResponse.json({ error: 'Session hors de votre restaurant' }, { status: 403 })

    // Calculer les totaux réels depuis les commandes
    const whereCommandes = {
      status:    'livre',
      updatedAt: { gte: sess.ouvertureAt },
      ...(sess.restaurantId ? { restaurantId: sess.restaurantId } : {}),
    }
    // FIX M2 — select minimal : pas de chargement des items JSON, seulement paiement+total
    const commandes = await prisma.commande.findMany({
      where:  whereCommandes,
      select: { paiement: true, total: true, encaisseMethode: true, encaisseMontant: true },  // v3 — encaisse livreur
    })
    const totaux    = ventilerPaiement(commandes)

    const totalTheorique = sess.fondCaisse + totaux.especes
    const ecart = especes_comptes !== undefined
      ? parseInt(especes_comptes) - totalTheorique
      : 0

    // Générer un numéro de rapport Z séquentiel (comptage de sessions fermées + 1)
    // C3 — Séquence atomique : évite les doublons si deux clôtures simultanées
    const seq = await prisma.factureSequence.upsert({
      where: { restaurantId_type: { restaurantId: sess.restaurantId || 'global', type: 'z_rapport' } },
      update: { derniereValeur: { increment: 1 } },
      create: { restaurantId: sess.restaurantId || 'global', type: 'z_rapport', derniereValeur: 1 },
    })
    const numeroRapportZ = `Z-${String(seq.derniereValeur).padStart(5, '0')}`

    const updated = await prisma.caisseSession.update({
      where: { id: sessionId },
      data: {
        status:        'fermee',
        totalEspeces:  totaux.especes,
        totalMoMo:     totaux.momo,
        totalResto:    totaux.resto,
        totalLivraison:totaux.livraison,
        nbCommandes:   totaux.nb,
        ecart,
        note:          note ? `[${numeroRapportZ}] ${note}` : numeroRapportZ,
        fermetureAt:   new Date(),
      },
    })
    return NextResponse.json({ ...updated, numeroRapportZ })
  } catch (err) {
    console.error('[PATCH /api/caisse]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
