-- ═══════════════════════════════════════════════════════════════════════════
-- Migration v20 — Correctifs d'isolation tenant (C5, C6, C8)
-- Appliqué après : v19_toggle_ouvert.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- IMPORTANT : vérifier l'absence de données orphelines AVANT d'appliquer
-- les contraintes FK (étapes marquées [CHECK]).
--
-- Pour vérifier :
--   SELECT id FROM "commandes_table"   WHERE "restaurantId" IS NOT NULL
--     AND "restaurantId" NOT IN (SELECT id FROM "restaurants");
--   SELECT id FROM "remises_manuelles" WHERE "restaurantId" IS NOT NULL
--     AND "restaurantId" NOT IN (SELECT id FROM "restaurants");
--   SELECT id FROM "mouvements_stock"  WHERE "restaurantId" IS NOT NULL
--     AND "restaurantId" NOT IN (SELECT id FROM "restaurants");
--   SELECT id FROM "scores_performance" WHERE "restaurantId" NOT IN (SELECT id FROM "restaurants");
--   SELECT id FROM "user_badges"        WHERE "restaurantId" NOT IN (SELECT id FROM "restaurants");
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── C5 : CommandeTable — ajout restaurantId ─────────────────────────────────
ALTER TABLE "commandes_table"
  ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

CREATE INDEX IF NOT EXISTS "commandes_table_restaurantId_idx"
  ON "commandes_table"("restaurantId");

-- [CHECK] Données orphelines sur commandes_table avant d'appliquer la FK :
-- SELECT id FROM "commandes_table" WHERE "restaurantId" IS NOT NULL
--   AND "restaurantId" NOT IN (SELECT id FROM "restaurants");

ALTER TABLE "commandes_table"
  ADD CONSTRAINT "commandes_table_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── C6 : RemiseManuelle — ajout restaurantId + index commandeId ─────────────
ALTER TABLE "remises_manuelles"
  ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

CREATE INDEX IF NOT EXISTS "remises_manuelles_restaurantId_idx"
  ON "remises_manuelles"("restaurantId");

CREATE INDEX IF NOT EXISTS "remises_manuelles_commandeId_idx"
  ON "remises_manuelles"("commandeId");

-- [CHECK] Données orphelines sur remises_manuelles avant FK :
-- SELECT id FROM "remises_manuelles" WHERE "restaurantId" IS NOT NULL
--   AND "restaurantId" NOT IN (SELECT id FROM "restaurants");

ALTER TABLE "remises_manuelles"
  ADD CONSTRAINT "remises_manuelles_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── C8a : MouvementStock — FK formelle (colonne existante, contrainte manquante)
-- SetNull → l'historique des mouvements est conservé si le restaurant est supprimé
-- [CHECK] : SELECT id FROM "mouvements_stock" WHERE "restaurantId" IS NOT NULL
--             AND "restaurantId" NOT IN (SELECT id FROM "restaurants");

ALTER TABLE "mouvements_stock"
  ADD CONSTRAINT "mouvements_stock_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── C8b : ScorePerformance — FK formelle (colonne existante, contrainte manquante)
-- Cascade → les scores sont supprimés avec le restaurant
-- [CHECK] : SELECT id FROM "scores_performance"
--             WHERE "restaurantId" NOT IN (SELECT id FROM "restaurants");

ALTER TABLE "scores_performance"
  ADD CONSTRAINT "scores_performance_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── C8c : UserBadge — FK formelle (colonne existante, contrainte manquante)
-- Cascade → les badges attribués sont supprimés avec le restaurant
-- [CHECK] : SELECT id FROM "user_badges"
--             WHERE "restaurantId" NOT IN (SELECT id FROM "restaurants");

ALTER TABLE "user_badges"
  ADD CONSTRAINT "user_badges_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN migration v20
-- ═══════════════════════════════════════════════════════════════════════════
