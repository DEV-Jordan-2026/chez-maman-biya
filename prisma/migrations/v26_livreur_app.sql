-- Migration v26 : App livreur (/livraison)
-- ──────────────────────────────────────────────────────────────────────────────
-- pinHash         : PIN 4 chiffres (bcrypt) permettant au livreur de se connecter
--                    à /livraison avec son numéro de téléphone + PIN.
-- encaisseMethode : moyen de paiement effectivement reçu par le livreur à la
--                    livraison ('especes' | 'mtn_momo' | 'orange_money').
-- encaisseMontant : montant réellement encaissé (peut différer du total si remise).
-- encaisseAt      : horodatage de la confirmation d'encaissement par le livreur.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE livreurs  ADD COLUMN IF NOT EXISTS "pinHash"         TEXT;

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "encaisseMethode" VARCHAR(20);
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "encaisseMontant" INTEGER;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS "encaisseAt"      TIMESTAMP;

DO $$
BEGIN
  RAISE NOTICE 'v26_livreur_app : pinHash (livreurs) + encaissement (commandes) ajoutés ✓';
END $$;
