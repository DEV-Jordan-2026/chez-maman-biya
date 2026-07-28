// @author TSJORDAN - Dev
// app/table/[id]/page.js
import { notFound } from 'next/navigation'
import prisma from '@/lib/db'
import TableCommandeClient from '@/components/TableCommandeClient'

export const dynamic = 'force-dynamic'

async function getTableData(id) {
  const table = await prisma.table.findUnique({
    where: { id },
    include: {
      restaurant: {
        select: { id: true, nom: true, ville: true, quartier: true, tel: true },
      },
    },
  })

  if (!table) return null

  const menu = await prisma.menuItem.findMany({
    where: {
      actif: true,
      ...(table.restaurantId ? { restaurantId: table.restaurantId } : {}),
    },
    orderBy: [{ cat: 'asc' }, { popular: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, price: true, cat: true, emoji: true, desc: true, popular: true, tempsPrep: true },
  })

  const commandeOuverte = table.commandeId
    ? await prisma.commandeTable.findUnique({
        where:  { id: table.commandeId },
        select: { id: true, items: true, total: true, status: true, nbCouverts: true, note: true },
      })
    : null

  return {
    table: {
      id:       table.id,
      numero:   table.numero,
      zone:     table.zone,
      capacite: table.capacite,
      status:   table.status,
    },
    restaurant: table.restaurant,
    menu,
    commandeOuverte,
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params
  try {
    const data = await getTableData(id)
    if (!data) return { title: 'Commander | Chez Maman Biya' }
    return {
      title: `Table ${data.table?.numero} | ${data.restaurant?.nom || 'Chez Maman Biya'}`,
      description: 'Commandez directement depuis votre table.',
    }
  } catch {
    return { title: 'Commander | Chez Maman Biya' }
  }
}

export default async function TablePage({ params }) {
  const { id } = await params
  let data
  try {
    data = await getTableData(id)
  } catch (err) {
    console.error('[TablePage]', err)
    notFound()
  }
  if (!data) notFound()
  return <TableCommandeClient tableId={id} initial={data} />
}
