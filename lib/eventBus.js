// lib/eventBus.js — v17 Production-ready
// Bus d'événements SSE — Redis Pub/Sub en production, in-memory en dev
//
// Architecture multi-instance (Vercel serverless) :
//   publish()  → delivery locale (même instance) + redis.publish() cross-instance
//   subscribe()→ enregistre le client SSE localement sur cette instance
//   createRedisSubscription() → ouvre un abonnement Redis pour la durée d'une connexion SSE
//
// Fallback gracieux : si UPSTASH_REDIS_REST_URL est absent → mode mémoire (dev local sans erreur)
//
// Channels Redis :
//   cmb:events:global            → super_admin (voit tous les restaurants)
//   cmb:events:{restaurantId}    → restaurant spécifique

import { Redis } from '@upstash/redis'

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const REDIS_MODE  = !!(REDIS_URL && REDIS_TOKEN)

/** Redis client partagé pour les publications (singleton par instance) */
const redisPublisher = REDIS_MODE
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null

/** Clients SSE locaux — Map<key, Set<client>> */
const localClients = new Map()
const GLOBAL_KEY   = '__global__'

export const CHANNEL_GLOBAL = 'cmb:events:global'

/** @param {string|null} restaurantId */
const channelPour = (restaurantId) =>
  restaurantId ? `cmb:events:${restaurantId}` : CHANNEL_GLOBAL

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Enregistre un client SSE sur cette instance Vercel.
 * @param {string|null} restaurantId
 * @param {{ send: (payload: string) => void }} client
 */
export function subscribe(restaurantId, client) {
  const key = restaurantId || GLOBAL_KEY
  if (!localClients.has(key)) localClients.set(key, new Set())
  localClients.get(key).add(client)
}

/**
 * Désenregistre un client SSE (déconnexion).
 * @param {string|null} restaurantId
 * @param {{ send: Function }} client
 */
export function unsubscribe(restaurantId, client) {
  const key = restaurantId || GLOBAL_KEY
  localClients.get(key)?.delete(client)
}

/**
 * Publie un événement.
 * — Local  : delivery immédiate aux clients SSE connectés sur cette instance
 * — Redis  : publication cross-instance si UPSTASH_REDIS_REST_URL configuré
 *
 * @param {{ type: string, data: any }} event
 * @param {string|null} restaurantId  - null = broadcast global uniquement
 * @returns {Promise<void>}
 */
export async function publish(event, restaurantId = null) {
  const payload = _formatSSE(event)

  // 1. Delivery locale (même instance Vercel)
  _localDeliver(payload, restaurantId)

  // 2. Cross-instance via Redis (mode production multi-instances)
  if (!REDIS_MODE) return

  try {
    if (restaurantId) {
      // Channel restaurant spécifique + channel global (super_admin voit tout)
      await Promise.all([
        redisPublisher.publish(channelPour(restaurantId), payload),
        redisPublisher.publish(CHANNEL_GLOBAL, payload),
      ])
    } else {
      await redisPublisher.publish(CHANNEL_GLOBAL, payload)
    }
  } catch (err) {
    console.warn('[EventBus] Redis publish échoué — delivery locale uniquement:', err.message)
  }
}

/**
 * Crée un abonnement Redis pour la durée d'une connexion SSE.
 * Doit être appelé depuis app/api/events/route.js après subscribe().
 * Reçoit les événements publiés par les AUTRES instances Vercel.
 *
 * @param {string|null}            restaurantId
 * @param {(payload: string)=>void} onMessage  - callback appelé pour chaque message reçu
 * @returns {()=>void}  cleanup — appeler à la déconnexion SSE (abort / cancel)
 */
export function createRedisSubscription(restaurantId, onMessage) {
  if (!REDIS_MODE) return () => {}

  const channels = [CHANNEL_GLOBAL]
  if (restaurantId) channels.push(channelPour(restaurantId))

  let cancelled = false
  // Un client Redis dédié par connexion SSE (pas de partage d'état subscriber)
  const sub = new Redis({ url: REDIS_URL, token: REDIS_TOKEN })

  ;(async () => {
    try {
      // @upstash/redis subscribe() retourne un async iterable de [channel, message]
      for await (const [, message] of sub.subscribe(...channels)) {
        if (cancelled) break
        try { onMessage(message) } catch {}
      }
    } catch (err) {
      if (!cancelled) {
        console.warn('[EventBus] Abonnement Redis interrompu:', err.message)
      }
    }
  })()

  return () => {
    cancelled = true
    try { sub.unsubscribe(...channels) } catch {}
  }
}

// ── Helpers internes ───────────────────────────────────────────────────────────

function _localDeliver(payload, restaurantId) {
  if (restaurantId) {
    localClients.get(restaurantId)?.forEach(c => { try { c.send(payload) } catch {} })
  }
  localClients.get(GLOBAL_KEY)?.forEach(c => { try { c.send(payload) } catch {} })
}

/**
 * Formate un objet JS en texte SSE (spec W3C).
 * Format : event: <type>\ndata: <json>\n\n
 */
function _formatSSE({ type, data }) {
  const json = JSON.stringify({ type, data, ts: Date.now() })
  return `event: ${type}\ndata: ${json}\n\n`
}

/** Nombre total de clients SSE connectés sur cette instance (debug/métriques). */
export function clientCount() {
  let n = 0
  localClients.forEach(s => { n += s.size })
  return n
}
