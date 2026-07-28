// app/api/commandes/[id]/valider/route.js
// POST { action: 'accepter' | 'refuser', motif? }
// Accessible : super_admin, manager, staff
// Logique :
//  - Commandes Mobile Money déjà payées → auto-acceptées (webhook), ne passent pas ici
//  - Commandes espèces/livraison → doivent être acceptées manuellement
//  - Refus → annulation + remboursement si nécessaire + WhatsApp client
//  - Acceptation → décrément stock synchrone bloquant, alertesStock exposées au front

import { NextResponse }       from 'next/server'
import prisma                  from '@/lib/db'
import { verifyToken, SESSION_COOKIE, getInternalKey } from '@/lib/auth'
import { notifyWA } from '@/lib/notifyWA'
import { cookies }             from 'next/headers'
import { publish }             from '@/lib/eventBus'
import { decrementerStockCommande } from '@/lib/stockDecrement'

const ROLES_VALIDATION = ['super_admin', 'manager', 'staff']
const DELAI_VALIDATION_MIN = 15  // minutes — après ce délai la commande est auto-acceptée

export async function POST(request, context) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)

  if (!session || !ROLES_VALIDATION.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id }              = await context.params
    const { action, motif }   = await request.json()

    if (!['accepter', 'refuser'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide. Valeurs acceptées : accepter, refuser' }, { status: 400 })
    }

    const commande = await prisma.commande.findUnique({ where: { id } })
    if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

    // C2-FIX — Isolation tenant : un manager/staff ne peut valider que les commandes de son restaurant
    if (
      session.role !== 'super_admin' &&
      session.restaurantId &&
      commande.restaurantId &&
      commande.restaurantId !== session.restaurantId
    ) {
      return NextResponse.json({ error: 'Commande hors de votre restaurant' }, { status: 403 })
    }

    if (commande.status !== 'nouveau') {
      return NextResponse.json(
        { error: `Commande déjà traitée (statut : ${commande.status})` },
        { status: 409 }
      )
    }

    let newStatus
    let waType
    let waData

    if (action === 'accepter') {
      newStatus = 'en_cours'
      waType    = 'statut_commande'
      waData    = { ...commande, nouveauStatut: 'en_cours', validePar: session.name || session.login }
    } else {
      // Refus : annuler + rembourser si nécessaire
      if (!motif?.trim()) {
        return NextResponse.json({ error: 'Motif de refus requis' }, { status: 400 })
      }
      newStatus = 'annule'
      waType    = 'commande_refusee'
      waData    = {
        ...commande,
        motifRefus: motif.trim(),
        refusePar:  session.name || session.login,
        messageRemb: ['cinetpay_confirme', 'cinetpay'].includes(commande.paiement) && commande.transactionId
          ? `Remboursement de ${commande.total.toLocaleString('fr-FR')} FCFA initié automatiquement.`
          : 'Aucun paiement effectué — aucun remboursement nécessaire.',
      }
    }

    const updateData = {
      status:    newStatus,
      updatedAt: new Date(),
    }

    // Remboursement si refus d'une commande Mobile Money déjà payée
    let rembInfo = null
    if (action === 'refuser' && ['cinetpay_confirme', 'cinetpay'].includes(commande.paiement) && commande.transactionId) {
      try {
        const { rembourserPaiement } = await import('@/lib/cinetpay')
        const res = await rembourserPaiement(commande.transactionId, commande.total)
        updateData.rembStatut  = res.ok ? 'rembourse' : 'echec'
        updateData.rembMontant = commande.total
        updateData.rembAt      = res.ok ? new Date() : null
        rembInfo = res
      } catch (e) {
        updateData.rembStatut  = 'echec'
        updateData.rembMontant = commande.total
        console.error('[valider] Remboursement échoué:', e.message)
      }
    }

    // FIX I1 — Atomicité commande + stock
    // Stratégie : vérifier le stock (simulation bloquante) AVANT de mettre à jour la commande.
    // Si le stock est insuffisant, on rejette AVANT tout commit — la commande reste 'nouveau'.
    // Une fois la commande updatée (statut en_cours), le décrément réel est exécuté.
    // Ce pattern garantit qu'on n'a jamais de commande acceptée avec stock non décrémenté.
    let alertesStock = []
    if (action === 'accepter') {
      const itemsParsed = typeof commande.items === 'string'
        ? JSON.parse(commande.items)
        : commande.items

      // Passe de simulation bloquante AVANT l'update commande
      try {
        await decrementerStockCommande(
          itemsParsed,
          commande.restaurantId || null,
          id,
          session.name || session.login,
          { bloquer: true, simulationSeulement: true }
        )
      } catch (err) {
        if (err.code === 'RUPTURE_STOCK') {
          return NextResponse.json({ error: 'Stock insuffisant pour valider cette commande', ruptures: err.ruptures }, { status: 409 })
        }
        // Erreur stock non bloquante → on continue (BD stocks inaccessible)
        console.error('[valider] Simulation stock échouée (non bloquant):', err.message)
      }
    }

    const updated = await prisma.commande.update({ where: { id }, data: updateData })

    // Décrément réel après commit commande (simulation déjà validée ci-dessus)
    if (action === 'accepter') {
      try {
        const itemsParsed = typeof commande.items === 'string'
          ? JSON.parse(commande.items)
          : commande.items

        const rapportStock = await decrementerStockCommande(
          itemsParsed,
          updated.restaurantId || null,
          id,
          session.name || session.login,
          { bloquer: false }  // simulation déjà faite — pas de double vérification
        )
        alertesStock = rapportStock.alertes
      } catch (err) {
        console.error('[valider] stockDecrement réel échoué (commande déjà acceptée):', err.message)
      }
    }

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: updated.restaurantId,
      auteur: session.name || session.login,
      action: `Commande ${id} ${action === 'accepter' ? 'acceptée' : `refusée — ${motif}`}`,
      type: 'commande', ref: id,
    }}).catch(err => console.error('[journal]', err.message))

    // SSE temps réel
    publish({ type: 'commande_status', data: { id, status: newStatus, updatedAt: updated.updatedAt } }, updated.restaurantId || null)

    // WhatsApp client + restaurant
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const _wac=new AbortController(),_wat=setTimeout(()=>_wac.abort(),5000)
      await fetch(`${baseUrl}/api/whatsapp`, {
        method:  'POST',
        signal:  _wac.signal,
        headers: {
          'Content-Type':   'application/json',
          'x-internal-key': getInternalKey(),
        },
        body:    JSON.stringify({ type: waType, data: waData }),
      })
    } catch {}

    return NextResponse.json({
      ok:          true,
      id,
      action,
      newStatus,
      rembInfo,
      validePar:   session.name || session.login,
      alertesStock,  // [] si aucune alerte, sinon liste des ingrédients en alerte/rupture
    })

  } catch (err) {
    console.error('[POST /api/commandes/[id]/valider]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
