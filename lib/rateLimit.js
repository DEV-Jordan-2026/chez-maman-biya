// lib/rateLimit.js
// Rate limiter hybride :
//   - Production Vercel multi-instance → Upstash Redis (plan gratuit)
//   - Dev / sans Redis configuré        → fallback in-memory
//
// Upstash Redis : https://upstash.com → 1 base gratuite, ~10k req/jour
// Variables requises : UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

let RedisRateLimit = null
let redis = null

// Initialisation lazy de Upstash (seulement si configuré)
async function getUpstash() {
  if (redis) return { Ratelimit: RedisRateLimit, redis }
  if (!process.env.UPSTASH_REDIS_REST_URL) return null

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis }     = await import('@upstash/redis')
    RedisRateLimit = Ratelimit
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    return { Ratelimit, redis }
  } catch {
    return null
  }
}

// ── Fallback in-memory (dev / mono-instance) ──────────────────────────────────
const memStore = new Map()

function rateLimitMemory(key, { limit = 10, windowMs = 60_000 } = {}) {
  const now         = Date.now()
  const windowStart = now - windowMs
  const timestamps  = (memStore.get(key) || []).filter(t => t > windowStart)

  if (timestamps.length >= limit) {
    const resetInSeconds = Math.ceil((timestamps[0] + windowMs - now) / 1000)
    return { ok: false, remaining: 0, resetInSeconds }
  }

  timestamps.push(now)
  memStore.set(key, timestamps)

  // Nettoyage périodique mémoire
  if (memStore.size > 5_000) {
    for (const [k, v] of memStore) {
      if (v.every(t => t < windowStart)) memStore.delete(k)
    }
  }

  return { ok: true, remaining: limit - timestamps.length, resetInSeconds: 0 }
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Vérifie le rate limit pour une clé donnée.
 * Utilise Upstash Redis en prod si configuré, sinon fallback mémoire.
 *
 * @param {string} key         - Clé unique (ex: "login:1.2.3.4")
 * @param {object} options
 * @param {number} options.limit     - Nb max requêtes par fenêtre
 * @param {number} options.windowMs  - Durée de la fenêtre en ms
 * @returns {Promise<{ ok: boolean, remaining: number, resetInSeconds: number }>}
 */
export async function rateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
  const upstash = await getUpstash()

  if (upstash) {
    try {
      const limiter = new upstash.Ratelimit({
        redis: upstash.redis,
        limiter: upstash.Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
        analytics: false,
      })
      const { success, remaining, reset } = await limiter.limit(key)
      return {
        ok: success,
        remaining,
        resetInSeconds: Math.ceil((reset - Date.now()) / 1000),
      }
    } catch (err) {
      console.warn('[RateLimit] Upstash error, fallback to memory:', err.message)
    }
  }

  return rateLimitMemory(key, { limit, windowMs })
}

/**
 * Extrait l'IP client depuis une requête Next.js.
 * Gère les proxies et CDN (Vercel, Cloudflare).
 */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')                               ||
    request.headers.get('cf-connecting-ip')                        || // Cloudflare
    'unknown'
  )
}
