-- Migration v15 : Historique des mouvements de stock
-- Traçabilité complète de chaque entrée / sortie / ajustement de stock
-- À exécuter après v14_recettes_migration.sql
--
--   psql $DATABASE_URL -f v15_mouvements_stock.sql
--   OU  npx prisma migrate dev --name v15_mouvements_stock

-- ──────────────────────────────────────────────────────────────────────────────
-- Table principale
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "stockItemId"  TEXT        NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  "restaurantId" TEXT,

  -- Type de mouvement : entree | sortie | ajustement | inventaire
  type           TEXT        NOT NULL CHECK (type IN ('entree','sortie','ajustement','inventaire')),
  -- Source déclencheuse : reception | commande | manuel | inventaire
  source         TEXT        NOT NULL CHECK (source IN ('reception','commande','manuel','inventaire')),

  quantite       FLOAT       NOT NULL CHECK (quantite >= 0),  -- valeur absolue
  "stockAvant"   FLOAT       NOT NULL,
  "stockApres"   FLOAT       NOT NULL,

  reference      TEXT,         -- ID commande / réception / bon
  auteur         TEXT        NOT NULL,
  note           TEXT,

  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- Index pour les requêtes fréquentes
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mvt_stock_item   ON mouvements_stock ("stockItemId");
CREATE INDEX IF NOT EXISTS idx_mvt_restaurant   ON mouvements_stock ("restaurantId");
CREATE INDEX IF NOT EXISTS idx_mvt_created_at   ON mouvements_stock ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_mvt_type         ON mouvements_stock (type);

-- Index composé pour les requêtes historique par restaurant + date
CREATE INDEX IF NOT EXISTS idx_mvt_resto_date
  ON mouvements_stock ("restaurantId", "createdAt" DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- Commentaires
-- ──────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE mouvements_stock IS
  'Historique immutable de tous les mouvements de stock (entrées, sorties, ajustements manuels).';
COMMENT ON COLUMN mouvements_stock.type IS
  'entree=réception marchandises, sortie=consommation commande, ajustement=correction manuelle, inventaire=résultat inventaire physique';
COMMENT ON COLUMN mouvements_stock.source IS
  'reception=bon de commande réceptionné, commande=décrément automatique validation commande, manuel=saisie magasinier/manager, inventaire=inventaire physique';
COMMENT ON COLUMN mouvements_stock.quantite IS
  'Valeur absolue du mouvement (toujours positive). Le sens est porté par le champ type.';
COMMENT ON COLUMN mouvements_stock.reference IS
  'Identifiant de l''objet déclencheur : ID commande, ID réception ou ID bon de commande.';
