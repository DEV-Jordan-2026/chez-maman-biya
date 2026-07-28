-- Migration v25 : Assignation livreur
-- ──────────────────────────────────────────────────────────────────────────────
-- Contexte : ajout d'une relation explicite entre Commande et Livreur, pour
-- permettre de retrouver toutes les commandes d'un livreur, d'afficher son nom
-- sur la commande, de mettre à jour son statut automatiquement à l'assignation
-- et de permettre la désassignation / réassignation.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "livreurId" TEXT;

ALTER TABLE commandes
  ADD CONSTRAINT IF NOT EXISTS "commandes_livreurId_fkey"
  FOREIGN KEY ("livreurId") REFERENCES livreurs(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "commandes_livreurId_idx" ON commandes("livreurId");

-- Vérification
DO $$
BEGIN
  RAISE NOTICE 'v25_livreur_assignation : colonne livreurId + FK ajoutées à commandes ✓';
END $$;
