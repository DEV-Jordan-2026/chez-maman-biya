import { test, expect } from '@playwright/test'

test.describe('Authentification admin', () => {
  test('redirige vers /admin/login si non connecté', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/admin\/login/)
  })

  test('affiche le formulaire de login', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByPlaceholder(/identifiant/i)).toBeVisible()
    await expect(page.getByPlaceholder(/mot de passe/i)).toBeVisible()
  })

  test('rejette les mauvais identifiants', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByPlaceholder(/identifiant/i).fill('mauvais')
    await page.getByPlaceholder(/mot de passe/i).fill('mauvais')
    await page.getByRole('button', { name: /connexion|se connecter/i }).click()
    // Doit rester sur login avec erreur
    await expect(page).toHaveURL(/admin\/login/)
    await expect(page.getByText(/incorrect|invalide|erreur/i)).toBeVisible()
  })

  test('connecte avec les bons identifiants et redirige vers /admin', async ({ page }) => {
    const login    = process.env.ADMIN_LOGIN    || 'admin'
    const password = process.env.ADMIN_PASSWORD || 'admin123'

    await page.goto('/admin/login')
    await page.getByPlaceholder(/identifiant/i).fill(login)
    await page.getByPlaceholder(/mot de passe/i).fill(password)
    await page.getByRole('button', { name: /connexion|se connecter/i }).click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByText(/commandes|dashboard/i)).toBeVisible()
  })
})

test.describe('Dashboard admin (connecté)', () => {
  test.beforeEach(async ({ page }) => {
    const login    = process.env.ADMIN_LOGIN    || 'admin'
    const password = process.env.ADMIN_PASSWORD || 'admin123'

    await page.goto('/admin/login')
    await page.getByPlaceholder(/identifiant/i).fill(login)
    await page.getByPlaceholder(/mot de passe/i).fill(password)
    await page.getByRole('button', { name: /connexion|se connecter/i }).click()
    await page.waitForURL(/\/admin$/)
  })

  test('affiche les KPIs', async ({ page }) => {
    await expect(page.getByText(/commandes aujourd'hui/i)).toBeVisible()
    await expect(page.getByText(/CA du jour/i)).toBeVisible()
  })

  test('peut naviguer entre les onglets', async ({ page }) => {
    await page.getByRole('button', { name: /réservations/i }).click()
    await expect(page.getByText(/aucune réservation|en attente/i)).toBeVisible()

    await page.getByRole('button', { name: /menu/i }).first().click()
    await expect(page.getByText(/plats|actifs/i)).toBeVisible()
  })

  test('peut se déconnecter', async ({ page }) => {
    await page.getByRole('button', { name: /déconnexion/i }).click()
    await expect(page).toHaveURL(/admin\/login/)
  })
})
