// prisma/seed-badges.js — Initialiser le catalogue de badges
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const BADGES = [
  { code: 'score_100',         label: 'Score parfait',        emoji: '💯', couleur: '#C9973C', condition: 'Score de performance 100/100 en une semaine', description: 'Performance exceptionnelle sur tous les critères' },
  { code: 'presence_parfaite', label: 'Présence exemplaire',  emoji: '⭐', couleur: '#10b981', condition: 'Aucun retard, semaine complète 30h+', description: 'Ponctualité et régularité irréprochables' },
  { code: 'zero_erreur',       label: 'Zéro défaut',          emoji: '🎯', couleur: '#8b5cf6', condition: 'Aucune erreur signalée sur 20h+ de travail', description: 'Qualité de service sans faille' },
  { code: 'top_productif',     label: 'Top productivité',     emoji: '🚀', couleur: '#06b6d4', condition: 'Score productivité ≥ 25/30', description: 'Rendement remarquable sur la semaine' },
  { code: 'anciennete_1an',    label: '1 an dans l\'équipe',  emoji: '🎖️', couleur: '#f59e0b', condition: '1 an d\'ancienneté', description: 'Fidélité et engagement sur le long terme' },
  { code: 'meilleur_mois',     label: 'Meilleur du mois',     emoji: '🏆', couleur: '#ef4444', condition: 'Meilleur score du mois dans le restaurant', description: 'Champion de performance mensuel' },
  { code: 'formateur',         label: 'Formateur',            emoji: '📚', couleur: '#84cc16', condition: 'Participation à la formation d\'un nouveau', description: 'Partage de compétences et esprit d\'équipe' },
  { code: 'ponctualite_30j',   label: 'Ponctualité 30j',      emoji: '⏰', couleur: '#06b6d4', condition: 'Aucun retard sur 30 jours consécutifs', description: 'Régularité exemplaire sur un mois entier' },
]

async function main() {
  console.log('🏅 Seeding badges...')
  for (const b of BADGES) {
    await prisma.badge.upsert({
      where:  { code: b.code },
      update: { label: b.label, emoji: b.emoji, couleur: b.couleur, description: b.description, condition: b.condition },
      create: b,
    })
    process.stdout.write('.')
  }
  console.log(`\n✅ ${BADGES.length} badges initialisés`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
