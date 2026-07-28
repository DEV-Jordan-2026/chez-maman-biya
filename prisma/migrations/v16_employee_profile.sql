-- Migration v16 : Dossier administratif complet des employés
-- Crée la table employee_profiles liée au compte User

CREATE TABLE IF NOT EXISTS "employee_profiles" (
  "id"               TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"           TEXT NOT NULL UNIQUE,
  "restaurantId"     TEXT,

  -- Identité
  "dateNaissance"    TEXT,
  "lieuNaissance"    TEXT,
  "nationalite"      TEXT DEFAULT 'Camerounaise',
  "cni"              TEXT,
  "cniExpiration"    TEXT,

  -- Coordonnées
  "adresse"          TEXT,
  "ville"            TEXT,
  "tel"              TEXT,
  "telUrgence"       TEXT,
  "contactUrgence"   TEXT,
  "lienUrgence"      TEXT,

  -- Poste & contrat
  "poste"            TEXT,
  "typeContrat"      TEXT,
  "dateEmbauche"     TEXT,
  "dateFinContrat"   TEXT,
  "salaire"          INTEGER,
  "modePaieSalaire"  TEXT,
  "numeroRIB"        TEXT,
  "numeroMoMo"       TEXT,

  -- Documents
  "cniFournie"       BOOLEAN NOT NULL DEFAULT false,
  "contratSigne"     BOOLEAN NOT NULL DEFAULT false,
  "photoFournie"     BOOLEAN NOT NULL DEFAULT false,
  "casierFourni"     BOOLEAN NOT NULL DEFAULT false,

  -- Méta
  "note"             TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "employee_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_profiles_restaurantId_idx" ON "employee_profiles"("restaurantId");

-- Trigger pour updatedAt automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_employee_profiles_updated_at ON "employee_profiles";
CREATE TRIGGER update_employee_profiles_updated_at
  BEFORE UPDATE ON "employee_profiles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
