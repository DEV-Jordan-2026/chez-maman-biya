import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

const STATUTS_MODIFIABLES = ['nouveau', 'en_cours', 'pret']

export async function POST(request, context) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || !['super_admin', 'manager', 'caissier'].includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const { montant, motif } = await request.json()

    if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    if (!motif?.trim())           return NextResponse.json({ error: 'Motif requis' }, { status: 400 })

    const commande = await prisma.commande.findUnique({ where: { id } })
    if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

    // Vérification d'ownership multi-tenant
    if (session.role !== 'super_admin' && commande.restaurantId && commande.restaurantId !== session.restaurantId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // FIX-REMISE — Bloquer la remise sur une commande déjà encaissée ou annulée
    // Une remise post-facturation violerait l'intégrité DGI (numéro de facture déjà émis)
    if (!STATUTS_MODIFIABLES.includes(commande.status)) {
      return NextResponse.json({
        error: `Remise impossible sur une commande au statut "${commande.status}". Seules les commandes en cours peuvent recevoir une remise.`,
      }, { status: 409 })
    }

    // Plafonner la remise au total actuel (éviter les totaux négatifs intentionnels)
    const montantSanitize = Math.min(parseInt(montant), commande.total)
    const nouveauTotal = Math.max(0, commande.total - montantSanitize)

    const [remise, updated] = await prisma.$transaction([
      prisma.remiseManuelle.create({
        data: { commandeId: id, montant: montantSanitize, motif: motif.trim(), appliquePar: session.name || session.login },
      }),
      prisma.commande.update({ where: { id }, data: { total: nouveauTotal } }),
    ])

    return NextResponse.json({ remise, total: nouveauTotal })
  } catch (err) {
    console.error('[POST /api/commandes/[id]/remise]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
