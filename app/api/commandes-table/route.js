import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

function genId() { return 'TBL-' + randomBytes(4).toString('hex').toUpperCase() }

export async function GET(request) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')
  const status  = searchParams.get('status')

  const where = {}
  if (status) where.status = status
  else        where.status = { notIn: ['ferme', 'annule'] }

  // Isolation tenant : CommandeTable n'a pas de restaurantId direct —
  // on filtre via la relation Table (tableId → table.restaurantId)
  if (tableId) {
    // Si une table spécifique est demandée, vérifier qu'elle appartient au restaurant
    if (session.role !== 'super_admin' && session.restaurantId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, restaurantId: session.restaurantId },
      })
      if (!table) return NextResponse.json({ error: 'Table introuvable ou accès refusé' }, { status: 404 })
    }
    where.tableId = tableId
  } else if (session.role !== 'super_admin' && session.restaurantId) {
    // Sans tableId : limiter aux tables du restaurant
    const tableIds = await prisma.table.findMany({
      where:  { restaurantId: session.restaurantId },
      select: { id: true },
    })
    where.tableId = { in: tableIds.map(t => t.id) }
  }

  const commandes = await prisma.commandeTable.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(commandes)
}

export async function POST(request) {
  const cookieStore = await cookies()
  const session = await requireAuth(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const { tableId, items = [], note, nbCouverts = 1 } = await request.json()
    if (!tableId) return NextResponse.json({ error: "L'identifiant de la table est requis" }, { status: 400 })

    // Vérifier que la table appartient au restaurant (isolation tenant)
    if (session.restaurantId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, restaurantId: session.restaurantId },
      })
      if (!table) return NextResponse.json({ error: 'Table introuvable ou accès refusé' }, { status: 404 })
    }

    const total = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
    const cmd = await prisma.commandeTable.create({
      data: {
        id: genId(),
        tableId,
        serveurId: session.login,
        items,
        total,
        note: note || null,
        nbCouverts: parseInt(nbCouverts),
        status: 'ouvert',
      },
    })
    // Marquer la table comme occupée
    await prisma.table.update({ where: { id: tableId }, data: { status: 'occupee', commandeId: cmd.id } })
    return NextResponse.json(cmd, { status: 201 })
  } catch (err) {
    console.error('[POST /api/commandes-table]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
