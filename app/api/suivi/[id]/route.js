// app/api/suivi/[id]/route.js
// Route PUBLIQUE — retourne uniquement les champs nécessaires au suivi
// Aucune donnée personnelle exposée (pas de tel, addr, note)

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'

export async function GET(request, { params }) {
  try {
    const { id } = await params // Next.js 15 : params est async

    if (!id || !/^CMD-[A-F0-9]{8}$/.test(id)) {
      return NextResponse.json({ error: 'ID de commande invalide' }, { status: 400 })
    }

    const commande = await prisma.commande.findUnique({
      where: { id },
      select: {
        id:             true,
        status:         true,
        mode:           true,
        items:          true,
        total:          true,
        paiement:       true,   // pour afficher le mode de paiement
        rembStatut:     true,   // pour afficher le statut de remboursement
        rembMontant:    true,
        // v22 — champs acompte (publics : ne contiennent pas de données sensibles)
        acompte:        true,
        resteARegler:   true,
        acompteStatut:  true,
        createdAt:      true,
        updatedAt:      true,
        // ❌ NE PAS exposer : tel, addr, note, client, transactionId, acompteTransId
      },
    })

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    return NextResponse.json(commande)
  } catch (err) {
    console.error('[GET /api/suivi/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
