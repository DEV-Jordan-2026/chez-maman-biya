// app/api/users/[id]/route.js — v13
// GET    → lire un utilisateur (+ include=permissions)
// PATCH  → modifier nom, rôle, mot de passe, actif, restaurantId
// DELETE → désactiver (soft delete) — super_admin uniquement

import { NextResponse }              from 'next/server'
import { cookies }                   from 'next/headers'
import prisma                        from '@/lib/db'
import { requireAuth, hashPassword } from '@/lib/auth'
import { sanitize }                  from '@/lib/validate'

const ROLES_VALIDES = ['manager','caissier','staff','serveur','magasinier']

async function checkAccess(cookieStore) {
  const session = await requireAuth(cookieStore)
  if (!session || !['super_admin','manager'].includes(session.role)) return null
  return session
}

// ── GET — lire un utilisateur ─────────────────────────────────────────────────
export async function GET(request, context) {
  const cookieStore = await cookies()
  if (!await checkAccess(cookieStore))
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id }  = await context.params
  const { searchParams } = new URL(request.url)
  const include = searchParams.get('include')

  const user = await prisma.user.findUnique({
    where:  { id },
    select: {
      id: true, login: true, role: true, name: true, actif: true,
      restaurantId: true, createdAt: true, updatedAt: true,
      ...(include === 'permissions' && {
        permissions: { include: { permission: true } },
      }),
    },
  })
  if (!user) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(user)
}

// ── PATCH — modifier un utilisateur ──────────────────────────────────────────
export async function PATCH(request, context) {
  const cookieStore = await cookies()
  if (!await checkAccess(cookieStore)) {
    return NextResponse.json({ error: 'Accès refusé — super_admin ou manager requis' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const { name, role, password, actif, restaurantId } = await request.json()

    const data = {}

    if (name         !== undefined) data.name         = sanitize(name, 100)
    if (actif        !== undefined) data.actif        = Boolean(actif)
    if (restaurantId !== undefined) data.restaurantId = restaurantId || null

    if (role !== undefined) {
      if (!ROLES_VALIDES.includes(role)) {
        return NextResponse.json(
          { error: `Rôle invalide. Valeurs acceptées : ${ROLES_VALIDES.join(', ')}` },
          { status: 400 }
        )
      }
      data.role = role
    }

    if (password !== undefined) {
      if (password.length < 8) {  // C3-FIX — harmonisé avec POST /api/users (min 8 partout)
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 8 caractères' },
          { status: 400 }
        )
      }
      data.password = await hashPassword(password)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const session = await requireAuth(await cookies())

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, login: true, role: true, name: true, actif: true, restaurantId: true, updatedAt: true },
    })

    // Journal d'activité (non-bloquant)
    if (session) {
      const changements = Object.keys(data)
        .filter(k => k !== 'password')
        .map(k => k === 'actif' ? `actif=${data[k]}` : k)
        .join(', ')
      prisma.journalActivite.create({ data: {
        restaurantId: session.restaurantId || user.restaurantId || null,
        auteur: session.name || session.login,
        action: `Employé modifié : ${user.login} (${changements || 'mot de passe'})`,
        type: 'equipe', ref: id,
      }}).catch(err => console.error('[journal users PATCH]', err.message))
    }

    return NextResponse.json(user)
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }
    console.error('[PATCH /api/users/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── DELETE — désactiver un utilisateur (soft delete) ─────────────────────────
// On ne supprime pas physiquement pour conserver l'historique des actions
export async function DELETE(request, context) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — super_admin requis' }, { status: 403 })
  }

  try {
    const { id } = await context.params

    const cible = await prisma.user.findUnique({ where: { id }, select: { role: true, login: true } })
    if (!cible) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }
    if (cible.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Impossible de désactiver un super_admin' },
        { status: 403 }
      )
    }

    await prisma.user.update({
      where: { id },
      data:  { actif: false },
    })

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: session.restaurantId,
      auteur: session.name || session.login,
      action: `Employé désactivé : ${cible.login}`,
      type: 'equipe', ref: id,
    }}).catch(err => console.error('[journal]', err.message))

    return NextResponse.json({ ok: true, message: 'Utilisateur désactivé' })
  } catch (err) {
    console.error('[DELETE /api/users/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
