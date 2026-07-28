-- Migration v22 : Acompte à la livraison
-- ──────────────────────────────────────────────────────────────────────────────
-- Contexte : paiement à la livraison avec dépôt partiel (30% par défaut) payé
-- via CinetPay avant que la commande ne soit confirmée en cuisine.
--
-- acompte        = montant du dépôt CinetPay (ex: 1 500 FCFA)
-- resteARegler   = solde à encaisser par le livreur (ex: 3 500 FCFA)
-- acompteStatut  = null | 'requis' | 'paye' | 'exempte'
-- acompteTransId = transaction CinetPay de l'acompte (pour traçabilité / remboursement)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "acompte"        INTEGER      NOT NULL DEFAULT 0;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "resteARegler"   INTEGER      NOT NULL DEFAULT 0;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "acompteStatut"  VARCHAR(50);
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "acompteTransId" VARCHAR(150);

-- Index sur acompteStatut pour les requêtes "en attente d'acompte"
CREATE INDEX IF NOT EXISTS "commandes_acompteStatut_idx" ON commandes("acompteStatut");

-- Vérification
DO $$
BEGIN
  RAISE NOTICE 'v22_acompte_livraison : 4 colonnes ajoutées à commandes ✓';
END $$;
