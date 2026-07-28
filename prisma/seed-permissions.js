// prisma/seed-permissions.js — v13
// Initialiser le catalogue de permissions en base

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PERMISSIONS_CATALOGUE = [
  { code: 'voir_commandes',             label: 'Voir les commandes',              groupe: 'Opérations' },
  { code: 'modifier_commandes',         label: 'Modifier les commandes',          groupe: 'Opérations' },
  { code: 'annuler_commandes',          label: 'Annuler les commandes',           groupe: 'Opérations' },
  { code: 'voir_plan_salle',            label: 'Voir le plan de salle',           groupe: 'Opérations' },
  { code: 'modifier_menu',              label: 'Modifier le menu',                groupe: 'Opérations' },
  { code: 'voir_comptabilite',          label: 'Voir la comptabilité',            groupe: 'Finance' },
  { code: 'voir_analytics',             label: 'Voir les analytics',              groupe: 'Finance' },
  { code: 'ouvrir_caisse',              label: 'Ouvrir/fermer la caisse',         groupe: 'Finance' },
  { code: 'voir_depenses',              label: 'Voir les dépenses',               groupe: 'Finance' },
  { code: 'creer_demande_achat',        label: "Créer des demandes d'achat",      groupe: 'Achats' },
  { code: 'valider_demande_achat',      label: "Valider des demandes d'achat",    groupe: 'Achats' },
  { code: 'gerer_fournisseurs',         label: 'Gérer les fournisseurs',          groupe: 'Achats' },
  { code: 'receptionner_marchandises',  label: 'Réceptionner les marchandises',   groupe: 'Achats' },
  { code: 'voir_equipe',                label: "Voir l'équipe",                   groupe: 'RH' },
  { code: 'gerer_equipe',               label: "Gérer l'équipe",                  groupe: 'RH' },
  { code: 'gerer_pointages',            label: 'Gérer les pointages',             groupe: 'RH' },
  { code: 'gerer_primes',               label: 'Attribuer des primes',            groupe: 'RH' },
  { code: 'voir_stocks',                label: 'Voir les stocks',                 groupe: 'Stocks' },
  { code: 'modifier_stocks',            label: 'Modifier les stocks',             groupe: 'Stocks' },
]

async function main() {
  console.log('🌱 Seeding permissions...')
  for (const p of PERMISSIONS_CATALOGUE) {
    await prisma.permission.upsert({
      where:  { code: p.code },
      update: { label: p.label, groupe: p.groupe },
      create: p,
    })
    process.stdout.write('.')
  }
  console.log(`\n✅ ${PERMISSIONS_CATALOGUE.length} permissions initialisées`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
