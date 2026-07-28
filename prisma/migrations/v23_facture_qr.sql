-- prisma/migrations/v23_facture_qr.sql
-- Ajout du numéro de facture séquentiel et du hash QR sur la table commandes.
-- numeroFacture : ex "FAC-2025-000042" — généré à l'encaissement
-- qrHash        : HMAC-SHA256 hex 64 chars — signé côté serveur
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS "numeroFacture" TEXT,
  ADD COLUMN IF NOT EXISTS "qrHash"        TEXT;

-- Index pour la recherche rapide par numéro de facture (admin, reporting)
CREATE UNIQUE INDEX IF NOT EXISTS "commandes_numeroFacture_key"
  ON commandes ("numeroFacture")
  WHERE "numeroFacture" IS NOT NULL;

-- Note : les commandes existantes (antérieures à cette migration) auront
-- numeroFacture = NULL et qrHash = NULL.
-- Elles resteront vérifiables via leur id si un QR est régénéré manuellement.
