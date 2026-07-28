// app/api/achats/demandes/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth, ROLES_PERMISSIONS } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const status = searchParams.get('status')

  const where = {
    ...(restaurantId && { restaurantId }),
    ...(status && { status }),
  }

  const demandes = await prisma.demandeAchat.findMany({
    where,
    orderBy: [
      { urgence: 'desc' },
      { createdAt: 'desc' },
    ],
  })
  return NextResponse.json(demandes)
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const perms = ROLES_PERMISSIONS[session.role]
  if (!perms?.canCreateDemandeAchat)
    return NextResponse.json({ error: 'Vous n\'avez pas la permission de créer une demande d\'achat' }, { status: 403 })

  const body = await req.json()
  const { restaurantId, article, quantite, unite, montantEstime, motif, urgence } = body

  if (!article?.trim() || !quantite || !unite?.trim())
    return NextResponse.json({ error: 'Article, quantité et unité sont requis' }, { status: 400 })

  const restoId = restaurantId || session.restaurantId
  if (!restoId) return NextResponse.json({ error: 'Restaurant non défini' }, { status: 400 })

  const demande = await prisma.demandeAchat.create({
    data: {
      restaurantId: restoId,
      demandeurId:  session.userId || session.login,
      demandeurNom: session.name,
      article:      article.trim(),
      quantite:     parseFloat(quantite),
      unite:        unite.trim(),
      montantEstime: montantEstime ? parseInt(montantEstime) : null,
      motif:        motif?.trim() || null,
      urgence:      urgence || 'normale',
      status:       'en_attente',
    },
  })

  await prisma.journalActivite.create({
    data: {
      auteur: session.name,
      action: `Demande d'achat créée : ${article} (×${quantite} ${unite})`,
      type: 'achats', ref: demande.id,
    },
  })

  return NextResponse.json(demande, { status: 201 })
}
