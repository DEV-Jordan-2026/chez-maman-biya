// lib/cinetpay.js
// Intégration CinetPay — agrégateur Mobile Money Afrique francophone
// Supporte : MTN Cameroun, Orange Cameroun, Express Union, EU Mobile
// Documentation : https://developer.cinetpay.com
// Commission : ~2.5% par transaction

import { randomBytes } from 'crypto'

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_ENV     = process.env.CINETPAY_ENV || 'TEST' // TEST ou PROD
const BASE_URL         = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const API_BASE = CINETPAY_ENV === 'PROD'
  ? 'https://api-checkout.cinetpay.com/v2'
  : 'https://api-checkout.cinetpay.com/v2' // CinetPay utilise le même endpoint TEST/PROD

/**
 * Initier un paiement CinetPay
 * @param {object} options
 * @param {string} options.commandeId    - ID de la commande (ex: CMD-A1B2C)
 * @param {number} options.montant       - Montant en FCFA (entier)
 * @param {string} options.description   - Description (ex: "Commande Chez Maman Biya")
 * @param {string} options.nomClient     - Nom du client
 * @param {string} options.telClient     - Téléphone du client (+237XXXXXXXXX)
 * @param {string} [options.typePrefix]  - Préfixe type transaction ('ACP-' pour acompte, '' sinon)
 * @returns {Promise<{ paymentUrl: string, transactionId: string }>}
 */
export async function initierPaiement({ commandeId, montant, description, nomClient, telClient, typePrefix = '' }) {
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new Error('[CinetPay] CINETPAY_API_KEY et CINETPAY_SITE_ID requis')
  }

  // Format : CMB-CMD-XXXXXXXX-HHHHHHHH  (paiement complet)
  //          CMB-ACP-CMD-XXXXXXXX-HHHHHHHH  (acompte livraison)
  const transactionId = `CMB-${typePrefix}${commandeId}-${randomBytes(4).toString('hex').toUpperCase()}`

  const payload = {
    apikey:           CINETPAY_API_KEY,
    site_id:          CINETPAY_SITE_ID,
    transaction_id:   transactionId,
    amount:           montant,
    currency:         'XAF',                   // FCFA Afrique centrale
    alternative_currency: '',
    description:      description || `Commande ${commandeId}`,
    customer_name:    nomClient || 'Client',
    customer_surname: '',
    customer_phone_number: telClient?.replace(/[\s+\-()]/g, '') || '',
    customer_email:   '',
    customer_address: '',
    customer_city:    'Yaoundé',
    customer_country: 'CM',
    customer_state:   'CM',
    customer_zip_code:'00000',
    notify_url:       `${BASE_URL}/api/paiement/webhook`, // Webhook de confirmation
    return_url:       `${BASE_URL}/commande/confirmation?id=${commandeId}`,
    channels:         'ALL',                   // MTN + Orange + Express Union
    metadata:         JSON.stringify({ commandeId }),
    lang:             'fr',
    invoice_data:     {},
  }

  const res = await fetch(`${API_BASE}/payment`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[CinetPay] Erreur initiation:', err)
    throw new Error(`CinetPay erreur: ${res.status}`)
  }

  const data = await res.json()

  if (data.code !== '201') {
    console.error('[CinetPay] Code erreur:', data)
    throw new Error(data.message || 'Échec initialisation paiement')
  }

  return {
    paymentUrl:    data.data.payment_url,
    transactionId: transactionId,
    paymentToken:  data.data.payment_token,
  }
}

/**
 * Vérifier le statut d'un paiement CinetPay
 * @param {string}      transactionId
 * @param {AbortSignal} [signal]  - Signal d'annulation (AbortController) — optionnel
 * @returns {Promise<{ statut: 'ACCEPTED'|'REFUSED'|'PENDING', montant: number }>}
 */
export async function verifierPaiement(transactionId, signal) {
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new Error('[CinetPay] Variables non configurées')
  }

  const fetchOptions = {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      apikey:         CINETPAY_API_KEY,
      site_id:        CINETPAY_SITE_ID,
      transaction_id: transactionId,
    }),
  }
  // Transmettre le signal uniquement s'il est fourni (rétrocompatibilité)
  if (signal) fetchOptions.signal = signal

  const res  = await fetch(`${API_BASE}/payment/check`, fetchOptions)
  const data = await res.json()

  return {
    statut:    data.data?.status   || 'PENDING',
    montant:   data.data?.amount   || 0,
    devise:    data.data?.currency || 'XAF',
    operateur: data.data?.payment_method || '',
    message:   data.message || '',
  }
}

/**
 * Vérifier un paiement CinetPay avec timeout.
 * En cas de panne CinetPay, coupe le fetch après `delaiMs` ms.
 * Retourne { ok: false, statut: 'TIMEOUT' } avec HTTP 200 pour éviter les retries CinetPay.
 *
 * @param {string} transactionId
 * @param {number} [delaiMs=8000] - Timeout en millisecondes
 * @returns {Promise<{ ok: boolean, statut: string, montant?: number }>}
 */
export async function verifierPaiementAvecTimeout(transactionId, delaiMs = 8000) {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), delaiMs)

  try {
    const verification = await verifierPaiement(transactionId, controller.signal)
    clearTimeout(timer)
    return { ok: true, ...verification }
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      console.warn(`[CinetPay] Timeout ${delaiMs}ms dépassé pour ${transactionId}`)
      return { ok: false, statut: 'TIMEOUT', montant: 0 }
    }
    throw err
  }
}

/**
 * Rembourser un paiement CinetPay
 * @param {string} transactionId  - Le transactionId original (format CMB-CMD-XXXX-timestamp)
 * @param {number} montant        - Montant à rembourser (doit être égal au montant initial)
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function rembourserPaiement(transactionId, montant) {
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    throw new Error('[CinetPay] Variables non configurées')
  }

  const res = await fetch(`${API_BASE}/payment/refund`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      apikey:         CINETPAY_API_KEY,
      site_id:        CINETPAY_SITE_ID,
      transaction_id: transactionId,
      amount:         montant,
      currency:       'XAF',
    }),
  })

  const data = await res.json()

  if (data.code === '00' || data.code === 200) {
    return { ok: true, message: 'Remboursement initié avec succès' }
  }

  console.error('[CinetPay] Erreur remboursement:', data)
  return { ok: false, message: data.message || 'Échec du remboursement' }
}
