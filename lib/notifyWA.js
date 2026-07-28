// lib/notifyWA.js
// Utilitaire centralisé pour les notifications WhatsApp internes.
//
// ── Dégradé gracieux (C8) ────────────────────────────────────────────────────
// Toutes les notif WhatsApp sont NON-BLOQUANTES :
//   • timeout de 5 s (AbortController) — si Meta API ne répond pas sous 5 s,
//     la commande / réservation est quand même créée.
//   • catch global — si WhatsApp est down, log warning + continuer.
//   • La route /api/whatsapp elle-même retourne HTTP 200 avec ok:false si
//     WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent (pas de crash 5xx).
// ─────────────────────────────────────────────────────────────────────────────

import { getInternalKey } from '@/lib/auth'

const TIMEOUT_MS = 5000 // 5 secondes max pour ne pas bloquer la réponse client

/**
 * Envoyer une notification WhatsApp en mode fire-and-forget avec timeout.
 *
 * @param {'nouvelle_commande'|'statut_commande'|'nouvelle_reservation'
 *          |'paiement_confirme'|'fidelite_recompense'|'commande_annulee'
 *          |'commande_refusee'|'reservation_confirmee'|'reservation_annulee'} type
 * @param {object} data  — payload spécifique au type
 * @returns {Promise<void>}  — résout toujours, ne rejette jamais
 */
export async function notifyWA(type, data) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${baseUrl}/api/whatsapp`, {
      method:  'POST',
      signal:  ctrl.signal,
      headers: {
        'Content-Type':   'application/json',
        'x-internal-key': getInternalKey(),
      },
      body: JSON.stringify({ type, data }),
    })
    clearTimeout(timer)

    if (!res.ok) {
      const txt = await res.text().catch(() => '?')
      console.warn(`[notifyWA] HTTP ${res.status} pour type=${type}:`, txt.slice(0, 200))
    } else {
      const json = await res.json().catch(() => ({}))
      if (!json.ok) {
        console.info(`[notifyWA] WA non configuré ou simulé (type=${type}):`, json.raison || json.error || '')
      }
    }
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      console.warn(`[notifyWA] Timeout ${TIMEOUT_MS}ms dépassé pour type=${type} — commande non bloquée`)
    } else {
      console.warn(`[notifyWA] Erreur réseau pour type=${type}:`, err.message)
    }
    // On ne propage jamais l'erreur — non-bloquant par design
  }
}
