import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const semaineLundi = searchParams.get('semaine')
  const where = {
    ...(restaurantId && { restaurantId }),
    ...(semaineLundi && { date: { gte: semaineLundi, lt: new Date(new Date(semaineLundi).getTime() + 7*86400000).toISOString().split('T')[0] } }),
  }
  const shifts = await prisma.planningShift.findMany({ where, orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }] })
  const users  = ['super_admin','manager'].includes(session.role)
    ? await prisma.user.findMany({ where: { ...(restaurantId && { restaurantId }), actif: true }, select: { id: true, name: true, role: true } })
    : []
  return NextResponse.json({ shifts, users })
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const body = await req.json()
  const toCreate = Array.isArray(body.shifts) ? body.shifts : [body]
  const created = []
  for (const s of toCreate) {
    if (!s.userId || !s.date || !s.heureDebut || !s.heureFin) continue
    created.push(await prisma.planningShift.create({
      data: { restaurantId: body.restaurantId || session.restaurantId || '', userId: s.userId, userName: s.userName || '', userRole: s.userRole || 'staff', date: s.date, heureDebut: s.heureDebut, heureFin: s.heureFin, poste: s.poste || 'Salle', note: s.note || null, createdBy: session.name },
    }))
  }
  return NextResponse.json({ created, nb: created.length }, { status: 201 })
}

export async function PATCH(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { id, ...data } = await req.json()
  const updated = await prisma.planningShift.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(req) {
  const session = await requireAuth(await cookies())
  if (!session || !['super_admin','manager'].includes(session.role))
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  const { id } = await req.json()
  await prisma.planningShift.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
