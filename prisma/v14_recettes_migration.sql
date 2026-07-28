-- Migration v14 : Table recettes_ingredients
-- Permet le décrément automatique du stock à la validation des commandes
-- À exécuter après v13_migration.sql

-- Table de nomenclature plat ↔ ingrédients stock
CREATE TABLE IF NOT EXISTS recettes_ingredients (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "restaurantId" TEXT,
  "menuItemId"   INTEGER     NOT NULL,
  "menuItemNom"  TEXT        NOT NULL,
  "stockItemId"  TEXT        NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  quantite       FLOAT       NOT NULL CHECK (quantite > 0),
  unite          TEXT        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE ("menuItemId", "stockItemId")
);

CREATE INDEX IF NOT EXISTS idx_recettes_menu_item   ON recettes_ingredients ("menuItemId");
CREATE INDEX IF NOT EXISTS idx_recettes_stock_item  ON recettes_ingredients ("stockItemId");
CREATE INDEX IF NOT EXISTS idx_recettes_restaurant  ON recettes_ingredients ("restaurantId");

-- Trigger pour mettre à jour updatedAt automatiquement
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_recettes ON recettes_ingredients;
CREATE TRIGGER set_timestamp_recettes
  BEFORE UPDATE ON recettes_ingredients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Commentaires
COMMENT ON TABLE recettes_ingredients IS 'Nomenclature plat → ingrédients. Déclenche le décrément stock à la validation commande.';
COMMENT ON COLUMN recettes_ingredients."menuItemId"  IS 'FK vers menu_items.id (non contrainte pour éviter les conflits de type INT)';
COMMENT ON COLUMN recettes_ingredients.quantite      IS 'Quantité consommée par portion commandée (ex: 0.2 pour 200g)';
