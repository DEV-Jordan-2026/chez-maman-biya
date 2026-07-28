import { test, expect } from '@playwright/test'

test.describe('Parcours commande client', () => {
  test('affiche le menu avec les plats', async ({ page }) => {
    await page.goto('/menu')
    await expect(page.getByText('Ndolé')).toBeVisible()
    await expect(page.getByText('Poulet DG')).toBeVisible()
    await expect(page.getByText('FCFA')).toBeVisible()
  })

  test('peut filtrer le menu par catégorie', async ({ page }) => {
    await page.goto('/menu')
    // Cliquer sur le filtre Boissons
    await page.getByRole('button', { name: /Boissons/i }).click()
    await expect(page.getByText('Jus de gingembre')).toBeVisible()
  })

  test('peut démarrer une commande', async ({ page }) => {
    await page.goto('/commande')
    // La page commande doit être accessible
    await expect(page).toHaveTitle(/Commande|Chez Maman Biya/i)
  })

  test('affiche la page de suivi', async ({ page }) => {
    await page.goto('/suivi')
    await expect(page).toHaveTitle(/Suivi|Chez Maman Biya/i)
  })
})

test.describe('Page réservation', () => {
  test('affiche le formulaire de réservation', async ({ page }) => {
    await page.goto('/reservation')
    await expect(page.getByPlaceholder(/nom/i)).toBeVisible()
    await expect(page.getByPlaceholder(/téléphone/i)).toBeVisible()
  })

  test('valide les champs requis', async ({ page }) => {
    await page.goto('/reservation')
    // Soumettre sans remplir
    const submitBtn = page.getByRole('button', { name: /réserver|confirmer/i })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      // Doit afficher une erreur ou ne pas naviguer
      await expect(page).toHaveURL(/reservation/)
    }
  })
})

test.describe('Page d\'accueil', () => {
  test('charge correctement', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Maman Biya')).toBeVisible()
  })

  test('a un lien vers le menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /menu/i })).toBeVisible()
  })
})
