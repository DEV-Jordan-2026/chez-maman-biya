// app/api/users/route.js
// GET  → super_admin : tous les utilisateurs
//        manager     : utilisateurs de son restaurant uniquement (usage RH : évaluations, badges)
// POST → créer un utilisateur — super_admin uniquement

import { NextResponse }              from 'next/server'
import { cookies }                   from 'next/headers'
import prisma                        from '@/lib/db'
import { requireAuth, hashPassword } from '@/lib/auth'  // hashPassword centralisé
import { sanitize }                  from '@/lib/validate'

const ROLES_VALIDES = ['manager', 'caissier', 'staff', 'serveur', 'magasinier']
// Note : on ne peut pas créer un autre super_admin depuis l'UI

// ── GET — liste des utilisateurs ─────────────────────────────────────────────
export async function GET(request) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)

  if (!session || !['super_admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé — super_admin ou manager requis' }, { status: 403 })
  }

  try {
    // super_admin voit tous les utilisateurs ; manager voit uniquement son restaurant
    const where = session.role === 'super_admin'
      ? {}
      : { restaurantId: session.restaurantId }

    const users = await prisma.user.findMany({
      where,
      select: {
        id:        true,
        login:     true,
        role:      true,
        name:      true,
        actif:     true,
        createdAt: true,
        updatedAt: true,
        // ❌ password jamais retourné
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(users)
  } catch (err) {
    console.error('[GET /api/users]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── POST — créer un utilisateur ───────────────────────────────────────────────
export async function POST(request) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)

  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — super_admin requis' }, { status: 403 })
  }

  try {
    const { login, password, role, name, restaurantId } = await request.json()

    // ── Validation ────────────────────────────────────────────────────────
    if (!login || !password || !role || !name) {
      return NextResponse.json(
        { error: 'Champs requis : login, password, role, name' },
        { status: 400 }
      )
    }

    if (!ROLES_VALIDES.includes(role)) {
      return NextResponse.json(
        { error: `Rôle invalide. Valeurs acceptées : ${ROLES_VALIDES.join(', ')}` },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit faire au moins 8 caractères' },
        { status: 400 }
      )
    }

    const loginPropre = sanitize(login, 50).toLowerCase().replace(/\s/g, '_')

    // ── Vérifier unicité du login ────────────────────────────────────────
    const existant = await prisma.user.findUnique({ where: { login: loginPropre } })
    if (existant) {
      return NextResponse.json(
        { error: `Le login "${loginPropre}" est déjà utilisé` },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        login:        loginPropre,
        password:     passwordHash,
        role,
        name:         sanitize(name, 100),
        actif:        true,
        restaurantId: restaurantId?.trim() || null,
      },
      select: {
        id: true, login: true, role: true, name: true, actif: true, restaurantId: true, createdAt: true,
      },
    })

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: session.restaurantId,
      auteur: session.name || session.login,
      action: `Employé créé : ${loginPropre} (${role})`,
      type: 'equipe', ref: user.id,
    }}).catch(err => console.error('[journal]', err.message))

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Ce login est déjà utilisé' }, { status: 409 })
    }
    console.error('[POST /api/users]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
