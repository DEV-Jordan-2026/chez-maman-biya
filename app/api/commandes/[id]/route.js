import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { validateStatutCommande } from '@/lib/validate'
import { verifyToken, SESSION_COOKIE, getInternalKey } from '@/lib/auth'
import { rembourserPaiement } from '@/lib/cinetpay'
import { cookies } from 'next/headers'
import { publish } from '@/lib/eventBus'

const ROLES_STATUT     = ['super_admin', 'manager', 'staff', 'caissier']
const NOTIFIER_CLIENT  = ['en_preparation', 'en_livraison', 'livre', 'annule']
const PAIEMENTS_REMB   = ['cinetpay_confirme', 'cinetpay']

export async function PATCH(request, context) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || !ROLES_STATUT.includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id }     = await context.params
    const body       = await request.json()
    const { status, livreurId, paiement } = body

    if (!validateStatutCommande(status)) {
      return NextResponse.json({ error: 'Statut de commande invalide' }, { status: 400 })
    }

    const existing = await prisma.commande.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

    const updateData = { status }
    // M4 — Appliquer le paiement si fourni (ex : confirmation MoMo manuelle)
    if (paiement) updateData.paiement = paiement

    // v25 — Assignation / désassignation du livreur
    const isUnassign = livreurId === null && Object.prototype.hasOwnProperty.call(body, 'livreurId')
    if (livreurId) updateData.livreurId = livreurId
    if (isUnassign) updateData.livreurId = null

    // Si annulation d'une commande déjà payée par Mobile Money → remboursement auto
    let rembInfo = null
    if (status === 'annule' && PAIEMENTS_REMB.includes(existing.paiement) && existing.transactionId) {
      try {
        const res = await rembourserPaiement(existing.transactionId, existing.total)
        updateData.rembStatut  = res.ok ? 'rembourse' : 'echec'
        updateData.rembMontant = existing.total
        updateData.rembAt      = res.ok ? new Date() : null
        rembInfo = res
      } catch (e) {
        updateData.rembStatut  = 'echec'
        updateData.rembMontant = existing.total
        console.error('[PATCH annule] Remboursement échoué:', e.message)
        rembInfo = { ok: false, message: e.message }
      }
    }

    // v25 — Transaction : mise à jour de la commande + statut automatique du livreur
    const commande = await prisma.$transaction(async (tx) => {
      const updated = await tx.commande.update({ where: { id }, data: updateData })

      // Assignation : le livreur passe automatiquement "en_course"
      if (livreurId) {
        await tx.livreur.update({
          where: { id: livreurId },
          data:  { status: 'en_course' },
        })
      }

      // Désassignation : le livreur (précédent) repasse "disponible"
      if (isUnassign && existing.livreurId) {
        await tx.livreur.update({
          where: { id: existing.livreurId },
          data:  { status: 'disponible' },
        }).catch(() => {}) // ignore si le livreur a été supprimé
      }

      return updated
    })

    // M4 — SSE temps réel — inclure paiement pour notifier la caisse de la confirmation MoMo
    publish({ type: 'commande_status', data: { id, status, paiement: commande.paiement, updatedAt: commande.updatedAt } }, commande.restaurantId || null)

    // v26 — Notifier le livreur par WhatsApp lors de l'assignation
    if (livreurId) {
      try {
        const liv = await prisma.livreur.findUnique({ where: { id: livreurId }, select: { tel: true } })
        if (liv?.tel) {
          const _wac = new AbortController(), _wat = setTimeout(() => _wac.abort(), 5000)
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          await fetch(`${baseUrl}/api/whatsapp`, {
            method:  'POST',
            signal:  _wac.signal,
            headers: { 'Content-Type': 'application/json', 'x-internal-key': getInternalKey() },
            body: JSON.stringify({ type: 'assignation_livreur', data: { ...commande, livreurTel: liv.tel } }),
          })
          clearTimeout(_wat)
        }
      } catch {}
    }

    // Notification WhatsApp
    if (NOTIFIER_CLIENT.includes(status) && commande.tel) {
      try {
        const _wac=new AbortController(),_wat=setTimeout(()=>_wac.abort(),5000)
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        await fetch(`${baseUrl}/api/whatsapp`, {
          method:  'POST',
          signal:  _wac.signal,
          headers: {
            'Content-Type':   'application/json',
            'x-internal-key': getInternalKey(),
          },
          body: JSON.stringify({
            type: status === 'annule' ? 'commande_annulee' : 'statut_commande',
            data: { ...commande, nouveauStatut: status, rembInfo },
          }),
        })
      } catch {}
    }

    return NextResponse.json({ id, status, rembInfo, updatedAt: commande.updatedAt })

  } catch (err) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    console.error('[PATCH /api/commandes/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
