import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireLivreur } from '@/lib/auth'
import { cookies } from 'next/headers'

// v26 — Profil du livreur connecté + ses commandes en cours de livraison
export async function GET() {
  const cookieStore = await cookies()
  const session = await requireLivreur(cookieStore)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const livreur = await prisma.livreur.findUnique({
    where: { id: session.livreurId },
    select: { id: true, nom: true, tel: true, status: true, zones: true },
  })
  if (!livreur) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const commandes = await prisma.commande.findMany({
    where:   { livreurId: session.livreurId, status: 'en_livraison' },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true, client: true, tel: true, addr: true, total: true, note: true,
      paiement: true, acompte: true, resteARegler: true, acompteStatut: true,
    },
  })

  // v29 — Récap du jour : livraisons terminées + espèces collectées aujourd'hui
  const debutJour = new Date()
  debutJour.setHours(0, 0, 0, 0)

  const livreesAujourdhui = await prisma.commande.findMany({
    where: {
      livreurId: session.livreurId,
      encaisseAt: { gte: debutJour },
    },
    select: { encaisseMethode: true, encaisseMontant: true },
  })

  const stats = {
    nbLivraisons: livreesAujourdhui.length,
    especes: livreesAujourdhui
      .filter(c => c.encaisseMethode === 'especes')
      .reduce((s, c) => s + (c.encaisseMontant || 0), 0),
  }

  return NextResponse.json({ livreur, commandes, stats })
}
