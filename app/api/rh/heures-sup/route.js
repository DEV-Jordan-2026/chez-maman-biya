import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

// Code du travail camerounais : seuil 40h/sem, majoration 1.5x jusqu'à 48h, 2x au-delà
const SEUIL_NORMAL = 40
const SEUIL_2X     = 48
const TAUX_1_5     = 1.5
const TAUX_2       = 2.0
// Salaire horaire de base en FCFA (paramétrable par restaurant)
const TAUX_HORAIRE_DEFAULT = 500

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  // Note : super_admin et manager voient tout, les employés voient seulement leurs propres données (filtré ci-dessous)

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const semaine      = searchParams.get('semaine')
  const userId       = searchParams.get('userId') // employé filtre sur lui-même

  // Sécurité : un employé ne peut voir que ses propres données
  const estEmploye = !['super_admin','manager'].includes(session.role)
  const userIdFiltré = estEmploye ? (session.userId || session.login) : userId

  const hs = await prisma.heureSupplementaire.findMany({
    where: {
      ...(restaurantId && { restaurantId }),
      ...(semaine && { semaine }),
      ...(userIdFiltré && { userId: userIdFiltré }),
    },
    orderBy: [{ semaine: 'desc' }, { statut: 'asc' }],
  })
  return NextResponse.json(hs)
}

export async function POST(req) {
  // Calcul automatique des heures sup pour une semaine
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { restaurantId, semaine, tauxHoraire } = await req.json()
  if (!semaine) return NextResponse.json({ error: 'Semaine requise (ex: 2026-W22)' }, { status: 400 })

  const taux = tauxHoraire || TAUX_HORAIRE_DEFAULT
  const [annee, wStr] = semaine.split('-W')
  const w = parseInt(wStr)
  const jan4 = new Date(parseInt(annee), 0, 4)
  const debutSem = new Date(jan4.getTime() + (w-1)*7*86400000)
  debutSem.setDate(debutSem.getDate() - (debutSem.getDay()+6)%7)
  const finSem = new Date(debutSem.getTime() + 7*86400000)

  const users = await prisma.user.findMany({
    where: { ...(restaurantId && { restaurantId }), actif: true, role: { notIn: ['super_admin'] } },
  })

  const resultats = []
  for (const u of users) {
    const pointages = await prisma.pointage.findMany({
      where: { userId: u.id, heure: { gte: debutSem, lt: finSem } }, orderBy: { heure: 'asc' },
    })
    let heuresTotal = 0
    const arrivees = pointages.filter(p => p.type === 'arrivee')
    const departs  = pointages.filter(p => p.type === 'depart')
    for (let i = 0; i < Math.min(arrivees.length, departs.length); i++) {
      const diff = (new Date(departs[i].heure) - new Date(arrivees[i].heure)) / 3600000
      if (diff > 0 && diff < 16) heuresTotal += diff
    }
    if (heuresTotal <= SEUIL_NORMAL) continue // pas d'heures sup

    const heuresSup = heuresTotal - SEUIL_NORMAL
    const hsA_1_5   = Math.min(heuresSup, SEUIL_2X - SEUIL_NORMAL)
    const hsA_2_0   = Math.max(0, heuresSup - (SEUIL_2X - SEUIL_NORMAL))
    const montant   = Math.round((hsA_1_5 * taux * TAUX_1_5) + (hsA_2_0 * taux * TAUX_2))
    const majoration = heuresSup > (SEUIL_2X - SEUIL_NORMAL) ? TAUX_2 : TAUX_1_5

    const hs = await prisma.heureSupplementaire.upsert({
      where: { userId_semaine: { userId: u.id, semaine } },
      update: { heuresNormales: Math.round(Math.min(heuresTotal, SEUIL_NORMAL)*10)/10, heuresSup: Math.round(heuresSup*10)/10, tauxMajoration: majoration, montantBrut: montant },
      create: { restaurantId: restaurantId || u.restaurantId || '', userId: u.id, userName: u.name, semaine, heuresNormales: Math.min(heuresTotal, SEUIL_NORMAL), heuresSup: Math.round(heuresSup*10)/10, tauxMajoration: majoration, montantBrut: montant },
    })
    resultats.push(hs)
  }
  return NextResponse.json({ semaine, nb: resultats.length, resultats })
}

export async function PATCH(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { id, statut, note } = await req.json()
  const updated = await prisma.heureSupplementaire.update({
    where: { id }, data: { statut, ...(statut === 'approuvee' && { approuvePar: session.name }), ...(note && { note }) },
  })
  return NextResponse.json(updated)
}
