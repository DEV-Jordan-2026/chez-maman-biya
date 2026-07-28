import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createToken, verifyPassword, LIVREUR_SESSION_COOKIE, LIVREUR_SESSION_DURATION } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

// v26 — Connexion livreur : numéro de téléphone + PIN (4 chiffres)
export async function POST(request) {
  const ip = getClientIp(request)
  const rl = await rateLimit(`livreur-login:${ip}`, { limit: 5, windowMs: 15 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    )
  }

  try {
    const { tel, pin } = await request.json()
    if (!tel || !pin) {
      return NextResponse.json({ error: 'Téléphone et code requis' }, { status: 400 })
    }

    const livreur = await prisma.livreur.findFirst({
      where: { tel: tel.trim(), actif: true },
    })

    // Réponse identique succès/échec (timing-safe) pour éviter l'énumération des numéros
    if (!livreur || !livreur.pinHash) {
      await new Promise(r => setTimeout(r, 50 + Math.random() * 50))
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
    }

    const ok = await verifyPassword(pin, livreur.pinHash, livreur.id)
    if (!ok) {
      await new Promise(r => setTimeout(r, 50 + Math.random() * 50))
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
    }

    const token = await createToken({
      role:         'livreur',
      livreurId:    livreur.id,
      restaurantId: livreur.restaurantId,
      nom:          livreur.nom,
      iat:          Date.now(),
      exp:          Date.now() + LIVREUR_SESSION_DURATION,
    })

    const response = NextResponse.json({ ok: true, nom: livreur.nom })
    response.cookies.set(LIVREUR_SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   LIVREUR_SESSION_DURATION / 1000,
      path:     '/',
    })
    return response
  } catch (err) {
    console.error('[livreur/login]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
