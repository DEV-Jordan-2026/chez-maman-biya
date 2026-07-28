import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

function numSemaine(date = new Date()) {
  const d = new Date(date); d.setHours(0,0,0,0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const w1 = new Date(d.getFullYear(), 0, 4)
  const wn = 1 + Math.round(((d-w1)/86400000 - 3 + (w1.getDay()+6)%7) / 7)
  return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`
}

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const semaine      = searchParams.get('semaine') || numSemaine()
  const userId       = searchParams.get('userId')  // employé → seulement son score

  const scores = await prisma.scorePerformance.findMany({
    where: {
      ...(restaurantId && { restaurantId }),
      semaine,
      ...(userId && { userId }),
    },
    orderBy: { scoreGlobal: 'desc' },
  })
  return NextResponse.json({ semaine, scores })
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { restaurantId, semaine } = await req.json()
  const sem = semaine || numSemaine()
  const [annee, wStr] = sem.split('-W')
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
      where: { userId: u.id, heure: { gte: debutSem, lt: finSem } },
      orderBy: { heure: 'asc' },
    })
    let heuresTravail = 0; let nbRetards = 0
    const arrivees = pointages.filter(p => p.type === 'arrivee')
    const departs  = pointages.filter(p => p.type === 'depart')
    for (let i = 0; i < Math.min(arrivees.length, departs.length); i++) {
      const diff = (new Date(departs[i].heure) - new Date(arrivees[i].heure)) / 3600000
      if (diff > 0 && diff < 16) heuresTravail += diff
      if (new Date(arrivees[i].heure).getHours() >= 9) nbRetards++
    }
    const joursPresents = arrivees.length
    const scorePresence = Math.max(0, Math.min(40, Math.round((joursPresents/5)*40) - nbRetards*3))
    const erreurs = await prisma.journalActivite.count({
      where: { auteur: u.name, type: 'erreur', createdAt: { gte: debutSem, lt: finSem } },
    })
    const scoreQualite = Math.max(0, 30 - erreurs*5)
    const nbCmd = u.role === 'staff' ? await prisma.journalActivite.count({
      where: { auteur: u.name, type: 'commande', createdAt: { gte: debutSem, lt: finSem } },
    }) : Math.floor(heuresTravail * 3)
    const scoreProductivite = Math.min(30, Math.round((nbCmd / Math.max(heuresTravail,1)) * 5))
    const scoreGlobal = Math.max(0, Math.min(100, scorePresence + scoreQualite + scoreProductivite))

    const score = await prisma.scorePerformance.upsert({
      where: { userId_semaine: { userId: u.id, semaine: sem } },
      update: { scoreGlobal, scorePresence, scoreProductivite, scoreQualite, nbHeuresTravail: Math.round(heuresTravail*10)/10, nbRetards, nbErreurs: erreurs, nbCommandesTraitees: nbCmd },
      create: { restaurantId: restaurantId || u.restaurantId || 'default', userId: u.id, userName: u.name, semaine: sem, scoreGlobal, scorePresence, scoreProductivite, scoreQualite, nbHeuresTravail: Math.round(heuresTravail*10)/10, nbRetards, nbErreurs: erreurs, nbCommandesTraitees: nbCmd },
    })
    resultats.push(score)
    await attribuerBadgesAuto(u.id, u.name, restaurantId || u.restaurantId || '', score, sem)
  }
  return NextResponse.json({ semaine: sem, nb: resultats.length, resultats })
}

async function attribuerBadgesAuto(userId, userName, restaurantId, score, semaine) {
  const regles = [
    { code: 'score_100',         condition: score.scoreGlobal === 100 },
    { code: 'presence_parfaite', condition: score.nbRetards === 0 && score.nbHeuresTravail >= 30 },
    { code: 'zero_erreur',       condition: score.nbErreurs === 0 && score.nbHeuresTravail >= 20 },
    { code: 'top_productif',     condition: score.scoreProductivite >= 25 },
  ]
  for (const r of regles) {
    if (!r.condition) continue
    const badge = await prisma.badge.findUnique({ where: { code: r.code } }).catch(() => null)
    if (!badge) continue
    await prisma.userBadge.upsert({
      where: { userId_badgeId_contexte: { userId, badgeId: badge.id, contexte: `Semaine ${semaine}` } },
      update: {}, create: { userId, userName, restaurantId, badgeId: badge.id, contexte: `Semaine ${semaine}` },
    }).catch(() => {})
  }
}
