-- Migration : v17_facture_sequence
-- Ajout du modèle FactureSequence pour :
--   C3 : séquence atomique rapport Z (évite les doublons sous charge)
--   A1 : numéro de reçu séquentiel CD-XXXXX pour la caisse directe

CREATE TABLE IF NOT EXISTS "facture_sequences" (
  "id"             TEXT NOT NULL,
  "restaurantId"   TEXT NOT NULL,
  "type"           TEXT NOT NULL DEFAULT 'z_rapport',
  "derniereValeur" INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "facture_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "facture_sequences_restaurantId_type_key"
  ON "facture_sequences"("restaurantId", "type");

-- Index de performance
CREATE INDEX IF NOT EXISTS "facture_sequences_restaurantId_idx"
  ON "facture_sequences"("restaurantId");
