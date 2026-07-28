// lib/validate.js
// Validation helpers pour formats camerounais et données métier

// Numéros de téléphone :
//   - Cameroun (défaut) : +237 suivi de 6xx/7xx/9xx + 7 chiffres (ex: +237 677 123 456)
//   - International (touristes) : indicatif pays + min 6 chiffres (format E.164)
const PHONE_CM_RE   = /^\+?237[679]\d{7}$/    // Cameroun
const PHONE_INTL_RE = /^\+[1-9]\d{5,14}$/     // International E.164

const DATE_RE  = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
const TIME_RE  = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function validatePhone(tel) {
  const clean = String(tel).replace(/[\s\-().]/g, '')
  return PHONE_CM_RE.test(clean) || PHONE_INTL_RE.test(clean)
}

export function validateDate(date) {
  return DATE_RE.test(date) && !isNaN(new Date(date).getTime())
}

export function validateTime(time) {
  return TIME_RE.test(time)
}

// Montants en FCFA : entier positif, max 10 millions
export function validateAmount(amount) {
  const n = Number(amount)
  return Number.isInteger(n) && n > 0 && n <= 10_000_000
}

// Nettoyage sécurisé d'une chaîne (trim + troncature)
export function sanitize(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength)
}

// Validation des statuts de commande
export const STATUTS_COMMANDE = [
  'nouveau', 'en_cours', 'en_preparation', 'en_livraison', 'pret', 'livre', 'annule',
]

export const STATUTS_RESERVATION = ['en_attente', 'confirmee', 'annulee', 'arrivee']

export function validateStatutCommande(status) {
  return STATUTS_COMMANDE.includes(status)
}

export function validateStatutReservation(status) {
  return STATUTS_RESERVATION.includes(status)
}
