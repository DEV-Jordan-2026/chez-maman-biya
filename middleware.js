import { NextResponse } from 'next/server'
import { verifyToken, SESSION_COOKIE, LIVREUR_SESSION_COOKIE } from '@/lib/auth-edge'

// FIX #3 — Routes API publiques : accessibles sans token
// Toutes les autres routes /api/* exigent un token valide (filet de sécurité global).
// Les routes qui font déjà requireAuth() en interne bénéficient d'une double vérification.
const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/menu',               // GET public (carte visible par les clients)
  '/api/config',             // paramètres publics (frais livraison, etc.)
  '/api/suivi/',             // suivi commande client (lien QR)
  '/api/paiement/webhook',   // appelé directement par CinetPay
  '/api/paiement/initier',   // initié par le client sans compte
  '/api/chatbot',            // widget public
  '/api/tables/',            // commandes via QR table client
  '/api/table/',             // variante QR table
  '/api/reservations',       // GET/POST public (formulaire réservation)
  '/api/facture/verify',     // vérification QR facture (public)
  '/api/images',             // GET public (images du site)
  '/api/events',             // SSE (auth vérifiée dans la route)
  '/api/livreur/',           // v26 — App livreur, authentifiée via cookie cmb_livreur_session (requireLivreur)
  '/api/cron/',              // tâches planifiées Vercel (CRON_SECRET vérifié dans la route)
]

function checkOrigin(request) {
  const origin  = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host    = request.headers.get('host')

  // S3 — Appels internes authentifiés par x-internal-key : passer sans vérification Origin.
  // La vérification de la clé est faite par verifyInternalKey() dans chaque route.
  if (request.headers.get('x-internal-key')) return true

  if (origin) {
    if (!host) return false
    try { return new URL(origin).host === host } catch { return false }
  }

  // S3 — Fallback Referer quand Origin est absent (edge cases navigateur : redirects, iframes).
  // Les appels server-to-server sans Referer passent également (curl, webhooks tiers).
  if (referer) {
    if (!host) return false
    try { return new URL(referer).host === host } catch { return false }
  }

  // Ni Origin ni Referer : autoriser (server-to-server, outils CLI).
  // Protection principale : httpOnly cookie + verifyToken dans chaque route.
  return true
}

export async function middleware(request) {
  const { pathname } = request.nextUrl
  const { method }  = request

  // CSRF check
  if (pathname.startsWith('/api/') && ['POST','PUT','PATCH','DELETE'].includes(method)) {
    if (!checkOrigin(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'Origine non autorisée' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // FIX #3 — Filet de sécurité global : toutes les routes /api/ non publiques
  // exigent un token valide. Évite qu'une route oublie requireAuth() et soit ouverte.
  if (pathname.startsWith('/api/')) {
    // /api/commandes : POST = création de commande client (page /commande, sans QR table),
    // ne nécessite pas d'auth (même logique que /api/tables/* et /api/table/*).
    // GET reste protégé (liste admin, requireAuth() interne).
    const isPublicCommandePost = pathname === '/api/commandes' && method === 'POST'

    const isPublic = isPublicCommandePost || PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
    if (!isPublic) {
      const token = request.cookies.get(SESSION_COOKIE)?.value
      if (!token) {
        return new NextResponse(
          JSON.stringify({ error: 'Non authentifié' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
      try {
        const session = await verifyToken(token)
        if (!session) {
          return new NextResponse(
            JSON.stringify({ error: 'Session invalide ou expirée' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        }
      } catch {
        return new NextResponse(
          JSON.stringify({ error: 'Session invalide' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  // Login page — si déjà connecté rediriger vers /admin
  if (pathname === '/admin/login') {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    if (token) {
      try {
        const session = await verifyToken(token)
        if (session) return NextResponse.redirect(new URL('/admin', request.url))
      } catch {}
    }
    return NextResponse.next()
  }

// Protéger /admin/*
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    if (!token) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
    try {
      const session = await verifyToken(token)
      if (!session) {
        const loginUrl = new URL('/admin/login', request.url)
        loginUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(loginUrl)
      }
      const res = NextResponse.next()
      res.headers.set('x-user-role',  session.role  || '')
      res.headers.set('x-user-name',  session.name  || '')
      res.headers.set('x-user-login', session.login || '')
      return res
    } catch {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // v26 — App livreur : /livraison/login public, le reste de /livraison protégé
  // par cmb_livreur_session (cookie distinct de la session staff cmb_session)
  if (pathname === '/livraison/login') {
    const token = request.cookies.get(LIVREUR_SESSION_COOKIE)?.value
    if (token) {
      try {
        const session = await verifyToken(token)
        if (session?.role === 'livreur') return NextResponse.redirect(new URL('/livraison', request.url))
      } catch {}
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/livraison')) {
    const token = request.cookies.get(LIVREUR_SESSION_COOKIE)?.value
    if (!token) return NextResponse.redirect(new URL('/livraison/login', request.url))
    try {
      const session = await verifyToken(token)
      if (!session || session.role !== 'livreur') {
        return NextResponse.redirect(new URL('/livraison/login', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/livraison/login', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/livraison/:path*'],
}
