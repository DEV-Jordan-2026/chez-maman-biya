// app/api/paiement/webhook/route.js
// Webhook CinetPay — appelé automatiquement après confirmation de paiement
// ⚠️  Ce endpoint DOIT rester public (CinetPay l'appelle directement)
// Sécurisé par :
//   1. Vérification cpm_site_id
//   2. Vérification signature HMAC-SHA256 (si présente)
//   3. Rappel API CinetPay avec timeout 8s (protection panne réseau)
//   4. Comparaison montant webhook vs montant base (anti-fraude)

import { NextResponse }                    from 'next/server'
import prisma                              from '@/lib/db'
import { verifierPaiementAvecTimeout }     from '@/lib/cinetpay'
import { getInternalKey }                  from '@/lib/auth'
import { notifyWA } from '@/lib/notifyWA'
import { publish }                         from '@/lib/eventBus'

// ── Vérification de la signature CinetPay v2 ─────────────────────────────────
// Algorithme : HMAC-SHA256(CINETPAY_API_KEY, cpm_trans_id + cpm_site_id + cpm_amount + cpm_currency)
async function verifierSignatureCinetPay(body) {
  const { cpm_trans_id, cpm_site_id, cpm_amount, cpm_currency, cpm_signature } = body
  const apiKey = process.env.CINETPAY_API_KEY

  // FIX #5 — Signature obligatoire en production. CinetPay l'envoie toujours en prod.
  // En dev/staging uniquement, on tolère l'absence pour les tests manuels.
  if (!cpm_signature) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Webhook] cpm_signature absent en production — webhook rejeté (anti-fraude)')
      return false
    }
    console.warn('[Webhook] cpm_signature absent — toléré (dev/staging uniquement)')
    return true
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      // S2 — En production, refuser plutôt que tolérer : un webhook sans clé de vérification
      // permet de confirmer n'importe quelle commande sans paiement réel.
      console.error('[Webhook] CINETPAY_API_KEY manquant en production — webhook rejeté')
      return false  // → 403 dans l'appelant
    }
    console.warn('[Webhook] CINETPAY_API_KEY absent — vérification signature ignorée (dev uniquement)')
    return true
  }

  try {
    const message   = `${cpm_trans_id}${cpm_site_id}${cpm_amount}${cpm_currency}`
    const enc       = new TextEncoder()
    const keyData   = enc.encode(apiKey)
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const sigBuffer  = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
    const sigBytes   = new Uint8Array(sigBuffer)
    const sigHex     = Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const sigExpected = sigHex.toLowerCase()
    const sigReçue   = cpm_signature.toLowerCase()

    if (sigExpected !== sigReçue) {
      console.error('[Webhook] Signature invalide — expected:', sigExpected, 'received:', sigReçue)
      return false
    }
    return true
  } catch (err) {
    console.error('[Webhook] Erreur vérification signature:', err.message)
    return false
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { cpm_trans_id, cpm_site_id, cpm_amount, cpm_currency } = body

    // ── 1. Vérifier que le site_id correspond au nôtre ─────────────────────
    if (cpm_site_id !== process.env.CINETPAY_SITE_ID) {
      console.warn('[Webhook] site_id invalide:', cpm_site_id)
      return NextResponse.json({ error: 'site_id invalide' }, { status: 403 })
    }

    // ── 2. Vérifier la signature HMAC-SHA256 ───────────────────────────────
    const signatureValide = await verifierSignatureCinetPay(body)
    if (!signatureValide) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 403 })
    }

    // ── 3. Vérifier le statut réel auprès de CinetPay (timeout 8s) ─────────
    // Ne jamais faire confiance au webhook seul — toujours confirmer côté API
    const verification = await verifierPaiementAvecTimeout(cpm_trans_id, 8000)

    if (!verification.ok && verification.statut === 'TIMEOUT') {
      // Répondre 200 pour éviter les retries CinetPay — CinetPay réessaiera plus tard
      console.warn('[Webhook] Timeout vérification CinetPay — retry attendu pour:', cpm_trans_id)
      return NextResponse.json({ code: '00', statut: 'TIMEOUT_RETRY' })
    }

    if (verification.statut !== 'ACCEPTED') {
      console.warn('[Webhook] Paiement non accepté:', verification.statut, cpm_trans_id)
      return NextResponse.json({ ok: false, statut: verification.statut })
    }

    // ── Extraire le type et l'ID depuis le transactionId ───────────────────
    // Format paiement complet : CMB-CMD-XXXXXXXX-HHHHHHHH
    // Format arrhes            : CMB-RES-XXXXXXXX-HHHHHHHH
    // Format acompte livraison : CMB-ACP-CMD-XXXXXXXX-HHHHHHHH
    const matchCmd = cpm_trans_id.match(/CMB-(?:ACP-)?(CMD-[A-F0-9]{8})-[A-F0-9]+/i)
    const matchRes = cpm_trans_id.match(/CMB-(RES-[\w]+)-[A-F0-9]+/i)

    if (matchRes) {
      // ── Paiement arrhes réservation ──────────────────────────────────────
      const reservationId = matchRes[1].replace('RES-', '')
      const reservation   = await prisma.reservation.findUnique({
        where:  { id: reservationId },
        select: { id: true, arrhesPaie: true, arrhes: true },
      })
      if (!reservation) {
        console.error('[Webhook] Réservation introuvable:', reservationId)
        return NextResponse.json({ code: '00' })
      }
      if (reservation.arrhesPaie) {
        console.warn('[Webhook] Arrhes déjà traitées — idempotence OK:', reservationId)
        return NextResponse.json({ code: '00' })
      }

      // ── 4. Anti-fraude : vérifier montant arrhes vs base ─────────────────
      if (verification.montant > 0 && reservation.arrhes !== undefined && reservation.arrhes !== null) {
        const diff = Math.abs(reservation.arrhes - verification.montant)
        if (diff > 1) {
          console.error(`[Webhook] FRAUDE DÉTECTÉE — arrhes: attendu ${reservation.arrhes} FCFA, reçu ${verification.montant} FCFA — Réservation ${reservationId}`)
          return NextResponse.json({ error: 'Montant arrhes invalide' }, { status: 403 })
        }
      }

      await prisma.reservation.update({
        where: { id: reservationId },
        data:  { arrhesPaie: true, arrhesTransId: cpm_trans_id, status: 'confirmee' },
      })
      console.warn(`[Webhook] Arrhes confirmées — Réservation ${reservationId} — ${cpm_amount} XAF`)
      return NextResponse.json({ code: '00', message: 'Arrhes OK' })
    }

    if (!matchCmd) {
      console.error('[Webhook] Format transactionId invalide:', cpm_trans_id)
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
    }

    const commandeId = matchCmd[1]

    // ── Détecter si c'est un acompte livraison (préfixe ACP-) ─────────────────
    const isAcompte = /^CMB-ACP-/i.test(cpm_trans_id)

    // ── Idempotence : vérifier si ce paiement a déjà été traité ────────────
    const commandeExistante = await prisma.commande.findUnique({
      where:  { id: commandeId },
      select: { id: true, paiement: true, total: true, acompte: true, acompteStatut: true },
    })
    if (!commandeExistante) {
      console.error('[Webhook] Commande introuvable:', commandeId)
      return NextResponse.json({ code: '00' }) // 00 pour éviter les retries CinetPay
    }

    // ── Branche ACOMPTE ───────────────────────────────────────────────────────
    if (isAcompte) {
      if (commandeExistante.acompteStatut === 'paye') {
        console.warn('[Webhook] Acompte déjà traité — idempotence OK:', commandeId)
        return NextResponse.json({ code: '00' })
      }

      // Anti-fraude : vérifier montant acompte vs base
      if (verification.montant > 0 && commandeExistante.acompte) {
        const diff = Math.abs(commandeExistante.acompte - verification.montant)
        if (diff > 1) {
          console.error(
            `[Webhook] FRAUDE ACOMPTE — Commande ${commandeId}: attendu ${commandeExistante.acompte} XAF, ` +
            `reçu ${verification.montant} XAF (diff ${diff} XAF)`
          )
          return NextResponse.json({ error: 'Montant acompte invalide' }, { status: 403 })
        }
      }

      const commande = await prisma.commande.update({
        where: { id: commandeId },
        data:  {
          acompteStatut:  'paye',
          acompteTransId: cpm_trans_id,
          status:         'nouveau',   // commande activée en cuisine
        },
      })

      console.warn(`[Webhook] Acompte confirmé — ${commandeId} — ${cpm_amount} ${cpm_currency}`)

      // Notifier cuisine et livreurs en temps réel
      publish({
        type: 'commande_status',
        data: {
          id:             commandeId,
          status:         'nouveau',
          acompteStatut:  'paye',
          updatedAt:      commande.updatedAt,
        },
      }, commande.restaurantId || null)

      try {
        await notifyWA('paiement_confirme', { ...commande, _typeLabel: 'acompte' })
      } catch (waErr) {
        console.warn('[Webhook] Notification WA acompte échouée:', waErr.message)
      }

      return NextResponse.json({ code: '00', message: 'Acompte OK' })
    }

    // ── Branche PAIEMENT COMPLET (comportement historique) ───────────────────
    if (commandeExistante.paiement === 'cinetpay_confirme') {
      console.warn('[Webhook] Paiement complet déjà traité — idempotence OK:', commandeId)
      return NextResponse.json({ code: '00' })
    }

    // ── 4. Anti-fraude : vérifier montant commande vs montant CinetPay ─────
    if (verification.montant > 0 && commandeExistante.total !== undefined && commandeExistante.total !== null) {
      const diff = Math.abs(commandeExistante.total - verification.montant)
      if (diff > 1) {
        // Tolérance 1 FCFA pour les arrondis éventuels
        console.error(
          `[Webhook] FRAUDE DÉTECTÉE — Commande ${commandeId}: attendu ${commandeExistante.total} FCFA, ` +
          `reçu ${verification.montant} FCFA (diff ${diff} FCFA)`
        )
        return NextResponse.json({ error: 'Montant invalide' }, { status: 403 })
      }
    }

    // ── Mettre à jour la commande avec le transactionId pour remboursement futur
    const commande = await prisma.commande.update({
      where: { id: commandeId },
      data:  {
        paiement:      'cinetpay_confirme',
        status:        'nouveau',
        transactionId: cpm_trans_id,  // Sauvegardé pour remboursement éventuel
      },
    })

    console.warn(`[Webhook] Paiement confirmé — ${commandeId} — ${cpm_amount} ${cpm_currency}`)

    // C8 — Notifier la caisse et la cuisine en temps réel via SSE
    publish({
      type: 'commande_status',
      data: {
        id:        commandeId,
        status:    'nouveau',
        paiement:  'cinetpay_confirme',
        updatedAt: commande.updatedAt,
      },
    }, commande.restaurantId || null)

    // ── Notifier via WhatsApp — appel interne sécurisé ─────────────────────
    try {
      await notifyWA('paiement_confirme', commande)
    } catch (waErr) {
      console.warn('[Webhook] Notification WA échouée:', waErr.message)
    }

    // CinetPay attend "00" en réponse pour confirmer la réception
    return NextResponse.json({ code: '00', message: 'OK' })
  } catch (err) {
    console.error('[Webhook CinetPay]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET pour la vérification de l'URL par CinetPay
export async function GET() {
  return NextResponse.json({ ok: true, service: 'Chez Maman Biya · CinetPay Webhook' })
}
