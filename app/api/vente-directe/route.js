// app/api/vente-directe/route.js
// Crée une commande ET l'encaisse immédiatement — usage caissier uniquement
// Fixes B1 (stock décrémenté), B2 (total revalidé serveur), L4 (items sanitizés)
// v4 — FIX-C1 : numeroFacture calculé depuis la valeur retournée par upsert (atomique)
//      FIX-C3 : stock bloquant (bloquer: true) avec gestion RUPTURE_STOCK
// v5 — FIX-C4 : séquence globale pour éviter collision P2002 cross-restaurant
//      FIX-C5 : réduction -10% appliquée côté serveur (miroir du calcul client)
// v6 — FIX-C6 : synchronisation atomique de la séquence via GREATEST()
//      Remplace le retry-loop (qui s'épuisait sur les anciens enregistrements per-restaurant)
//      par un INSERT … ON CONFLICT DO UPDATE SET derniereValeur = GREATEST(…)
//      qui pousse la séquence globale au-dessus du MAX existant en une seule requête.

import { NextResponse }   from 'next/server'
import prisma              from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { decrementerStockCommande } from '@/lib/stockDecrement'
import { cookies }         from 'next/headers'
import { randomBytes }     from 'crypto'
import { signerFacture, urlQR } from '@/lib/factureQR'

const ROLES_CAISSE = ['super_admin', 'manager', 'caissier']

function genId() {
  return 'CMD-' + randomBytes(4).toString('hex').toUpperCase()
}

// ── FIX-C6 : réservation du numéro de facture ────────────────────────────────
// Stratégie :
//   1. UPSERT atomique avec GREATEST() : pousse la séquence globale au-dessus du MAX
//      des FAC-{annee}-XXXXXX déjà présents en base, sans jamais la rétrograder.
//      Idempotent et safe sous concurrence (deux requêtes simultanées obtiennent
//      des valeurs différentes grâce à l'incrément PostgreSQL atomique).
//   2. UPDATE increment:1 → chaque appel concurrent obtient un numéro distinct.
//   3. Pas de findUnique / pas de retry — l'unicité est garantie structurellement.
//
// Historique du bug :
//   v5 utilisait un retry-loop (max 5) qui s'épuisait car les numéros 000001-000006
//   existaient déjà (créés par les anciennes séquences per-restaurant avant v5).
async function reserverNumeroFacture(annee) {
  const SEQ_BUCKET = 'global'
  const prefixe    = `FAC-${annee}-`
  const longueur   = prefixe.length + 6   // ex: "FAC-2026-" (9) + "000006" (6) = 15

  // Étape 1 — Synchronisation atomique : GREATEST(séquence actuelle, MAX existant en base)
  // Garantit que la séquence démarre toujours au-dessus de tous les enregistrements
  // antérieurs, quelle que soit leur origine (per-restaurant, tests, migrations, etc.)
  await prisma.$executeRaw`
    INSERT INTO facture_sequences
      (id, "restaurantId", type, "derniereValeur", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid(),
      ${SEQ_BUCKET},
      'vente_directe',
      COALESCE((
        SELECT MAX(CAST(REPLACE("numeroFacture", ${prefixe}, '') AS INTEGER))
        FROM   commandes
        WHERE  "numeroFacture" LIKE ${prefixe + '%'}
        AND    LENGTH("numeroFacture") = ${longueur}
      ), 0),
      NOW(), NOW()
    ON CONFLICT ("restaurantId", type) DO UPDATE
      SET "derniereValeur" = GREATEST(
            facture_sequences."derniereValeur",
            EXCLUDED."derniereValeur"
          ),
          "updatedAt" = NOW()
  `

  // Étape 2 — Incrément atomique depuis le bon point de départ
  const seq = await prisma.factureSequence.update({
    where: { restaurantId_type: { restaurantId: SEQ_BUCKET, type: 'vente_directe' } },
    data:  { derniereValeur: { increment: 1 } },
  })

  return `${prefixe}${String(seq.derniereValeur).padStart(6, '0')}`
}

// ── FIX-C5 : réduction -10% (miroir exact du calcul CaisseDirecteTab) ────────
function calculerTotal(itemsSanitizes) {
  const sousTotal = itemsSanitizes.reduce((s, it) => s + it.price * it.qty, 0)
  const reduction  = sousTotal >= 15000 ? Math.round(sousTotal * 0.10) : 0
  return { sousTotal, reduction, total: sousTotal - reduction }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)

  if (!session || !ROLES_CAISSE.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const {
      client    = 'Client sur place',
      tel       = '000000000',
      items,
      total,
      paiement  = 'especes',
      note      = null,
      nbCouverts = 1,
    } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Aucun article sélectionné' }, { status: 400 })
    }
    if (!total || total <= 0) {
      return NextResponse.json({ error: 'Total invalide' }, { status: 400 })
    }

    // B2 — Sanitize et validation des items (L4) avant toute persistance
    const itemsSanitizes = items.slice(0, 50).map(it => ({
      id:    parseInt(it.id) || 0,
      name:  String(it.name || '').slice(0, 100),
      price: Math.max(0, parseInt(it.price) || 0),
      qty:   Math.max(1, Math.min(99, parseInt(it.qty) || 1)),
    }))

    // FIX-C5 — Revalidation du total avec réduction côté serveur
    const { sousTotal, reduction, total: totalServeur } = calculerTotal(itemsSanitizes)
    if (totalServeur <= 0) {
      return NextResponse.json({ error: 'Total calculé invalide' }, { status: 422 })
    }
    if (Math.abs(totalServeur - Number(total)) > 50) {
      console.warn(
        `[vente-directe] Écart résiduel client/serveur — ` +
        `client: ${total}, serveur: ${totalServeur} ` +
        `(sousTotal: ${sousTotal}, réduction: ${reduction}) ` +
        `(caissier: ${session.name || session.login})`
      )
    }

    // FIX-C3 — Vérification stock AVANT création commande (mode bloquant)
    try {
      await decrementerStockCommande(
        itemsSanitizes,
        session.restaurantId || null,
        null,
        session.name || session.login,
        { bloquer: true, simulationSeulement: true }
      )
    } catch (stockErr) {
      if (stockErr.code === 'RUPTURE_STOCK') {
        return NextResponse.json({
          error: 'Stock insuffisant pour cette vente',
          ruptures: stockErr.ruptures,
        }, { status: 409 })
      }
      console.warn('[vente-directe] Vérification stock échouée (non bloquant):', stockErr.message)
    }

    // FIX-C1 + FIX-C6 — Numéro de facture atomique et globalement unique
    const commandeId    = genId()
    const annee         = new Date().getFullYear()
    const createdAt     = new Date()
    const numeroFacture = await reserverNumeroFacture(annee)

    // Signature HMAC (Web Crypto — async)
    const qrHash = await signerFacture({
      id:           commandeId,
      numeroFacture,
      total:        totalServeur,
      restaurantId: session.restaurantId,
      createdAt,
    })
    const qrUrl = urlQR(commandeId, qrHash)

    // Création commande
    const commande = await prisma.commande.create({
      data: {
        id:            commandeId,
        restaurantId:  session.restaurantId,
        client:        client.trim() || 'Client sur place',
        tel:           tel.trim() || '000000000',
        mode:          'Sur place',
        items:         itemsSanitizes,
        total:         totalServeur,
        addr:          null,
        note:          note || `Vente directe caisse — ${session.name || session.login}`,
        paiement,
        status:        'livre',
        numeroFacture,
        qrHash,
      },
    })

    // FIX-C3 — Décrémenter le stock (simulation déjà faite, commit réel ici)
    try {
      const itemsParsed = Array.isArray(commande.items)
        ? commande.items
        : (typeof commande.items === 'string' ? JSON.parse(commande.items) : [])
      await decrementerStockCommande(
        itemsParsed,
        session.restaurantId || null,
        commande.id,
        session.name || session.login,
        { bloquer: false }
      )
    } catch (stockErr) {
      console.error('[vente-directe] stockDecrement réel échoué (commande créée):', stockErr.message)
    }

    return NextResponse.json({ ...commande, qrUrl }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/vente-directe]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
