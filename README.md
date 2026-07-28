# Chez Maman Biya — Système de gestion restaurant

Application Next.js 15 complète pour la gestion d'un restaurant camerounais (Yaoundé).

## Stack technique
- **Frontend** : Next.js 15.3.3, React 19, CSS-in-JS inline
- **Backend** : Next.js API Routes (App Router)
- **Base de données** : PostgreSQL + Prisma ORM
- **Paiement** : CinetPay (MTN MoMo, Orange Money)
- **Notifications** : WhatsApp Business API
- **IA** : Anthropic Claude (chatbot)
- **Sécurité** : HMAC-SHA256, Edge Runtime, CSP Headers

---

## Installation et test local

### Prérequis
- Node.js 18+
- PostgreSQL installé localement **ou** compte Supabase (gratuit)

### Étapes

```bash
# 1. Extraire le zip et aller dans le dossier
cd cmb-v10

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env — renseigner au minimum :
#   DATABASE_URL  (votre base PostgreSQL locale)
#   AUTH_SECRET   (chaîne aléatoire de 32+ caractères)

# 4. Créer les tables
npx prisma db push

# 5. Seed — menu, tables, stocks + compte admin
npm run db:seed

# 6. Lancer en développement
npm run dev

# → Site : http://localhost:3000
# → Admin : http://localhost:3000/admin/login
```

### Compte administrateur initial
| Champ | Valeur |
|---|---|
| Login | `admin` |
| Mot de passe | `Admin2026!` |
| URL | `/admin/login` |

**⚠️ Changez ce mot de passe dès la première connexion (onglet Équipe).**

---

## Utilisation avec Supabase (cloud)

```bash
# Dans .env, remplacer DATABASE_URL par :
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# Puis décommenter directUrl dans prisma/schema.prisma :
# directUrl = env("DIRECT_URL")
```

---

## Gestion des comptes

```bash
# Créer/réinitialiser le compte super_admin (interactif)
npm run admin:create

# Le super_admin crée ensuite les autres comptes depuis l'interface :
# /admin → onglet "👥 Équipe"
```

### Rôles disponibles
| Rôle | Accès | Créé par |
|---|---|---|
| `super_admin` | Tout (15 onglets) | `npm run db:seed` |
| `manager` | Opérationnel (9 onglets) | Super_admin via Équipe |
| `caissier` | Caisse + Facturation | Super_admin via Équipe |
| `staff` | Cuisine uniquement | Super_admin via Équipe |

---

## Backup base de données

```bash
# Sauvegarder (créer backups/ automatiquement)
npm run backup

# Restaurer
npm run restore backups/cmb-backup-YYYY-MM-DD.sql.gz

# Cron quotidien recommandé (Linux/Mac)
0 2 * * * cd /var/www/cmb && npm run backup
```

---

## Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Oui | URL PostgreSQL |
| `AUTH_SECRET` | ✅ Oui | Clé HMAC sessions (32+ chars) |
| `INTERNAL_API_KEY` | ✅ Oui | Clé appels serveur internes |
| `NEXT_PUBLIC_SITE_URL` | ✅ Oui | URL du site (ex: http://localhost:3000) |
| `CINETPAY_API_KEY` | ⚡ Optionnel | Paiement Mobile Money |
| `ANTHROPIC_API_KEY` | ⚡ Optionnel | Chatbot IA |
| `WHATSAPP_TOKEN` | ⚡ Optionnel | Notifications WhatsApp |
| `UPSTASH_REDIS_REST_URL` | ⚡ Optionnel | Rate limiting distribué |
| `DIRECT_URL` | ⚡ Supabase seulement | Connexion directe sans pooler |

---

## Pages du système

| URL | Accès | Description |
|---|---|---|
| `/` | Public | Page d'accueil |
| `/menu` | Public | Menu avec prix |
| `/commande` | Public | Commander en ligne |
| `/reservation` | Public | Réserver une table |
| `/suivi` | Public | Suivre sa commande |
| `/admin/login` | — | Page de connexion |
| `/admin` | Connecté | Interface selon le rôle |
