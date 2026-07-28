// app/api/auth/logout/route.js
// S1 — Révocation explicite du token via jti + Redis (Upstash)
// Le cookie est supprimé ET le jti est blacklisté jusqu'à l'expiration naturelle du token.
// Dégradé gracieux si Redis est indisponible : le cookie est quand même supprimé.

import { NextResponse }                              from 'next/server'
import { SESSION_COOKIE, verifyToken, SESSION_DURATION } from '@/lib/auth'
import { cookies }                                    from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const token       = cookieStore.get(SESSION_COOKIE)?.value

  // S1 — Blacklister le jti avant de supprimer le cookie
  if (token) {
    try {
      const session = await verifyToken(token)
      if (session?.jti) {
        const url     = process.env.UPSTASH_REDIS_REST_URL
        const tkn     = process.env.UPSTASH_REDIS_REST_TOKEN
        if (url && tkn) {
          const { Redis } = await import('@upstash/redis')
          const redis = new Redis({ url, token: tkn })
          // TTL = durée restante du token (max SESSION_DURATION) pour nettoyage automatique
          const ttlSeconds = session.exp
            ? Math.max(1, Math.ceil((session.exp - Date.now()) / 1000))
            : Math.ceil(SESSION_DURATION / 1000)
          await redis.set(`cmb:revoked:${session.jti}`, '1', { ex: ttlSeconds })
          console.warn(`[AUTH] Token révoqué — jti: ${session.jti.slice(0, 8)}… TTL: ${ttlSeconds}s`)
        }
      }
    } catch (err) {
      // Dégradé gracieux : Redis indisponible — le cookie sera quand même supprimé
      console.warn('[AUTH] Révocation Redis échouée (non bloquant):', err.message)
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
