# 🚀 Installation — Chez Maman Biya v3.2

## Étapes dans l'ordre (important !)

```bash
# 1. Installer les dépendances (génère Prisma automatiquement via postinstall)
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# → Remplir DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY dans .env

# 3. Pousser le schéma vers la base de données
npm run db:push

# 4. Peupler la base (menu, stocks, compte admin)
npm run db:seed

# 5. Lancer le serveur de développement
npm run dev
```

## En cas d'erreur "@prisma/client did not initialize"

```bash
npx prisma generate
```

## Compte admin par défaut

- **Login** : `admin`
- **Mot de passe** : `Admin2026!`
- ⚠️ Changez-le immédiatement après la première connexion

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur dev (Turbopack) |
| `npm run build` | Build production |
| `npm run db:push` | Sync schéma → BDD |
| `npm run db:seed` | Insérer données initiales |
| `npm run db:studio` | Interface Prisma Studio |
| `npm run admin:create` | Créer/réinitialiser le super admin |
| `npm run backup` | Sauvegarder la BDD |
