// app/api/commandes/route.js
// POST : public (clients) — avec rate limiting
// GET  : protégé admin/staff — données privées

import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import prisma           from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validatePhone, validateAmount, sanitize } from '@/lib/validate'
import { requireAuth, getInternalKey } from '@/lib/auth'
import { randomBytes } from 'crypto'
import { publish } from '@/lib/eventBus'
import { getZonesRestaurant, LIVRAISON_GRATUITE_DE } from '@/lib/zones'

// Helper : charger horaires depuis les parametres du restaurant
async function getRestaurantParams(restaurantId) {
  if (!restaurantId) return null
  try {
    const r = await prisma.restaurant.findUnique({
      where:  { id: restaurantId },
      select: { parametres: true },
    })
    return r?.parametres || null
  } catch { return null }
}

// Helper : charger le taux d'acompte configuré (table Parametre)
// Priorité : paramètre spécifique au restaurant > paramètre global > défaut 30%
async function getTauxAcompte(restaurantId) {
  try {
    const rows = await prisma.parametre.findMany({
      where: {
        id: 'taux_acompte_livraison',
        OR: [
          { restaurantId: '' },
          { restaurantId: restaurantId || '' },
        ],
      },
    })
    // Restaurant-specific overrides global
    const specific = rows.find(r => r.restaurantId === restaurantId)
    const global   = rows.find(r => r.restaurantId === '')
    const val = parseInt((specific || global)?.valeur || '30')
    return isNaN(val) ? 30 : Math.max(0, Math.min(100, val))
  } catch { return 30 }
}

function generateCommandeId() {
  return 'CMD-' + randomBytes(4).toString('hex').toUpperCase()
}

// ── Horaires d'ouverture (Yaoundé UTC+1) ─────────────────────────────────────
const HORAIRES = {
  0: { open: 11, close: 21 }, // Dim
  1: { open: 11, close: 22 }, // Lun
  2: { open: 11, close: 22 }, // Mar
  3: { open: 11, close: 22 }, // Mer
  4: { open: 11, close: 22 }, // Jeu
  5: { open: 11, close: 22 }, // Ven
  6: { open: 10, close: 23 }, // Sam
}
const JOURS = ['dim','lun','mar','mer','jeu','ven','sam']

async function estOuvert(restaurantId = null) {
  // ── Vérification du toggle ouvert/fermé manuel ────────────────────────────
  if (restaurantId) {
    try {
      const resto = await prisma.restaurant.findUnique({
        where:  { id: restaurantId },
        select: { ouvert: true },
      })
      if (resto && resto.ouvert === false) {
        return {
          ouvert: false,
          message: 'Restaurant temporairement fermé. Veuillez réessayer plus tard ou nous contacter sur WhatsApp.',
        }
      }
    } catch { /* silencieux — on continue avec la vérification horaires */ }
  }

  // ── Vérification des horaires configurés ─────────────────────────────────
  let horaires = HORAIRES // fallback valeurs hardcodées

  if (restaurantId) {
    const params = await getRestaurantParams(restaurantId)
    if (params?.horaires) horaires = params.horaires
  }

  // FIX M1 — Utiliser Intl.DateTimeFormat pour obtenir l'heure locale Yaoundé (WAT = UTC+1 fixe)
  // Remplace le hack `Date.now() + 60*60*1000` qui est fragile et non documenté.
  const formatter = new Intl.DateTimeFormat('fr-CM', {
    timeZone: 'Africa/Douala',
    weekday:  'short',
    hour:     'numeric',
    minute:   'numeric',
    hour12:   false,
  })
  const parts  = Object.fromEntries(formatter.formatToParts(new Date()).map(p => [p.type, p.value]))
  const joursMap = { 'dim': 0, 'lun': 1, 'mar': 2, 'mer': 3, 'jeu': 4, 'ven': 5, 'sam': 6 }
  const jourStr  = (parts.weekday || '').toLowerCase().slice(0, 3)
  const jour     = joursMap[jourStr] ?? new Date().getDay()
  const h        = parseInt(parts.hour || '0') + parseInt(parts.minute || '0') / 60
  const ho       = horaires[jour]
  const ouvert   = h >= ho.open && h < (ho.close - 0.5)  // fermeture 30 min avant
  return {
    ouvert,
    message: ouvert ? null
      : `Commande impossible — restaurant fermé. Horaires : Lun–Ven 11h–22h, Sam 10h–23h, Dim 11h–21h. Prochaine ouverture : ${horaires[(jour+1)%7].open}h (${JOURS[(jour+1)%7]}).`,
  }
}

// ── Calcul frais de livraison depuis les zones du restaurant ──────────────────
/**
 * Calcule les frais de livraison pour une zone donnée.
 * Utilise les zones configurées par le restaurant (multi-tenant).
 * @param {Record<string, {frais: number}>} zones  - zones du restaurant
 * @param {string} zone                            - quartier de livraison
 * @param {number} sousTotal                       - montant hors livraison
 * @returns {number} frais en FCFA
 */
function getFraisLivraison(zones, zone, sousTotal) {
  if (sousTotal >= LIVRAISON_GRATUITE_DE) return 0
  const zoneInfo = zones[zone]
  return zoneInfo !== undefined ? zoneInfo.frais : 1500  // Autre zone non listée
}

// ── GET — PROTÉGÉ (admin/staff uniquement) ────────────────────────────────────
export async function GET(request) {
  try {
    const cookieStore = await cookies()
    const session     = await requireAuth(cookieStore)

    if (!session) {
      return NextResponse.json(
        { error: 'Non autorisé — connexion requise' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status       = searchParams.get('status')
    const restaurantId = searchParams.get('restaurantId')
    const limit        = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    // Cursor-based pagination — remplace offset pour éviter la lenteur > 10 000 lignes.
    // Compatibilité ascendante : offset accepté mais ignoré si cursor présent.
    const cursor       = searchParams.get('cursor') || null
    const offset       = cursor ? 0 : parseInt(searchParams.get('offset') || '0')

    const where = {}
    if (status) where.status = status

    // Isolation tenant — tout rôle sauf super_admin est limité à son restaurant
    if (session.role !== 'super_admin' && session.restaurantId) {
      where.restaurantId = session.restaurantId
    }
    if (restaurantId && session.role === 'super_admin') where.restaurantId = restaurantId

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      // Cursor-based : on saute uniquement 1 ligne (la dernière vue) — O(1) vs O(N)
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : { skip: offset }
      ),
    }

    const [commandes, total] = await Promise.all([
      prisma.commande.findMany(queryOptions),
      prisma.commande.count({ where }),
    ])

    // nextCursor : id de la dernière commande retournée, null si dernière page
    const nextCursor = commandes.length === limit ? commandes.at(-1).id : null

    return NextResponse.json({ commandes, total, limit, offset, nextCursor })
  } catch (err) {
    console.error('[GET /api/commandes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── POST — PUBLIC (clients) avec rate limiting ────────────────────────────────
export async function POST(request) {
  const ip = getClientIp(request)
  const rl = await rateLimit(`commandes:${ip}`, { limit: 20, windowMs: 10 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    )
  }

  try {
    const body = await request.json()
    const { client, tel, mode, items, total, addr, note, paiement, zone, restaurantId: bodyRestaurantId } = body

    if (!client || !tel || !items || !total) {
      return NextResponse.json(
        { error: 'Champs requis : client, tel, items, total' },
        { status: 400 }
      )
    }
    if (!validatePhone(tel)) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide (format +237 attendu)' },
        { status: 400 }
      )
    }
    if (!validateAmount(total)) {
      return NextResponse.json(
        { error: 'Montant invalide (entier positif, max 10 000 000 FCFA)' },
        { status: 400 }
      )
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'La commande doit contenir au moins un article' },
        { status: 400 }
      )
    }
    if (items.length > 50) {
      return NextResponse.json(
        { error: 'La commande ne peut pas contenir plus de 50 articles' },
        { status: 400 }
      )
    }
    // S4 — Sanitize les champs structurels des items (id, name, qty)
    // Le prix client est conservé temporairement mais sera écrasé par le prix BDD ci-dessous.
    const itemsSanitizesInit = items.map(it => ({
      id:    parseInt(it.id) || 0,
      name:  String(it.name || '').slice(0, 100),
      price: Math.max(0, parseInt(it.price) || 0),
      qty:   Math.max(1, Math.min(99, parseInt(it.qty) || 1)),
    }))

    // ── Vérification horaires et toggle ouvert/fermé ─────────────────────────
    const restaurantId = bodyRestaurantId || null
    const horaire = await estOuvert(restaurantId)
    if (!horaire.ouvert) {
      return NextResponse.json({ error: horaire.message, ferme: true }, { status: 422 })
    }

    // ── FIX C2 — Revalider les prix depuis la BDD (anti-manipulation prix client) ──
    // La route est publique : un client peut envoyer price:1 pour chaque article.
    // On charge les vrais prix depuis menuItem.price et on écrase le prix client.
    const menuItemIds = itemsSanitizesInit.map(it => it.id).filter(id => id > 0)
    let itemsSanitizes = itemsSanitizesInit

    if (menuItemIds.length > 0) {
      const menuItemsBD = await prisma.menuItem.findMany({
        where: {
          id:    { in: menuItemIds },
          actif: true,
          ...(restaurantId ? { restaurantId } : {}),
        },
        select: { id: true, price: true },
      })
      const priceMapBD = Object.fromEntries(menuItemsBD.map(m => [m.id, m.price]))

      // Construire items avec prix serveur — rejeter les articles inconnus (prix 0 ou absent)
      itemsSanitizes = itemsSanitizesInit
        .map(it => ({
          ...it,
          price: priceMapBD[it.id] ?? null,  // null si article inconnu ou inactif
        }))
        .filter(it => it.price !== null && it.price > 0)

      if (itemsSanitizes.length === 0) {
        return NextResponse.json(
          { error: 'Aucun article valide trouvé. Veuillez recharger le menu.' },
          { status: 422 }
        )
      }
    }

    // ── Vérification zone de livraison (zones dynamiques par restaurant) ──────
    const modeLower = (mode || '').toLowerCase()
    if (modeLower.includes('livraison') && zone) {
      const zonesResto  = await getZonesRestaurant(restaurantId)
      const sousTotal   = itemsSanitizes.reduce((s, it) => s + it.price * it.qty, 0)
      const fraisServeur   = getFraisLivraison(zonesResto, zone, sousTotal)
      const totalServeur   = sousTotal + fraisServeur
      // Log uniquement — la valeur stockée sera calculée depuis les prix BDD
      if (Math.abs(totalServeur - Number(total)) > 50 && sousTotal > 0) {
        console.warn(`[commandes] Total suspect : client envoie ${total}, serveur calcule ${totalServeur} (zone: ${zone}, restaurant: ${restaurantId})`)
      }
    }

    // ── Déduplication : commande en double ? ──────────────────────────────────
    // Si une commande non-annulée avec le même tel + même total existe
    // depuis moins de 15 minutes → on la retourne au lieu d'en créer une nouvelle.
    // Couvre le cas "retour arrière navigateur après redirection CinetPay".
    const FENETRE_MS = 15 * 60 * 1000
    const depuis = new Date(Date.now() - FENETRE_MS)

    const doublon = await prisma.commande.findFirst({
      where: {
        tel:       sanitize(tel, 20),
        total:     Number(total),
        status:    { notIn: ['annule'] },
        createdAt: { gte: depuis },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (doublon) {
      console.warn(`[POST /api/commandes] Doublon détecté pour ${tel} — retourne ${doublon.id}`)
      return NextResponse.json({ ...doublon, _doublon: true }, { status: 200 })
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── v22 — Charger le taux d'acompte configuré (avant create) ─────────────
    const tauxAcompte = await getTauxAcompte(restaurantId)

    // FIX C2 — Le total stocké est recalculé depuis les prix BDD (anti-manipulation)
    // On recalcule le sous-total des articles puis on ajoute les frais de livraison
    const sousTotalBD  = itemsSanitizes.reduce((s, it) => s + it.price * it.qty, 0)
    const fraisLivraison = (() => {
      if (!modeLower.includes('livraison') || !zone) return 0
      // Note : zonesResto peut déjà être chargé plus haut, mais on le charge de nouveau
      // pour garantir la cohérence même si la vérification zone a été ignorée
      return 0  // sera recalculé de façon synchrone via la même logique getFraisLivraison
    })()
    // Pour la livraison avec zone : recalculer les frais depuis la BDD
    let totalBD = sousTotalBD
    if (modeLower.includes('livraison') && zone) {
      const zonesRestoBD = await getZonesRestaurant(restaurantId)
      totalBD = sousTotalBD + getFraisLivraison(zonesRestoBD, zone, sousTotalBD)
    }

    const commande = await prisma.commande.create({
      data: {
        id:           generateCommandeId(),
        restaurantId: restaurantId || null,  // C4-FIX — lier la commande au tenant
        client:       sanitize(client, 100),
        tel:          sanitize(tel, 20),
        mode:         sanitize(mode || 'Livraison', 50),
        items:        itemsSanitizes,
        total:        totalBD,  // FIX C2 — total calculé serveur depuis prix BDD
        addr:         addr    ? sanitize(addr, 200)  : null,
        note:         note    ? sanitize(note, 500)  : null,
        paiement:     paiement || 'livraison',
        status:       'nouveau',
        // v22 — Acompte : calculé uniquement pour livraison + paiement espèces
        ...(() => {
          const isLivraisonEspeces = modeLower.includes('livraison') && (paiement || 'livraison') === 'livraison'
          if (!isLivraisonEspeces) return {}
          // tauxAcompte chargé plus haut (valeur 0–100, 0 = acompte désactivé)
          if (tauxAcompte === 0) return { acompteStatut: 'exempte' }
          const acompteVal     = Math.round(totalBD * tauxAcompte / 100)
          const resteAReglerVal = totalBD - acompteVal
          return {
            acompte:       acompteVal,
            resteARegler:  resteAReglerVal,
            acompteStatut: 'requis',
          }
        })(),
      },
    })

    // Notification SSE temps réel (staff connectés)
    publish({ type: 'commande_nouvelle', data: commande }, commande.restaurantId || null)

    // Notification WhatsApp — seulement pour les nouvelles commandes (pas les doublons)
    // C8 — timeout 5s : si WhatsApp ne répond pas, la commande est quand même créée.
    if (!commande._doublon) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const waCtrl  = new AbortController()
        const waTimer = setTimeout(() => waCtrl.abort(), 5000)
        await fetch(`${baseUrl}/api/whatsapp`, {
          method:  'POST',
          signal:  waCtrl.signal,
          headers: {
            'Content-Type':  'application/json',
            'x-internal-key': getInternalKey(),
          },
          body: JSON.stringify({ type: 'nouvelle_commande', data: commande }),
        }).finally(() => clearTimeout(waTimer))
      } catch (waErr) {
        // AbortError si timeout, NetworkError si WhatsApp down — les deux sont non bloquants
        console.warn('[WhatsApp] Non bloquant:', waErr.name === 'AbortError' ? 'timeout 5s' : waErr.message)
      }
    }

    // Programme fidélité — seulement sur nouvelles commandes
    if (!commande._doublon) {
      try {
        const nbCommandes = await prisma.commande.count({
          where: { tel: sanitize(tel, 20), status: { not: 'annule' } },
        })
        if (nbCommandes > 0 && nbCommandes % 5 === 0) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          const fidCtrl  = new AbortController()
          const fidTimer = setTimeout(() => fidCtrl.abort(), 5000)
          await fetch(`${baseUrl}/api/whatsapp`, {
            method:  'POST',
            signal:  fidCtrl.signal,
            headers: {
              'Content-Type':  'application/json',
              'x-internal-key': getInternalKey(),
            },
            body: JSON.stringify({
              type: 'fidelite_recompense',
              data: { ...commande, nbCommandes },
            }),
          }).finally(() => clearTimeout(fidTimer))
        }
      } catch (fidErr) {
        console.warn('[Fidélité] Non bloquant:', fidErr.name === 'AbortError' ? 'timeout 5s' : fidErr.message)
      }
    }

    return NextResponse.json(commande, { status: 201 })
  } catch (err) {
    console.error('[POST /api/commandes]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
