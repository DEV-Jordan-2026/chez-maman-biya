// app/api/auth/compte/route.js
// Permet à tout utilisateur connecté de modifier son propre login, mot de passe ou nom affiché.
// Règles :
//   - Confirmation du mot de passe ACTUEL obligatoire avant tout changement
//   - Nouveau login : unicité vérifiée en base (erreur 409 si pris)
//   - Nouveau mot de passe : bcrypt cost 12, min 8 caractères
//   - Utilisateurs env-only (source='env') : changement impossible → réponse explicite
//   - Après changement de mot de passe : logout forcé (cookie supprimé → reconnexion requise)
//   - Rate-limit : 5 tentatives / 15 min par IP (réutilise rateLimit existant)

import { NextResponse }  from 'next/server'
import { cookies }       from 'next/headers'
import bcrypt            from 'bcryptjs'
import prisma            from '@/lib/db'
import {
  verifyToken,
  verifyPassword,
  SESSION_COOKIE,
  SESSION_DURATION,
  createToken,
} from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

// ── GET  — renvoie les infos non-sensibles du compte courant ──────────────────
export async function GET(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Utilisateurs .env : pas de ligne en base
  if (session.source === 'env') {
    return NextResponse.json({
      login:   session.login,
      name:    session.name,
      role:    session.role,
      source:  'env',
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where:  { id: session.userId },
      select: { login: true, name: true, role: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    return NextResponse.json({ ...user, source: 'db' })
  } catch (err) {
    console.error('[compte GET]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── PATCH — modifier login et/ou mot de passe et/ou nom ──────────────────────
export async function PATCH(request) {
  // Rate-limit anti-brute-force
  const ip = getClientIp(request)
  const rl  = await rateLimit(`compte:${ip}`, { limit: 5, windowMs: 15 * 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    )
  }

  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Utilisateurs .env : changement impossible via UI (modifier le .env directement)
  if (session.source === 'env') {
    return NextResponse.json(
      { error: 'Votre compte est géré par variables d\'environnement (.env). Modifiez ADMIN_LOGIN / ADMIN_PASSWORD dans votre fichier .env puis redémarrez l\'application.' },
      { status: 422 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const { motDePasseActuel, nouveauLogin, nouveauMotDePasse, nouveauNom } = body

  // Au moins un champ à modifier requis
  const hasChange = nouveauLogin || nouveauMotDePasse || nouveauNom
  if (!hasChange) {
    return NextResponse.json({ error: 'Aucune modification demandée' }, { status: 400 })
  }

  // Mot de passe actuel TOUJOURS requis
  if (!motDePasseActuel) {
    return NextResponse.json({ error: 'Le mot de passe actuel est requis pour confirmer les modifications' }, { status: 400 })
  }

  // Récupérer le compte en base
  let user
  try {
    user = await prisma.user.findUnique({
      where:  { id: session.userId },
      select: { id: true, login: true, password: true, role: true, name: true },
    })
  } catch (err) {
    console.error('[compte PATCH] DB lookup:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  }

  // Vérifier mot de passe actuel (timing-safe via verifyPassword existant)
  const mdpOk = await verifyPassword(motDePasseActuel, user.password, user.id)
  if (!mdpOk) {
    // Délai anti-timing
    await new Promise(r => setTimeout(r, 80 + Math.random() * 80))
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 })
  }

  // ── Validations des nouvelles valeurs ─────────────────────────────────────
  if (nouveauLogin !== undefined && nouveauLogin !== null) {
    const l = nouveauLogin.trim()
    if (!l || l.length < 3) {
      return NextResponse.json({ error: 'Le nouvel identifiant doit faire au moins 3 caractères' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(l)) {
      return NextResponse.json({ error: 'Identifiant invalide (lettres, chiffres, . _ - uniquement)' }, { status: 400 })
    }
    if (l !== user.login) {
      // Unicité
      const existing = await prisma.user.findUnique({ where: { login: l }, select: { id: true } })
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: `L'identifiant « ${l} » est déjà utilisé` }, { status: 409 })
      }
    }
  }

  if (nouveauMotDePasse !== undefined && nouveauMotDePasse !== null) {
    if (nouveauMotDePasse.length < 8) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' }, { status: 400 })
    }
    if (nouveauMotDePasse === motDePasseActuel) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit être différent de l\'actuel' }, { status: 400 })
    }
  }

  // ── Construire la mise à jour ──────────────────────────────────────────────
  const updateData = {}

  if (nouveauNom && nouveauNom.trim()) {
    updateData.name = nouveauNom.trim()
  }

  if (nouveauLogin && nouveauLogin.trim() && nouveauLogin.trim() !== user.login) {
    updateData.login = nouveauLogin.trim()
  }

  let passwordChanged = false
  if (nouveauMotDePasse) {
    updateData.password = await bcrypt.hash(nouveauMotDePasse, 12)
    passwordChanged = true
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true, message: 'Aucune modification nécessaire (valeurs identiques)' })
  }

  // ── Appliquer ──────────────────────────────────────────────────────────────
  try {
    const updated = await prisma.user.update({
      where:  { id: user.id },
      data:   updateData,
      select: { login: true, name: true, role: true },
    })

    // Si le mot de passe a changé → invalider la session courante (logout forcé)
    // L'utilisateur devra se reconnecter avec ses nouveaux identifiants
    if (passwordChanged) {
      const response = NextResponse.json({
        ok:      true,
        message: 'Mot de passe modifié. Vous allez être déconnecté pour vous reconnecter.',
        logout:  true,
      })
      response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   0,
        path:     '/',
      })
      return response
    }

    // Sinon (login ou nom seul changé) : réémettre un token à jour
    const newToken = await createToken({
      login:        updated.login,
      userId:       user.id,
      role:         updated.role,
      name:         updated.name,
      restaurantId: session.restaurantId || null,
      iat:          Date.now(),
      exp:          Date.now() + SESSION_DURATION,
    })

    const response = NextResponse.json({
      ok:      true,
      message: 'Compte mis à jour avec succès',
      login:   updated.login,
      name:    updated.name,
    })
    response.cookies.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   SESSION_DURATION / 1000,
      path:     '/',
    })
    return response

  } catch (err) {
    console.error('[compte PATCH] Update:', err)
    // Contrainte unicité Prisma P2002
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Cet identifiant est déjà utilisé' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }
}
