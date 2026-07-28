import { describe, it, expect } from 'vitest'
import {
  validatePhone,
  validateDate,
  validateTime,
  validateAmount,
  sanitize,
  validateStatutCommande,
  validateStatutReservation,
} from '@/lib/validate'

describe('validatePhone — numéros camerounais', () => {
  it('accepte les formats valides', () => {
    expect(validatePhone('+237677000000')).toBe(true)
    expect(validatePhone('+237699000000')).toBe(true)
    expect(validatePhone('+237655000000')).toBe(true)
    expect(validatePhone('237677000000')).toBe(true)  // Sans +
  })

  it('rejette les formats invalides', () => {
    expect(validatePhone('0677000000')).toBe(false)   // Pas camerounais
    expect(validatePhone('+33677000000')).toBe(false) // France
    expect(validatePhone('abc')).toBe(false)
    expect(validatePhone('')).toBe(false)
    expect(validatePhone('+237577000000')).toBe(false) // Préfixe 5 invalide
  })

  it('ignore espaces et tirets', () => {
    expect(validatePhone('+237 677 000 000')).toBe(true)
    expect(validatePhone('+237-677-000-000')).toBe(true)
  })
})

describe('validateDate', () => {
  it('accepte les dates valides', () => {
    expect(validateDate('2026-05-18')).toBe(true)
    expect(validateDate('2025-01-01')).toBe(true)
    expect(validateDate('2030-12-31')).toBe(true)
  })

  it('rejette les dates invalides', () => {
    expect(validateDate('18-05-2026')).toBe(false) // Mauvais format
    expect(validateDate('2026-13-01')).toBe(false) // Mois 13
    expect(validateDate('not-a-date')).toBe(false)
    expect(validateDate('')).toBe(false)
  })
})

describe('validateTime', () => {
  it('accepte les heures valides', () => {
    expect(validateTime('09:00')).toBe(true)
    expect(validateTime('23:59')).toBe(true)
    expect(validateTime('00:00')).toBe(true)
  })

  it('rejette les heures invalides', () => {
    expect(validateTime('24:00')).toBe(false)
    expect(validateTime('9:00')).toBe(false)  // Pas de zéro
    expect(validateTime('09:60')).toBe(false)
    expect(validateTime('')).toBe(false)
  })
})

describe('validateAmount', () => {
  it('accepte des montants FCFA valides', () => {
    expect(validateAmount(500)).toBe(true)
    expect(validateAmount(5000)).toBe(true)
    expect(validateAmount(10_000_000)).toBe(true)
  })

  it('rejette des montants invalides', () => {
    expect(validateAmount(0)).toBe(false)
    expect(validateAmount(-500)).toBe(false)
    expect(validateAmount(10_000_001)).toBe(false)
    expect(validateAmount(3.5)).toBe(false) // Pas entier
    expect(validateAmount('abc')).toBe(false)
  })
})

describe('sanitize', () => {
  it('coupe et tronque correctement', () => {
    expect(sanitize('  hello  ')).toBe('hello')
    expect(sanitize('a'.repeat(600), 500)).toHaveLength(500)
    expect(sanitize(null)).toBe('')
    expect(sanitize(undefined)).toBe('')
  })
})

describe('validateStatutCommande', () => {
  it('accepte les statuts valides', () => {
    expect(validateStatutCommande('nouveau')).toBe(true)
    expect(validateStatutCommande('livre')).toBe(true)
    expect(validateStatutCommande('annule')).toBe(true)
  })

  it('rejette les statuts inconnus', () => {
    expect(validateStatutCommande('foo')).toBe(false)
    expect(validateStatutCommande('')).toBe(false)
  })
})

describe('validateStatutReservation', () => {
  it('accepte les statuts valides', () => {
    expect(validateStatutReservation('en_attente')).toBe(true)
    expect(validateStatutReservation('confirmee')).toBe(true)
  })

  it('rejette les statuts inconnus', () => {
    expect(validateStatutReservation('inconnu')).toBe(false)
  })
})
