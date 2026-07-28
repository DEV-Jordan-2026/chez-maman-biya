// lib/auth-edge.js
// Sous-ensemble de lib/auth.js utilisable dans le Edge Runtime (middleware.js)
// ⚠️  NE PAS importer Prisma ici — Edge Runtime = Web Crypto uniquement
//
// Règle : middleware.js importe depuis '@/lib/auth-edge'
//         Le reste du code (route handlers Node.js) importe depuis '@/lib/auth'

export const SESSION_COOKIE   = 'cmb_session'
export const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8h

// v26 — Cookie de session dédié à l'app livreur (/livraison)
export const LIVREUR_SESSION_COOKIE = 'cmb_livreur_session'

// S1 — Vérification liste noire Redis (Edge Runtime — Upstash HTTP, pas de Node.js crypto)
// @upstash/redis est compatible Edge Runtime (requêtes HTTP fetch natives)
async function isTokenRevoked(jti) {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token || !jti) return false
  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url, token })
    const revoked = await redis.get(`cmb:revoked:${jti}`)
    return !!revoked
  } catch { return false }  // Dégradé gracieux si Redis indisponible
}

function getSecret() {
  const s = process.env.AUTH_SECRET
  if (!s || s.startsWith('changez-moi')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[AUTH] AUTH_SECRET doit être défini en production')
    }
  }
  return s || 'dev-secret-changez-moi-en-prod-32c'
}

async function hmacSign(data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function verifyToken(token) {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null

  const data = token.slice(0, dot)
  const sig  = token.slice(dot + 1)

  const expected = await hmacSign(data)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const s1 = await crypto.subtle.sign('HMAC', key, enc.encode(expected))
  const s2 = await crypto.subtle.sign('HMAC', key, enc.encode(sig))
  const b1 = new Uint8Array(s1)
  const b2 = new Uint8Array(s2)
  let match = b1.length === b2.length
  for (let i = 0; i < b1.length; i++) { if (b1[i] !== b2[i]) match = false }
  if (!match) return null

  try {
    const padded  = data.replace(/-/g, '+').replace(/_/g, '/')
      + '='.repeat((4 - data.length % 4) % 4)
    const payload = JSON.parse(atob(padded))
    if (payload.exp && Date.now() > payload.exp) return null

    // S1 — Vérifier la révocation (middleware Edge Runtime)
    if (payload.jti) {
      const revoked = await isTokenRevoked(payload.jti)
      if (revoked) return null
    }

    return payload
  } catch {
    return null
  }
}
