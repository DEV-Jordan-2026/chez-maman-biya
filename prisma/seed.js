// prisma/seed.js — Données initiales · Chez Maman Biya v20
// Compatible ESM + tsx — PAS de top-level await hors fonction
//
// IMAGES : les URLs ci-dessous sont null par défaut (emoji affiché en fallback).
// Pour ajouter les vraies photos de plats :
//   1. Uploadez chaque photo sur Cloudinary (cloudinary.com — gratuit jusqu'à 25GB).
//   2. Dans seed.js, remplacez null par l'URL complète, ex:
//        image: 'https://res.cloudinary.com/VOTRE_CLOUD/image/upload/v1/cmb/ndole.jpg'
//   3. Relancez : npm run db:seed
// Alternative sans re-seed : Admin → Menu → ✏️ Modifier → champ URL Photo.

import { PrismaClient } from '@prisma/client'
import { hashPassword }  from '../lib/auth.js'

const prisma = new PrismaClient()

// ── Remplacez les null par vos URLs Cloudinary ──────────────────────────────
const IMG = {
  ndole:          null, // 'https://res.cloudinary.com/CLOUD/image/upload/v1/cmb/ndole.jpg'
  ndoleCrevettes: null,
  pouletDG:       null,
  eru:            null,
  poissonBraise:  null,
  sangah:         null,
  koki:           null,
  mbongo:         null,
  soya:           null,
  batonsManioc:   null,
  plantain:       null,
  jusGingembre:   null,
  bissap:         null,
}

const MENU = [
  { cat:'Plats',           name:'Ndolé au poisson fumé',     price:3500, emoji:'🐟', actif:true, popular:true,  desc:'Feuilles de ndolé mijotées avec poisson fumé, crevettes séchées et arachides pilées.',              image:IMG.ndole,          tempsPrep:25 },
  { cat:'Plats',           name:'Ndolé aux crevettes',       price:4000, emoji:'🦐', actif:true, popular:false, desc:"Version généreuse du ndolé avec crevettes fraîches et huile de palme artisanale.",                 image:IMG.ndoleCrevettes, tempsPrep:30 },
  { cat:'Plats',           name:'Poulet DG',                 price:5000, emoji:'🍗', actif:true, popular:true,  desc:"Poulet braisé sauté avec banane plantain dorée, légumes frais et sauce tomate maison.",            image:IMG.pouletDG,       tempsPrep:35 },
  { cat:'Plats',           name:'Eru avec waterleaf',        price:3000, emoji:'🌿', actif:true, popular:false, desc:"Feuilles d'eru cuites à l'huile de palme avec waterleaf, viande de boeuf et crayfish.",           image:IMG.eru,            tempsPrep:30 },
  { cat:'Plats',           name:'Poisson braisé entier',     price:4500, emoji:'🐠', actif:true, popular:true,  desc:'Tilapia ou carpe braisé au feu de bois, servi avec plantain et sauce pimentée.',                   image:IMG.poissonBraise,  tempsPrep:40 },
  { cat:'Plats',           name:'Sangah',                    price:2500, emoji:'🌽', actif:true, popular:false, desc:"Maïs concassé cuit avec feuilles de manioc, huile de palme et poisson fumé.",                     image:IMG.sangah,         tempsPrep:25 },
  { cat:'Plats',           name:'Koki aux haricots',         price:2000, emoji:'🫘', actif:true, popular:false, desc:"Gâteau de haricots à l'huile de palme, cuit à la vapeur dans des feuilles de bananier.",          image:IMG.koki,           tempsPrep:20 },
  { cat:'Plats',           name:'Mbongo tchobi',             price:4500, emoji:'🍲', actif:true, popular:false, desc:'Poisson ou viande mijoté dans une sauce noire aux épices forestières.',                            image:IMG.mbongo,         tempsPrep:45 },
  { cat:'Plats',           name:'Soya de boeuf',             price:3000, emoji:'🥩', actif:true, popular:true,  desc:'Brochettes de boeuf marinées aux épices, grillées au feu de bois.',                               image:IMG.soya,           tempsPrep:15 },
  { cat:'Accompagnements', name:'Bâtons de manioc (10 pcs)', price:1500, emoji:'🍌', actif:true, popular:false, desc:'Manioc fermenté cuit à la vapeur dans des feuilles de bananier.',                                 image:IMG.batonsManioc,   tempsPrep:10 },
  { cat:'Accompagnements', name:'Plantain braisé',           price:1000, emoji:'🍌', actif:true, popular:false, desc:'Banane plantain mûre grillée au feu de bois.',                                                    image:IMG.plantain,       tempsPrep:10 },
  { cat:'Boissons',        name:'Jus de gingembre maison',   price:800,  emoji:'🥤', actif:true, popular:false, desc:'Gingembre frais pressé, citron vert, sucre de canne.',                                            image:IMG.jusGingembre,   tempsPrep:5  },
  { cat:'Boissons',        name:'Jus de bissap',             price:700,  emoji:'🌺', actif:true, popular:false, desc:'Hibiscus séché infusé à froid avec épices douces.',                                               image:IMG.bissap,         tempsPrep:5  },
  { cat:'Boissons',        name:'Eau minérale',              price:500,  emoji:'💧', actif:true, popular:false, desc:'Eau minérale fraîche, 50cl.',                                                                      image:null,               tempsPrep:1  },
]

const STOCKS = [
  { nom:'Feuilles de ndolé',    unite:'kg',      stock:8,  seuil:5,  cat:'Légumes'      },
  { nom:'Poisson fumé',         unite:'kg',      stock:3,  seuil:4,  cat:'Protéines'    },
  { nom:'Crevettes séchées',    unite:'kg',      stock:2,  seuil:2,  cat:'Protéines'    },
  { nom:'Huile de palme',       unite:'L',       stock:15, seuil:10, cat:'Huiles'       },
  { nom:'Arachides',            unite:'kg',      stock:6,  seuil:3,  cat:'Légumes secs' },
  { nom:'Banane plantain',      unite:'régimes', stock:4,  seuil:3,  cat:'Féculents'    },
  { nom:'Poulet vivant',        unite:'pièces',  stock:12, seuil:10, cat:'Protéines'    },
  { nom:'Gingembre frais',      unite:'kg',      stock:2,  seuil:2,  cat:'Épices'       },
  { nom:'Tilapia frais',        unite:'kg',      stock:5,  seuil:5,  cat:'Protéines'    },
  { nom:'Feuilles de bananier', unite:'bottes',  stock:8,  seuil:4,  cat:'Emballage'    },
]

const DEPENSES = [
  { libelle:'Marché Mokolo (ingrédients)', montant:45000,  categorie:'Achats',    date:new Date().toISOString().split('T')[0] },
  { libelle:'Gaz cuisine',                montant:8500,   categorie:'Énergie',   date:new Date().toISOString().split('T')[0] },
  { libelle:'Salaires staff',             montant:120000, categorie:'Personnel', date:new Date().toISOString().split('T')[0] },
]

const TABLES_DATA = [
  ...Array.from({length:8}, (_,i) => ({ numero:i+1,  zone:'salle',    capacite:4 })),
  ...Array.from({length:4}, (_,i) => ({ numero:i+9,  zone:'terrasse', capacite:2 })),
  { numero:13, zone:'vip', capacite:8 },
  { numero:14, zone:'vip', capacite:6 },
]

const FOURNISSEURS_DATA = [
  { nom:'Marché Mokolo',     tel:'+237 677 100 001', categorie:'Légumes',   note:'Ouvert lun-sam 6h-18h'       },
  { nom:'Ferme Mbankomo',    tel:'+237 699 200 002', categorie:'Protéines', note:'Poulets et poissons frais'   },
  { nom:'Grossiste Huiles',  tel:'+237 655 300 003', categorie:'Huiles',    note:'Livraison chaque lundi'      },
  { nom:'Boissons Continent',tel:'+237 677 400 004', categorie:'Boissons',  note:'Eau, sodas, jus'             },
]

const LIVREURS_DATA = [
  { nom:'Jean-Paul Mfou', tel:'+237 677 500 001', zones:['Bastos','Nlongkak','Tsinga']         },
  { nom:'Eric Nkolo',     tel:'+237 699 500 002', zones:['Centre-ville','Melen','Omnisport']   },
  { nom:'Boris Ateba',    tel:'+237 655 500 003', zones:['Ngousso','Nkol-Eton','Messa']        },
]

// ── Fonction principale — TOUT dans async main(), zéro top-level await ────────
async function main() {
  console.log('🌱 Seeding database Chez Maman Biya...')

  // ── Menu ────────────────────────────────────────────────────────────────────
  await prisma.menuItem.deleteMany()
  for (const plat of MENU) {
    await prisma.menuItem.create({ data: plat })
  }
  console.log(`✅ ${MENU.length} plats insérés`)

  // ── Stocks ───────────────────────────────────────────────────────────────────
  await prisma.stockItem.deleteMany()
  for (const item of STOCKS) {
    await prisma.stockItem.create({ data: item })
  }
  console.log(`✅ ${STOCKS.length} articles stock insérés`)

  // ── Dépenses initiales ───────────────────────────────────────────────────────
  await prisma.depense.deleteMany()
  for (const dep of DEPENSES) {
    await prisma.depense.create({ data: dep })
  }
  console.log(`✅ ${DEPENSES.length} dépenses initiales insérées`)

  // ── Tables restaurant ─────────────────────────────────────────────────────────
  try {
    await prisma.table.deleteMany()
    for (const t of TABLES_DATA) {
      await prisma.table.create({ data: t })
    }
    console.log(`✅ ${TABLES_DATA.length} tables créées`)
  } catch {
    console.warn('⚠️  Tables: modèle non trouvé dans le schéma, ignoré.')
  }

  // ── Fournisseurs ──────────────────────────────────────────────────────────────
  try {
    await prisma.fournisseur.deleteMany()
    for (const f of FOURNISSEURS_DATA) {
      await prisma.fournisseur.create({ data: f })
    }
    console.log(`✅ ${FOURNISSEURS_DATA.length} fournisseurs créés`)
  } catch {
    console.warn('⚠️  Fournisseurs: modèle non trouvé dans le schéma, ignoré.')
  }

  // ── Livreurs ───────────────────────────────────────────────────────────────────
  try {
    await prisma.livreur.deleteMany()
    for (const l of LIVREURS_DATA) {
      await prisma.livreur.create({ data: l })
    }
    console.log(`✅ ${LIVREURS_DATA.length} livreurs créés`)
  } catch {
    console.warn('⚠️  Livreurs: modèle non trouvé dans le schéma, ignoré.')
  }

  // ── Compte super_admin ────────────────────────────────────────────────────────
  // ⚠️  CHANGER CE MOT DE PASSE IMMÉDIATEMENT APRÈS LA PREMIÈRE CONNEXION !
  const mdpHash = await hashPassword('Admin2026!')
  const adminExistant = await prisma.user.findFirst({ where: { role: 'super_admin' } })
  if (!adminExistant) {
    await prisma.user.create({
      data: { login:'admin', name:'Propriétaire', role:'super_admin', password:mdpHash, actif:true },
    })
    console.log('✅ Compte super_admin créé — login: admin / mdp: Admin2026!')
    console.log('⚠️  CHANGEZ CE MOT DE PASSE IMMÉDIATEMENT APRÈS LA PREMIÈRE CONNEXION !')
  } else {
    console.log('ℹ️  super_admin déjà présent — pas de doublon créé')
  }

  console.log('🎉 Seed terminé avec succès !')
  console.log('')
  console.log('📸 Photos de plats : toutes les images sont null (emoji en fallback).')
  console.log('   → Ajoutez les URLs Cloudinary dans IMG{} ci-dessus, puis relancez npm run db:seed')
  console.log('   → Ou via Admin → Menu → ✏️ Modifier → champ "URL Photo"')
}

// ── Point d'entrée — main() appelée normalement, pas de top-level await ───────
main()
  .catch(e => { console.error('❌ Seed échoué :', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
