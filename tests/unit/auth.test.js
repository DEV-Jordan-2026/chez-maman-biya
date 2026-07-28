import { describe, it, expect, beforeAll } from 'vitest'
import { createToken, verifyToken, verifyCredentials } from '@/lib/auth'

// Les variables d'env sont déjà mises par défaut dans auth.js en dev
beforeAll(() => {
  process.env.AUTH_SECRET    = 'test-secret-au-moins-32-caracteres-ok'
  process.env.ADMIN_LOGIN    = 'admin'
  process.env.ADMIN_PASSWORD = 'adminpass'
  process.env.STAFF_LOGIN    = 'staff'
  process.env.STAFF_PASSWORD = 'staffpass'
})

describe('createToken / verifyToken', () => {
  it('crée un token et le vérifie correctement', async () => {
    const payload = { login: 'admin', role: 'super_admin', exp: Date.now() + 60_000 }
    const token   = await createToken(payload)
    expect(typeof token).toBe('string')
    expect(token).toContain('.')

    const verified = await verifyToken(token)
    expect(verified).not.toBeNull()
    expect(verified.login).toBe('admin')
    expect(verified.role).toBe('super_admin')
  })

  it('retourne null pour un token invalide', async () => {
    expect(await verifyToken('token.invalide')).toBeNull()
    expect(await verifyToken('')).toBeNull()
    expect(await verifyToken(null)).toBeNull()
    expect(await verifyToken(undefined)).toBeNull()
  })

  it('retourne null pour un token expiré', async () => {
    const payload = { login: 'admin', exp: Date.now() - 1000 }
    const token   = await createToken(payload)
    expect(await verifyToken(token)).toBeNull()
  })

  it('retourne null si la signature est falsifiée', async () => {
    const payload = { login: 'admin', role: 'super_admin', exp: Date.now() + 60_000 }
    const token   = await createToken(payload)
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(await verifyToken(tampered)).toBeNull()
  })
})

describe('verifyCredentials', () => {
  it('authentifie un admin valide', async () => {
    const user = await verifyCredentials('admin', 'adminpass')
    expect(user).not.toBeNull()
    expect(user.role).toBe('super_admin')
  })

  it('authentifie un staff valide', async () => {
    const user = await verifyCredentials('staff', 'staffpass')
    expect(user).not.toBeNull()
    expect(user.role).toBe('staff')
  })

  it('rejette un mauvais mot de passe', async () => {
    const user = await verifyCredentials('admin', 'wrong')
    expect(user).toBeNull()
  })

  it('rejette un login inexistant', async () => {
    const user = await verifyCredentials('hacker', 'password')
    expect(user).toBeNull()
  })
})
