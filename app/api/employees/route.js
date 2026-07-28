// app/api/employees/route.js
// Dossier RH complet des employés (fiche administrative)
// GET  ?userId=xx → récupère le profil d'un employé
// POST             → crée ou met à jour le profil d'un employé
// Accès : super_admin, manager (son restaurant uniquement)

import { NextResponse }              from 'next/server'
import { cookies }                   from 'next/headers'
import prisma                        from '@/lib/db'
import { requireAuth }               from '@/lib/auth'

const ROLES_AUTORISES = ['super_admin', 'manager']

export async function GET(request) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)
  if (!session || !ROLES_AUTORISES.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  try {
    if (userId) {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId },
        include: { user: { select: { id: true, name: true, login: true, role: true, restaurantId: true } } },
      })
      if (!profile) return NextResponse.json(null)
      // Manager → uniquement son restaurant
      if (session.role === 'manager' && profile.user.restaurantId !== session.restaurantId) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
      return NextResponse.json(profile)
    }

    // Liste tous les profils
    const profiles = await prisma.employeeProfile.findMany({
      where: session.role === 'manager' ? { restaurantId: session.restaurantId } : {},
      include: { user: { select: { id: true, name: true, login: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(profiles)
  } catch (err) {
    console.error('[GET /api/employees]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)
  if (!session || !ROLES_AUTORISES.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { userId, ...data } = body

    if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    // Manager → uniquement son restaurant
    if (session.role === 'manager' && user.restaurantId !== session.restaurantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Nettoyer les champs sensibles non modifiables ici
    const { id: _id, createdAt: _ca, updatedAt: _ua, user: _u, ...safeData } = data

    // upsert : crée si absent, met à jour si présent
    const profile = await prisma.employeeProfile.upsert({
      where: { userId },
      create: {
        userId,
        restaurantId: user.restaurantId || null,
        ...safeData,
      },
      update: {
        ...safeData,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(profile, { status: 200 })
  } catch (err) {
    console.error('[POST /api/employees]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
