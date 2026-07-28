# ✅ Checklist terrain — Chez Maman Biya v20
> À compléter dans l'ordre avant le premier test avec de l'argent réel.

---

## 1. Variables d'environnement

```bash
cp .env.production.example .env.production
# Éditez .env.production avec les vraies valeurs
```

- [ ] `DATABASE_URL` et `DIRECT_URL` Supabase remplis
- [ ] `AUTH_SECRET` généré (≥ 64 caractères aléatoires)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] `INTERNAL_API_KEY` généré (≥ 32 caractères aléatoires)
- [ ] `CINETPAY_API_KEY` et `CINETPAY_SITE_ID` récupérés sur cinetpay.com
- [ ] `CINETPAY_ENV` = `TEST` pour les tests, `PROD` pour le vrai argent
- [ ] `WHATSAPP_TOKEN` = token **permanent** (pas le token temporaire 24h !)
- [ ] `WHATSAPP_PHONE_ID` = Phone number ID (onglet WhatsApp sur developers.facebook.com)
- [ ] `WHATSAPP_RESTO_NUMBER` = numéro du restaurant **sans + ni espaces** (ex: `237677XXXXXX`)
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://chezmamanbiya.cm` (sans slash final)

---

## 2. Base de données

```bash
# Déployer le schéma
npm run db:migrate

# Charger les données initiales (menu, tables, fournisseurs, livreurs)
npm run db:seed
```

- [ ] `npm run db:migrate` sans erreur
- [ ] `npm run db:seed` affiche ✅ pour chaque section
- [ ] Connexion à Prisma Studio vérifiée : `npm run db:studio`
- [ ] Menu visible dans Prisma Studio (14 plats)
- [ ] Compte `admin` / `Admin2026!` créé — **Changer le mot de passe immédiatement !**

---

## 3. ⚠️ Webhook CinetPay — CRITIQUE

**Sans cette étape, aucun paiement Mobile Money ne sera confirmé.**

### 3a. Vérifier que l'URL répond

```bash
curl https://chezmamanbiya.cm/api/paiement/webhook
# Doit retourner : {"ok":true,"service":"Chez Maman Biya · CinetPay Webhook"}
```

### 3b. Enregistrer l'URL dans le tableau de bord CinetPay

1. Connectez-vous sur **[cinetpay.com](https://cinetpay.com)**
2. Menu : **Mon compte → Sites & API → Votre site → Configurer**
3. Champ **Webhook / Notify URL** :
   ```
   https://chezmamanbiya.cm/api/paiement/webhook
   ```
4. Méthode : **POST**
5. Cliquez **Enregistrer**

### 3c. Test avec un vrai paiement (mode TEST)

1. Passez une commande sur le site avec paiement Mobile Money
2. Vérifiez dans les logs Vercel que le webhook reçoit bien le POST de CinetPay
3. La commande doit passer en statut `cinetpay_confirme` dans la base

- [ ] URL webhook répondant à GET avec `{"ok":true,...}`
- [ ] URL enregistrée dans le dashboard CinetPay
- [ ] Test de bout en bout réussi (commande → paiement → confirmation webhook)
- [ ] `CINETPAY_ENV` passé à `PROD` après validation des tests

---

## 4. WhatsApp

- [ ] Token permanent créé dans Meta Business Suite
  (Menu → WhatsApp → Configuration → Générer token permanent)
- [ ] Template "nouvelle_commande" approuvé par Meta (pour les messages hors session 24h)
- [ ] Test d'envoi : passer une commande test et vérifier que le restaurant reçoit le message
- [ ] En cas d'échec WhatsApp : la commande est quand même créée (dégradé gracieux ✅)

---

## 5. Photos de plats

Les photos ne sont **pas obligatoires** pour le premier test. L'emoji est affiché en fallback.

Pour ajouter les photos :

1. Créez un compte gratuit sur [cloudinary.com](https://cloudinary.com)
2. Créez un **Upload Preset** non signé (Settings → Upload → Add upload preset)
   - Mode : **Unsigned**
   - Folder : `cmb`
   - Nom du preset : `cmb_plats`
3. Uploadez vos photos de plats sur Cloudinary
4. Dans l'admin CMB → Menu → ✏️ Modifier chaque plat → coller l'URL Cloudinary
   (format : `https://res.cloudinary.com/CLOUD/image/upload/v1/cmb/ndole.jpg`)

Alternative rapide : Imgur.com (upload gratuit, URL directe).

---

## 6. Déploiement Vercel

```bash
# Première fois
vercel --prod

# Vérifier les variables d'environnement
vercel env ls
```

- [ ] Variables d'environnement configurées dans Vercel Dashboard
  (Settings → Environment Variables → Production)
- [ ] Build sans erreur (`vercel --prod` ou dashboard Vercel)
- [ ] Domaine `chezmamanbiya.cm` pointant vers Vercel (DNS configuré)
- [ ] SSL actif (cadenas vert dans le navigateur)
- [ ] Page `/menu` accessible publiquement
- [ ] Page `/admin` accessible et login fonctionnel

---

## 7. Tests de fumée (smoke tests)

Effectuez ces tests dans l'ordre :

- [ ] `/` — Page d'accueil charge sans erreur
- [ ] `/menu` — Menu affiché avec tous les plats
- [ ] `/commande` — Formulaire de commande fonctionnel
- [ ] Commande avec paiement **à la livraison** → notification WhatsApp reçue au restaurant
- [ ] Commande avec paiement **CinetPay TEST** → redirect page paiement → retour `/commande/confirmation`
- [ ] `/admin` — Connexion admin fonctionnelle
- [ ] Admin → Commandes → commande test visible
- [ ] Scan QR code d'une table → `/table/[id]` charge le menu
- [ ] Admin → Menu → Modifier un plat → changement visible immédiatement côté client

---

## 8. Contacts d'urgence le jour J

| Service | URL | Support |
|---------|-----|---------|
| CinetPay | [cinetpay.com](https://cinetpay.com) | support@cinetpay.com |
| Supabase | [app.supabase.com](https://app.supabase.com) | discord.gg/supabase |
| Vercel | [vercel.com](https://vercel.com) | vercel.com/support |
| Meta WhatsApp | [developers.facebook.com](https://developers.facebook.com) | support.whatsapp.com |
| Cloudinary | [cloudinary.com](https://cloudinary.com) | support.cloudinary.com |

---

*v20 — Généré automatiquement par le processus de correction pré-terrain*
