import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

const CRITERES_MANAGER_VERS_STAFF = [
  { id: 'ponctualite',  label: 'Ponctualité' },
  { id: 'qualite',      label: 'Qualité du travail' },
  { id: 'attitude',     label: 'Attitude & relationnel' },
  { id: 'initiative',   label: 'Initiative & autonomie' },
  { id: 'proprete',     label: 'Respect des normes d\'hygiène' },
]

const CRITERES_STAFF_CONDITIONS = [
  { id: 'ambiance',     label: 'Ambiance de travail' },
  { id: 'management',   label: 'Management & communication' },
  { id: 'materiel',     label: 'Qualité du matériel' },
  { id: 'charge',       label: 'Charge de travail' },
  { id: 'reconnaissance', label: 'Reconnaissance & valorisation' },
]

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const periode = searchParams.get('periode')
  const type    = searchParams.get('type')
  const evals = await prisma.evaluation.findMany({
    where: { ...(restaurantId && { restaurantId }), ...(periode && { periode }), ...(type && { type }) },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  // Pour super_admin : renvoyer les critères disponibles aussi
  if (session.role === 'super_admin') {
    return NextResponse.json({ evaluations: evals, criteres: { manager_vers_staff: CRITERES_MANAGER_VERS_STAFF, staff_vers_conditions: CRITERES_STAFF_CONDITIONS } })
  }
  return NextResponse.json({ evaluations: evals.filter(e => e.type !== 'staff_vers_conditions' || session.role === 'super_admin') })
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  const { restaurantId, type, evalueId, evalueNom, periode, criteres, pointsForts, axesAmelioration } = body

  if (!type || !criteres || !periode)
    return NextResponse.json({ error: 'Type, critères et période requis' }, { status: 400 })

  // Validation rôle
  if (type === 'manager_vers_staff' && !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 })

  const notes = criteres.map(c => c.note || 0).filter(n => n > 0)
  const noteGlobale = notes.length > 0 ? Math.round((notes.reduce((s,n) => s+n, 0) / notes.length) * 10) / 10 : 0

  const eval_ = await prisma.evaluation.create({
    data: {
      restaurantId: restaurantId || session.restaurantId || '',
      type,
      // Anonymat pour staff_vers_conditions
      evaluateurId: type === 'staff_vers_conditions' ? null : (session.userId || session.login),
      evalueId:  type === 'manager_vers_staff' ? evalueId : null,
      evalueNom: type === 'manager_vers_staff' ? evalueNom : null,
      periode, criteres, noteGlobale,
      pointsForts:       pointsForts?.trim()       || null,
      axesAmelioration:  axesAmelioration?.trim()  || null,
    },
  })
  return NextResponse.json(eval_, { status: 201 })
}
