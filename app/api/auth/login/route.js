import { NextResponse } from 'next/server'
import { verifyCredentials, createToken, SESSION_COOKIE, SESSION_DURATION } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(request) {
  // Rate limiting : 5 tentatives / 15 min par IP (anti-brute force)
  const ip = getClientIp(request)
  const rl = await rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    )
  }

  try {
    const { login, password } = await request.json()

    if (!login || !password) {
      return NextResponse.json(
        { error: "L'identifiant et le mot de passe sont requis" },
        { status: 400 }
      )
    }

    const user = await verifyCredentials(login.trim(), password)

    if (!user) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
    }

    const token = await createToken({
      login:        user.login,
      userId:       user.userId  || user.login,
      role:         user.role,
      name:         user.name,
      source:       user.source,            // FIX — propagé depuis verifyCredentials ('db' | 'env')
      restaurantId: user.restaurantId || null,
      iat:          Date.now(),
      exp:          Date.now() + SESSION_DURATION,
    })

    const response = NextResponse.json({
      ok:         true,
      role:       user.role,
      name:       user.name,
    })

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict', // FIX #6 — strict empêche l'envoi depuis liens externes
      maxAge:   SESSION_DURATION / 1000,
      path:     '/',
    })

    return response
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
