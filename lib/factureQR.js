// lib/factureQR.js — Système QR code facture CMB
// Responsabilités :
//   1. Générer un HMAC-SHA256 signé pour une facture
//   2. Construire l'URL de vérification encodée dans le QR
//   3. Vérifier un hash entrant (route publique /facture/verify)
//
// La clé utilisée est FACTURE_QR_SECRET (à ajouter dans .env).
// Si absente, on tombe sur AUTH_SECRET comme fallback (déconseillé en prod).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le HMAC-SHA256 (Web Crypto API — compatible Edge + Node.js)
 * @param {string} data  — chaîne à signer
 * @returns {Promise<string>}  — hex 64 caractères
 */
async function hmacSHA256(data) {
  const secret  = process.env.FACTURE_QR_SECRET || process.env.AUTH_SECRET || 'cmb-fallback-secret'
  const keyMat  = new TextEncoder().encode(secret)
  const msgMat  = new TextEncoder().encode(data)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyMat,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', cryptoKey, msgMat)
  const bytes  = new Uint8Array(sig)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Construit la chaîne canonique à signer.
 * Format stable : id|numeroFacture|total|restaurantId|createdAt(YYYY-MM-DD)
 * Tout changement de format = tous les anciens QR invalides → ne pas modifier.
 */
function canonical({ id, numeroFacture, total, restaurantId, createdAt }) {
  const date = createdAt
    ? new Date(createdAt).toISOString().split('T')[0]
    : 'unknown'
  return `${id}|${numeroFacture || ''}|${total}|${restaurantId || ''}|${date}`
}

/**
 * Génère le hash HMAC pour une facture.
 * @param {object} facture  — { id, numeroFacture, total, restaurantId, createdAt }
 * @returns {Promise<string>}  — hash hex
 */
export async function signerFacture(facture) {
  return hmacSHA256(canonical(facture))
}

/**
 * Vérifie qu'un hash correspond bien à une facture.
 * Utilise une comparaison timing-safe (double HMAC) pour éviter les timing attacks.
 * @param {object} facture  — données facture depuis la BDD
 * @param {string} hash     — hash reçu dans l'URL
 * @returns {Promise<boolean>}
 */
export async function verifierFacture(facture, hash) {
  if (!hash || typeof hash !== 'string' || hash.length !== 64) return false
  const expected = await signerFacture(facture)
  // Comparaison timing-safe : on signe les deux chaînes avec une clé éphémère
  const ephKey = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const enc     = new TextEncoder()
  const [s1, s2] = await Promise.all([
    crypto.subtle.sign('HMAC', ephKey, enc.encode(expected)),
    crypto.subtle.sign('HMAC', ephKey, enc.encode(hash)),
  ])
  const a1 = new Uint8Array(s1)
  const a2 = new Uint8Array(s2)
  if (a1.length !== a2.length) return false
  let diff = 0
  for (let i = 0; i < a1.length; i++) diff |= a1[i] ^ a2[i]
  return diff === 0
}

/**
 * Construit l'URL complète à encoder dans le QR code.
 * Ex: https://chezmamanbiya.cm/facture/verify?id=abc123&h=def456…
 * @param {object} facture  — { id, ... }
 * @param {string} hash     — résultat de signerFacture()
 * @returns {string}
 */
export function urlQR(factureId, hash) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${base}/facture/verify?id=${factureId}&h=${hash}`
}
