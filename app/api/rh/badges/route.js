import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

// Catalogue de badges du système
export const BADGES_CATALOGUE = [
  { code: 'score_100',         label: 'Score parfait',       emoji: '💯', couleur: '#C9973C', description: 'Score de performance de 100/100 sur une semaine' },
  { code: 'presence_parfaite', label: 'Présence exemplaire', emoji: '⭐', couleur: '#10b981', description: 'Aucun retard, semaine complète de 30h+' },
  { code: 'zero_erreur',       label: 'Zéro défaut',         emoji: '🎯', couleur: '#8b5cf6', description: 'Aucune erreur signalée sur 20h+ de travail' },
  { code: 'top_productif',     label: 'Top productivité',    emoji: '🚀', couleur: '#06b6d4', description: 'Score productivité ≥ 25/30' },
  { code: 'anciennete_1an',    label: '1 an dans l\'équipe', emoji: '🎖️', couleur: '#f59e0b', description: 'Membre de l\'équipe depuis plus d\'un an' },
  { code: 'meilleur_mois',     label: 'Meilleur du mois',    emoji: '🏆', couleur: '#ef4444', description: 'Meilleur score de performance du mois' },
  { code: 'formateur',         label: 'Formateur',           emoji: '📚', couleur: '#84cc16', description: 'A participé à la formation d\'un nouveau membre' },
  { code: 'ponctualite_30j',   label: 'Ponctualité 30j',     emoji: '⏰', couleur: '#06b6d4', description: 'Aucun retard sur 30 jours consécutifs' },
]

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const userId       = searchParams.get('userId')

  // Sécurité : employé ne peut voir que ses propres badges
  const estEmploye   = !['super_admin','manager'].includes(session.role)
  const userIdFiltré = estEmploye ? (session.userId || session.login) : userId

  const userBadges = await prisma.userBadge.findMany({
    where: {
      ...(restaurantId && { restaurantId }),
      ...(userIdFiltré && { userId: userIdFiltré }),
    },
    include: { badge: true },
    orderBy: { obtenuLe: 'desc' },
  })
  return NextResponse.json({ badges: BADGES_CATALOGUE, userBadges })
}

export async function POST(req) {
  // Attribution manuelle d'un badge par un manager
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { restaurantId, userId, userName, badgeCode, contexte } = await req.json()
  const badge = await prisma.badge.findUnique({ where: { code: badgeCode } })
  if (!badge) return NextResponse.json({ error: 'Badge inconnu' }, { status: 400 })

  const ub = await prisma.userBadge.create({
    data: { userId, userName, restaurantId: restaurantId || session.restaurantId || '', badgeId: badge.id, contexte: contexte || `Attribué par ${session.name}` },
    include: { badge: true },
  })
  return NextResponse.json(ub, { status: 201 })
}
