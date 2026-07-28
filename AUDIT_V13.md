# Audit v13 — Rapport complet

## Bugs corrigés

| # | Fichier | Bug | Fix |
|---|---------|-----|-----|
| 1 | `MagasinierClient.js` | Route `/api/fournisseurs/bons-commande` inexistante | → `/api/bons-commande` |
| 2 | `app/api/auth/login/route.js` | `restaurantId` absent du token JWT | Ajouté dans le payload |
| 3 | `app/api/users/route.js` | `restaurantId` non extrait du body POST | Destructuré + `|| null` |
| 4 | `RHPanel.js` | 5 `load()` sans `try/catch` | Wrappés avec `try/catch/finally` |
| 5 | `AchatsPanel.js` | `valider()` et `validerNote()` sans gestion erreur | Ajout `try/catch` + message d'erreur |
| 6 | `MagasinierClient.js` | `ajusterStock()` sans `try/catch` | Wrappé + `finally { setBusy(false) }` |
| 7 | `ReceptionnisteClient.js` | Actions sans `try/catch` | `actionCommande` + `actionReservation` wrappés |
| 8 | `EvaluationsTab` | `Promise.resolve({ json: () => [] })` → bad API | Corrigé en `{ ok: true, json: async () => [] }` |

## Améliorations UX

| # | Composant | Problème | Fix |
|---|-----------|----------|-----|
| 1 | `ReceptionnisteClient` | 6 onglets débordaient sur mobile | Scroll horizontal + `flexShrink: 0` |
| 2 | `MagasinierClient` | Tabs `flex: 1` trop larges à 5 onglets | Scroll horizontal + `whiteSpace: nowrap` |
| 3 | Tous les panels | Grids `1fr 1fr` fixes cassaient sur petits écrans | `repeat(auto-fit, minmax(200px, 1fr))` |
| 4 | `RHPanel` grids 3 col | `1fr 1fr 1fr` fixes | `repeat(auto-fit, minmax(160px, 1fr))` |

## Matrice de visibilité RH (implémentée)

| Module | super_admin | manager | employé |
|--------|-------------|---------|---------|
| Scores | Tous + recalc | Équipe + recalc | Le sien seulement |
| Planning | Grille + éditer | Grille + éditer | Liste ses shifts (lecture) |
| Signalements | Lire + traiter | ❌ Onglet absent | Soumettre anonymement |
| Checklists | — | — | Ses checklists du jour |
| Heures sup | Tous + approuver | Équipe + approuver | Les siennes (lecture) |
| Évaluations | Tout | Évalue + agrégat anon conditions | Soumet conditions anon |
| Badges | Tous + attribuer | Équipe + attribuer | Ses badges obtenus |

## État général

- **15 fichiers audités** — 0 erreur de syntaxe
- **8 bugs corrigés** — dont 2 critiques (token JWT, route API)
- **4 améliorations UX responsive** appliquées
- **Tous les clients dédiés** ont accès à l'espace RH personnel

## Déploiement

```bash
# 1. Appliquer la migration SQL
psql $DATABASE_URL -f prisma/migrations/v13_migration.sql

# 2. Seeder les référentiels
node prisma/seed-permissions.js
node prisma/seed-badges.js

# 3. Build
npm run build
```
