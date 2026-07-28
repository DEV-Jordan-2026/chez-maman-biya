// lib/data.js
// Source de vérité : données statiques (promos, témoignages, infos resto)
// Le MENU est maintenant géré via Prisma (voir prisma/schema.prisma → MenuItem)

import prisma from '@/lib/db'
import { SITE_IMAGES_DEFAULTS } from '@/app/api/images/route'

// ── Menu depuis la base de données ───────────────────────────────────────────

export async function getMenu() {
  return prisma.menuItem.findMany({
    where:   { actif: true },
    orderBy: [{ cat: 'asc' }, { name: 'asc' }],
  })
}

export async function getPlatById(id) {
  return prisma.menuItem.findUnique({ where: { id: Number(id) } })
}

// Plat du jour : change chaque jour en fonction de la date
export async function getPlatDuJour() {
  const plats = await prisma.menuItem.findMany({
    where:   { actif: true, cat: 'Plats' },
    orderBy: { id: 'asc' },
  })
  if (!plats.length) return null

  const index = new Date().getDay() % plats.length
  const plat  = plats[index]
  return {
    ...plat,
    reduction:  15,
    prixReduit: Math.round(plat.price * 0.85),
  }
}

// ── Promotions ────────────────────────────────────────────────────────────────

export const PROMOTIONS = [
  {
    id: 'promo-1',
    titre: '🎉 Plat du jour à -15%',
    desc: 'Un plat différent chaque jour à prix réduit !',
    type: 'plat_du_jour',
    couleur: '#f59e0b',
  },
  {
    id: 'promo-2',
    titre: '🛵 Livraison offerte',
    desc: 'Dès 5 000 FCFA de commande',
    type: 'livraison',
    couleur: '#10b981',
  },
  {
    id: 'promo-3',
    titre: '💰 -10% dès 15 000 FCFA',
    desc: 'Réduction automatique sur les grosses commandes',
    type: 'reduction',
    couleur: '#c8783a',
  },
  {
    id: 'promo-4',
    titre: '⭐ Programme fidélité',
    desc: 'Votre 5ème commande = dessert offert',
    type: 'fidelite',
    couleur: '#8b5cf6',
  },
]

// ── Témoignages ───────────────────────────────────────────────────────────────

export const TEMOIGNAGES = [
  {
    id: 1, nom: 'Marie-Claire Essono', quartier: 'Bastos',
    texte: 'Le meilleur ndolé de Yaoundé, sans exagérer ! Maman Biya met tellement d\'amour dans sa cuisine. Je commande chaque semaine depuis 3 ans.',
    note: 5, commandes: 156, plat: 'Ndolé au poisson fumé',
  },
  {
    id: 2, nom: 'Jean-Paul Owono', quartier: 'Melen',
    texte: 'J\'ai découvert ce restaurant grâce à un collègue. Le Poulet DG est incroyable, et la livraison est toujours à l\'heure. Merci Maman Biya !',
    note: 5, commandes: 42, plat: 'Poulet DG',
  },
  {
    id: 3, nom: 'Fatima Abdoulaye', quartier: 'Nlongkak',
    texte: 'Ce qui me touche, c\'est qu\'on retrouve le vrai goût de chez nous. Comme si c\'était ma propre maman qui cuisinait. Le poisson braisé est une tuerie.',
    note: 5, commandes: 89, plat: 'Poisson braisé entier',
  },
  {
    id: 4, nom: 'Dr. Pierre Kenfack', quartier: 'Omnisport',
    texte: 'Parfait pour nos déjeuners d\'affaires. Le cadre est chaleureux, les plats sont copieux, et le service est impeccable. Je recommande à 100%.',
    note: 5, commandes: 28, plat: 'Eru avec waterleaf',
  },
  {
    id: 5, nom: 'Cécile Ngatchou', quartier: 'Etoa-Meki',
    texte: 'J\'habite loin mais je fais le déplacement spécialement pour le Koki de Maman Biya. Avec les bâtons de manioc, c\'est le paradis !',
    note: 5, commandes: 34, plat: 'Koki aux haricots',
  },
]

// ── Histoire du restaurant ────────────────────────────────────────────────────

export const HISTOIRE = {
  fondatrice: 'Maman Biya',
  annee: 2012,
  paragraphes: [
    'Tout a commencé dans une petite cuisine de Bastos, où Maman Biya préparait ses recettes familiales pour les voisins et les amis. Le bouche-à-oreille a fait le reste : en quelques mois, les gens venaient de tout Yaoundé pour goûter son ndolé.',
    'Aujourd\'hui, « Chez Maman Biya » est devenu une adresse incontournable de la cuisine camerounaise à Yaoundé. Chaque plat est préparé avec les mêmes recettes transmises de mère en fille, avec des ingrédients frais achetés chaque matin au marché de Mokolo.',
    'Notre philosophie est simple : cuisiner comme à la maison, avec amour et générosité. Pas de raccourcis, pas de surgelés. Juste le vrai goût du Cameroun.',
  ],
  valeurs: [
    { emoji: '❤️', titre: 'Fait avec amour',     desc: 'Chaque plat est préparé comme pour notre propre famille' },
    { emoji: '🌿', titre: 'Ingrédients frais',   desc: 'Achetés chaque matin au marché de Mokolo' },
    { emoji: '👩‍🍳', titre: 'Recettes ancestrales', desc: 'Transmises de mère en fille depuis 3 générations' },
    { emoji: '🤝', titre: 'Esprit communautaire', desc: 'Nous employons 15 personnes du quartier' },
  ],
}

// ── Informations restaurant ───────────────────────────────────────────────────

export const RESTAURANT_INFO = {
  nom: 'Chez Maman Biya',
  slogan: 'La saveur de chez nous, livrée à votre table.',
  adresse: 'Quartier Bastos, Yaoundé, Cameroun',
  tel: '+237 677 000 000',
  email: 'contact@chezmamanbiya.cm',
  whatsapp: '+237 677 000 000',
  horaires: {
    semaine: '11h00 – 22h00',
    samedi:  '10h00 – 23h00',
    dimanche:'11h00 – 21h00',
  },
  coordonnees: { lat: 3.8812, lng: 11.5021 },
  livraison: {
    rayon:       8,
    frais:       500,
    gratuitDe:   5000,
    tempsEstime: '30-50 min',
  },
  reduction:  { seuil: 15000, taux: 0.10 },
  fidelite:   { commandesPourRecompense: 5, recompense: 'Dessert offert' },
  reseaux: {
    facebook:    'https://facebook.com/chezmamanbiya',
    instagram:   'https://instagram.com/chezmamanbiya',
    whatsappUrl: 'https://wa.me/237677000000',
  },
}

// ── Images du site (hero, galerie, fonds) ─────────────────────────────────────
// Chargées côté serveur → passées en props aux composants client → 0 flash
export async function getSiteImages(restaurantId = '') {
  try {
    const row = await prisma.parametre.findFirst({
      where: {
        id: 'site_images',
        OR: [
          { restaurantId },
          { restaurantId: '' },
        ],
      },
      orderBy: { restaurantId: 'desc' },
    })
    if (!row) return SITE_IMAGES_DEFAULTS

    const parsed = JSON.parse(row.valeur)
    return {
      hero_bg: parsed.hero_bg || SITE_IMAGES_DEFAULTS.hero_bg,
      cta_bg:  parsed.cta_bg  || SITE_IMAGES_DEFAULTS.cta_bg,
      menu_bg: parsed.menu_bg || SITE_IMAGES_DEFAULTS.menu_bg,
      galerie: Array.isArray(parsed.galerie) && parsed.galerie.length === 5
        ? parsed.galerie.map((g, i) => ({
            url:   g.url   || SITE_IMAGES_DEFAULTS.galerie[i].url,
            label: g.label || SITE_IMAGES_DEFAULTS.galerie[i].label,
          }))
        : SITE_IMAGES_DEFAULTS.galerie,
    }
  } catch {
    return SITE_IMAGES_DEFAULTS
  }
}

// ── Plats vedettes homepage (3 premiers items popular, ou 3 premiers actifs) ─
export async function getPlatsVedettes() {
  try {
    const populaires = await prisma.menuItem.findMany({
      where:   { actif: true, popular: true },
      orderBy: [{ cat: 'asc' }, { name: 'asc' }],
      take:    3,
    })
    if (populaires.length >= 3) return populaires

    // Compléter avec d'autres plats actifs si moins de 3 populaires
    const ids      = populaires.map(p => p.id)
    const extras   = await prisma.menuItem.findMany({
      where:   { actif: true, id: { notIn: ids } },
      orderBy: [{ cat: 'asc' }, { name: 'asc' }],
      take:    3 - populaires.length,
    })
    return [...populaires, ...extras]
  } catch {
    return []
  }
}
