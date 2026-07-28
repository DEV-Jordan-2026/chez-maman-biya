-- ─────────────────────────────────────────────────────────────────
-- Migration v24 : Poste cuisine sur menu_items
-- ─────────────────────────────────────────────────────────────────

-- 1. Créer le type enum PostgreSQL
CREATE TYPE "PosteCuisine" AS ENUM ('CHAUD', 'FROID', 'GRILLADE', 'PATISSERIE');

-- 2. Ajouter la colonne avec valeur par défaut
ALTER TABLE "menu_items"
  ADD COLUMN "poste" "PosteCuisine" NOT NULL DEFAULT 'CHAUD';

-- 3. Mise à jour heuristique des données existantes
--    (mots-clés dans le nom du plat → poste correspondant)

-- GRILLADE : viandes grillées / braisées
UPDATE "menu_items"
SET "poste" = 'GRILLADE'
WHERE LOWER("name") ~ '(brais|grill|poulet|boeuf|viande|porc|saucisse|côte|entrecôte|agneau|côtelette|churrasco)';

-- FROID : salades, jus, desserts froids
UPDATE "menu_items"
SET "poste" = 'FROID'
WHERE LOWER("name") ~ '(salade|crudités|jus|smoothie|yaourt|dessert|mousse|fruit|glace|sorbet|macédoine)'
  AND "poste" = 'CHAUD';   -- ne pas écraser GRILLADE si déjà mis à jour

-- PATISSERIE : gâteaux, pains, beignets
UPDATE "menu_items"
SET "poste" = 'PATISSERIE'
WHERE LOWER("name") ~ '(gâteau|tarte|cake|beignet|pâtisserie|mille.feuille|pain|brioche|viennoiserie|donut)'
  AND "poste" = 'CHAUD';

-- Tout le reste reste CHAUD (ndolé, eru, sauce arachide, soupe, riz…)

-- 4. Commentaire pour traçabilité
COMMENT ON COLUMN "menu_items"."poste" IS 'Poste cuisine assigné (CHAUD | FROID | GRILLADE | PATISSERIE). Mis à jour manuellement via le back-office manager.';
