// app/api/facture/verify/route.js
// GET /api/facture/verify?id=<commandeId>&h=<hmac>
// Route PUBLIQUE — pas d'auth requise (accessible depuis le QR code)
// Retourne les données de la facture si le hash est valide.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { verifierFacture } from '@/lib/factureQR'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id   = searchParams.get('id')
    const hash = searchParams.get('h')

    // ── Validation des paramètres ─────────────────────────────────────────
    if (!id || !hash) {
      return NextResponse.json(
        { valid: false, error: 'Paramètres manquants (id, h)' },
        { status: 400 }
      )
    }

    // ── Récupération de la commande ───────────────────────────────────────
    const commande = await prisma.commande.findUnique({
      where: { id },
      select: {
        id:            true,
        numeroFacture: true,
        total:         true,
        restaurantId:  true,
        createdAt:     true,
        client:        true,
        mode:          true,
        paiement:      true,
        items:         true,
        status:        true,
        restaurant: {
          select: {
            nom:      true,
            adresse:  true,
            tel:      true,
            parametres: true,
          }
        }
      },
    })

    if (!commande) {
      return NextResponse.json(
        { valid: false, error: 'Facture introuvable' },
        { status: 404 }
      )
    }

    // ── Vérification HMAC ─────────────────────────────────────────────────
    const factureData = {
      id:            commande.id,
      numeroFacture: commande.numeroFacture,
      total:         commande.total,
      restaurantId:  commande.restaurantId,
      createdAt:     commande.createdAt,
    }
    const isValid = await verifierFacture(factureData, hash)

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: 'Signature invalide — document potentiellement falsifié' },
        { status: 401 }
      )
    }

    // ── Extraire NIU / RCCM depuis les parametres du restaurant ──────────
    const params = commande.restaurant?.parametres || {}
    const niu    = params.niu  || params.NIU  || null
    const rccm   = params.rccm || params.RCCM || null

    // ── Réponse — données visibles par le client ──────────────────────────
    return NextResponse.json({
      valid:         true,
      numeroFacture: commande.numeroFacture || commande.id,
      date:          commande.createdAt,
      total:         commande.total,
      mode:          commande.mode,
      paiement:      commande.paiement,
      status:        commande.status,
      restaurant: {
        nom:     commande.restaurant?.nom     || 'Chez Maman Biya',
        adresse: commande.restaurant?.adresse || null,
        tel:     commande.restaurant?.tel     || null,
        niu,
        rccm,
      },
    })
  } catch (err) {
    console.error('[GET /api/facture/verify]', err)
    return NextResponse.json(
      { valid: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
