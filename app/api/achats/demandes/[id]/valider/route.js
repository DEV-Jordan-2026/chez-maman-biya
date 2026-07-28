// app/api/achats/demandes/[id]/valider/route.js — v13
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

// SEUIL_ADMIN_FCFA : si montant > ce seuil, le super_admin doit valider aussi
const SEUIL_ADMIN = 100_000

export async function POST(req, { params }) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action, motifRefus } = body // action: "approuver" | "refuser"

  if (!['approuver', 'refuser'].includes(action))
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })

  const demande = await prisma.demandeAchat.findUnique({ where: { id } })
  if (!demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  if (!['manager', 'super_admin'].includes(session.role))
    return NextResponse.json({ error: 'Réservé aux managers et administrateurs' }, { status: 403 })

  let newStatus
  if (action === 'refuser') {
    if (!motifRefus?.trim()) return NextResponse.json({ error: 'Motif de refus requis' }, { status: 400 })
    newStatus = 'refusee'
  } else {
    // Approbation
    if (session.role === 'manager') {
      // Montant élevé → remonter au super_admin
      newStatus = (demande.montantEstime && demande.montantEstime > SEUIL_ADMIN)
        ? 'en_attente_admin'
        : 'approuvee_manager'
    } else {
      // super_admin approuve directement
      newStatus = 'approuvee_admin'
    }
  }

  const updated = await prisma.demandeAchat.update({
    where: { id },
    data: {
      status:      newStatus,
      valideePar:  action === 'approuver' ? session.name : undefined,
      refuseePar:  action === 'refuser'   ? session.name : undefined,
      motifRefus:  action === 'refuser'   ? motifRefus.trim() : undefined,
    },
  })

  await prisma.journalActivite.create({
    data: {
      auteur: session.name,
      action: `Demande achat "${demande.article}" ${action === 'approuver' ? 'approuvée' : 'refusée'}`,
      type: 'achats', ref: id,
    },
  })

  return NextResponse.json(updated)
}
