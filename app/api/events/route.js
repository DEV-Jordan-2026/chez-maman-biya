// app/api/events/route.js
// Endpoint Server-Sent Events (SSE) — connexion longue durée
//
// Le client ouvre :  GET /api/events
// Le serveur envoie des événements au fil de l'eau sans que le client repolline.
//
// Événements émis :
//   commande_nouvelle      data: { commande }
//   commande_status        data: { id, status, updatedAt }
//   reservation_nouvelle   data: { reservation }
//   reservation_status     data: { id, status }
//   message_nouveau        data: { nb }   (nombre de messages non lus)
//   stock_alerte           data: { id, nom, stock, seuil }
//   ping                   data: {}       (keepalive toutes les 25s)
//
// Delivery cross-instance : Redis Pub/Sub (si UPSTASH_REDIS_REST_URL configuré)
//   → chaque instance Vercel reçoit les événements publiés par les autres instances

import { NextResponse }    from 'next/server'
import { cookies }         from 'next/headers'
import { requireAuth }     from '@/lib/auth'
import { subscribe, unsubscribe, createRedisSubscription } from '@/lib/eventBus'

// Force Node.js runtime — SSE ne fonctionne pas en Edge Runtime
export const runtime = 'nodejs'
// Désactive le body parsing (streaming)
export const dynamic = 'force-dynamic'

export async function GET(request) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)

  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // super_admin voit tout → clé globale, sinon filtré par restaurant
  const restaurantId = session.role === 'super_admin'
    ? null
    : session.restaurantId || null

  // ── Stream SSE ───────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  let controller
  let pingInterval
  let client
  let cleanupRedis = () => {}

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl

      client = {
        send(payload) {
          try {
            controller.enqueue(encoder.encode(payload))
          } catch {
            // Stream fermé (client parti) — nettoyage dans cancel()
          }
        },
        restaurantId,
      }

      // Enregistrer dans le bus local (même instance)
      subscribe(restaurantId, client)

      // Abonnement Redis pour la delivery cross-instance (autres instances Vercel)
      // Reçoit les messages publiés par d'autres workers et les forward au client SSE
      cleanupRedis = createRedisSubscription(restaurantId, (payload) => {
        client.send(payload)
      })

      // Message de bienvenue + infos session
      const welcome = `event: connected\ndata: ${JSON.stringify({
        type: 'connected',
        role: session.role,
        restaurantId,
        redisMode: !!(process.env.UPSTASH_REDIS_REST_URL),
        ts: Date.now(),
      })}\n\n`
      controller.enqueue(encoder.encode(welcome))

      // Keepalive toutes les 25 secondes (les proxies coupent après ~30s sans données)
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`))
        } catch {
          clearInterval(pingInterval)
        }
      }, 25_000)
    },

    cancel() {
      // Le client a fermé la connexion (navigateur fermé, onglet changé, etc.)
      clearInterval(pingInterval)
      unsubscribe(restaurantId, client)
      cleanupRedis()
    },
  })

  // Gérer la déconnexion via le signal d'abort de la requête (Vercel timeout, réseau)
  request.signal.addEventListener('abort', () => {
    clearInterval(pingInterval)
    unsubscribe(restaurantId, client)
    cleanupRedis()
    try { controller.close() } catch {}
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',  // Désactive le buffering nginx
    },
  })
}
