-- v21 : Suppression des champs SaaS publics du modèle Restaurant
-- Exécuter uniquement si ces colonnes existent (vérifier d'abord avec \d restaurants)

ALTER TABLE restaurants
  DROP COLUMN IF EXISTS plan,
  DROP COLUMN IF EXISTS "trialEndsAt",
  DROP COLUMN IF EXISTS "abonnementStatut";
