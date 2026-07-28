-- Migration v12 → v13 : Multi-restaurants + Achats + RH
-- npx prisma migrate dev --name v13_multisite  OU  psql $DATABASE_URL -f v13_migration.sql

CREATE TABLE IF NOT EXISTS "restaurants" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "nom" TEXT NOT NULL, "ville" TEXT NOT NULL, "quartier" TEXT NOT NULL,
  "adresse" TEXT, "tel" TEXT, "actif" BOOLEAN NOT NULL DEFAULT true,
  "couleur" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "commandes"       ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "reservations"    ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "menu_items"      ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "depenses"        ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "stock_items"     ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "tables"          ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "caisse_sessions" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "bons_commande"   ADD COLUMN IF NOT EXISTS "restaurantId" TEXT REFERENCES "restaurants"("id");
ALTER TABLE "bons_commande"   ADD COLUMN IF NOT EXISTS "demandeAchatId" TEXT;

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL, "groupe" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "user_permissions" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "permissionId" TEXT NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "accordePar" TEXT NOT NULL, "accordeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "permissionId")
);
CREATE TABLE IF NOT EXISTS "demandes_achat" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL REFERENCES "restaurants"("id"),
  "demandeurId" TEXT NOT NULL, "demandeurNom" TEXT NOT NULL,
  "article" TEXT NOT NULL, "quantite" DOUBLE PRECISION NOT NULL,
  "unite" TEXT NOT NULL, "montantEstime" INTEGER, "motif" TEXT,
  "urgence" TEXT NOT NULL DEFAULT 'normale', "status" TEXT NOT NULL DEFAULT 'en_attente',
  "valideePar" TEXT, "refuseePar" TEXT, "motifRefus" TEXT, "bonCommandeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "receptions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL REFERENCES "restaurants"("id"),
  "bonCommandeId" TEXT NOT NULL, "receptionnePar" TEXT NOT NULL,
  "items" JSONB NOT NULL DEFAULT '[]', "observation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'complete',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "notes_frais" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL REFERENCES "restaurants"("id"),
  "employeId" TEXT NOT NULL, "employeNom" TEXT NOT NULL,
  "montant" INTEGER NOT NULL, "categorie" TEXT NOT NULL,
  "description" TEXT NOT NULL, "justificatif" TEXT,
  "status" TEXT NOT NULL DEFAULT 'en_attente', "valideePar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "pointages" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL REFERENCES "restaurants"("id"),
  "userId" TEXT NOT NULL, "userName" TEXT NOT NULL, "type" TEXT NOT NULL,
  "heure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "noteManager" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "primes_performance" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL REFERENCES "restaurants"("id"),
  "userId" TEXT NOT NULL, "userName" TEXT NOT NULL,
  "montant" INTEGER NOT NULL, "motif" TEXT NOT NULL,
  "periode" TEXT NOT NULL, "accordePar" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "analytics_daily" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL REFERENCES "restaurants"("id"),
  "date" TEXT NOT NULL, "caTotal" INTEGER NOT NULL DEFAULT 0,
  "nbCommandes" INTEGER NOT NULL DEFAULT 0, "nbCouverts" INTEGER NOT NULL DEFAULT 0,
  "topPlats" JSONB NOT NULL DEFAULT '[]', "parHeure" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("restaurantId", "date")
);

CREATE INDEX IF NOT EXISTS "idx_commandes_restaurantId"    ON "commandes"("restaurantId");
CREATE INDEX IF NOT EXISTS "idx_reservations_restaurantId" ON "reservations"("restaurantId");
CREATE INDEX IF NOT EXISTS "idx_demandes_achat_status"     ON "demandes_achat"("status");
CREATE INDEX IF NOT EXISTS "idx_pointages_userId"          ON "pointages"("userId");
CREATE INDEX IF NOT EXISTS "idx_analytics_daily_resto"     ON "analytics_daily"("restaurantId");

SELECT 'Migration v13 OK' AS status;

-- ── Extension v13.1 : Module RH complet ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "scores_performance" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "userName" TEXT NOT NULL,
  "semaine" TEXT NOT NULL, "scoreGlobal" INTEGER NOT NULL DEFAULT 0,
  "scorePresence" INTEGER NOT NULL DEFAULT 0, "scoreProductivite" INTEGER NOT NULL DEFAULT 0,
  "scoreQualite" INTEGER NOT NULL DEFAULT 0, "nbHeuresTravail" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "nbCommandesTraitees" INTEGER NOT NULL DEFAULT 0, "nbRetards" INTEGER NOT NULL DEFAULT 0,
  "nbErreurs" INTEGER NOT NULL DEFAULT 0, "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "semaine")
);

CREATE TABLE IF NOT EXISTS "planning_shifts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "userName" TEXT NOT NULL,
  "userRole" TEXT NOT NULL, "date" TEXT NOT NULL,
  "heureDebut" TEXT NOT NULL, "heureFin" TEXT NOT NULL,
  "poste" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT 'planifie',
  "note" TEXT, "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "signalements" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL, "categorie" TEXT NOT NULL,
  "description" TEXT NOT NULL, "gravite" TEXT NOT NULL DEFAULT 'normale',
  "statut" TEXT NOT NULL DEFAULT 'ouvert',
  "traitePar" TEXT, "commentaireTraitement" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "checklist_templates" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT, "role" TEXT NOT NULL, "moment" TEXT NOT NULL,
  "titre" TEXT NOT NULL, "items" JSONB NOT NULL DEFAULT '[]',
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "checklist_completions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "templateId" TEXT NOT NULL, "userId" TEXT NOT NULL, "userName" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL, "date" TEXT NOT NULL, "moment" TEXT NOT NULL,
  "itemsCoches" JSONB NOT NULL DEFAULT '[]',
  "complet" BOOLEAN NOT NULL DEFAULT false, "signature" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("templateId", "userId", "date", "moment")
);

CREATE TABLE IF NOT EXISTS "heures_supplementaires" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "userName" TEXT NOT NULL,
  "semaine" TEXT NOT NULL, "heuresNormales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "heuresSup" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tauxMajoration" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  "montantBrut" INTEGER NOT NULL DEFAULT 0,
  "statut" TEXT NOT NULL DEFAULT 'calculee',
  "approuvePar" TEXT, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "semaine")
);

CREATE TABLE IF NOT EXISTS "evaluations" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurantId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "evaluateurId" TEXT, "evalueId" TEXT, "evalueNom" TEXT,
  "periode" TEXT NOT NULL, "criteres" JSONB NOT NULL DEFAULT '[]',
  "noteGlobale" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pointsForts" TEXT, "axesAmelioration" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "badges" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL,
  "description" TEXT NOT NULL, "emoji" TEXT NOT NULL,
  "couleur" TEXT NOT NULL DEFAULT '#C9973C', "condition" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_badges" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL, "userName" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL, "badgeId" TEXT NOT NULL REFERENCES "badges"("id"),
  "obtenuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "contexte" TEXT,
  UNIQUE ("userId", "badgeId", "contexte")
);

CREATE INDEX IF NOT EXISTS "idx_scores_semaine"   ON "scores_performance"("semaine");
CREATE INDEX IF NOT EXISTS "idx_planning_date"    ON "planning_shifts"("date");
CREATE INDEX IF NOT EXISTS "idx_signalements_statut" ON "signalements"("statut");
CREATE INDEX IF NOT EXISTS "idx_checklist_userId" ON "checklist_completions"("userId");
CREATE INDEX IF NOT EXISTS "idx_hs_statut"        ON "heures_supplementaires"("statut");
CREATE INDEX IF NOT EXISTS "idx_evals_periode"    ON "evaluations"("periode");
CREATE INDEX IF NOT EXISTS "idx_ubadges_userId"   ON "user_badges"("userId");

SELECT 'Migration v13.1 RH OK' AS status;
