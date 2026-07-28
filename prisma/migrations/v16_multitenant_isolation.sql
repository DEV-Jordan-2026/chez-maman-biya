-- ============================================================
-- Migration v16 — Multi-tenant isolation
-- Ajoute restaurantId aux modèles qui n'en avaient pas encore
-- et convertit Parametre en clé primaire composée.
-- ============================================================

-- ── Fournisseur ──────────────────────────────────────────────
ALTER TABLE "fournisseurs"
  ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

CREATE INDEX IF NOT EXISTS "fournisseurs_restaurantId_idx"
  ON "fournisseurs"("restaurantId");

-- ── Livreur ──────────────────────────────────────────────────
ALTER TABLE "livreurs"
  ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

CREATE INDEX IF NOT EXISTS "livreurs_restaurantId_idx"
  ON "livreurs"("restaurantId");

-- ── MessageInterne ───────────────────────────────────────────
ALTER TABLE "messages_internes"
  ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

CREATE INDEX IF NOT EXISTS "messages_internes_restaurantId_idx"
  ON "messages_internes"("restaurantId");

-- ── JournalActivite ──────────────────────────────────────────
ALTER TABLE "journal_activite"
  ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

CREATE INDEX IF NOT EXISTS "journal_activite_restaurantId_idx"
  ON "journal_activite"("restaurantId");

-- ── Parametre : passage à clé primaire composée (id, restaurantId)
-- Étape 1 : ajouter la colonne restaurantId avec valeur par défaut ""
ALTER TABLE "parametres"
  ADD COLUMN IF NOT EXISTS "restaurantId_new" TEXT NOT NULL DEFAULT '';

-- Étape 2 : copier les valeurs existantes (restaurantId nullable → '')
UPDATE "parametres" SET "restaurantId_new" = COALESCE("restaurantId", '');

-- Étape 3 : supprimer l'ancienne PK
ALTER TABLE "parametres" DROP CONSTRAINT IF EXISTS "parametres_pkey";

-- Étape 4 : supprimer l'ancienne colonne restaurantId nullable
ALTER TABLE "parametres" DROP COLUMN IF EXISTS "restaurantId";

-- Étape 5 : renommer la nouvelle colonne
ALTER TABLE "parametres" RENAME COLUMN "restaurantId_new" TO "restaurantId";

-- Étape 6 : créer la nouvelle clé primaire composée
ALTER TABLE "parametres"
  ADD CONSTRAINT "parametres_pkey" PRIMARY KEY ("id", "restaurantId");

CREATE INDEX IF NOT EXISTS "parametres_restaurantId_idx"
  ON "parametres"("restaurantId");
