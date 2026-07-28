-- Migration v19 — Toggle ouvert/fermé manuel par restaurant
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "ouvert" BOOLEAN NOT NULL DEFAULT true;
