#!/usr/bin/env node
// scripts/create-admin.js
// Crée ou réinitialise le compte super_admin
// Usage : node scripts/create-admin.js
//       : node scripts/create-admin.js --login monlogin --password MonMotDePasse
//
// À exécuter APRÈS prisma migrate deploy et AVANT npm run db:seed
// si le seed a déjà créé des données mais pas le compte admin.

import { PrismaClient } from '@prisma/client'
import { hashPassword }  from '../lib/auth.js'
import { createInterface } from 'readline'
import { argv }            from 'process'

const prisma = new PrismaClient()

// ── Lecture des arguments CLI ─────────────────────────────────────────────────
const args    = argv.slice(2)
const getArg  = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null }

let LOGIN    = getArg('--login')    || 'admin'
let PASSWORD = getArg('--password') || null

// ── Interactive si pas de mot de passe fourni ─────────────────────────────────
async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()) })
  })
}

async function main() {
  console.log('\n👑 Chez Maman Biya — Création / Réinitialisation Super Admin\n')

  if (!PASSWORD) {
    LOGIN    = await ask(`Login (défaut: ${LOGIN}) : `) || LOGIN
    PASSWORD = await ask('Mot de passe : ')
    if (!PASSWORD) {
      console.error('❌ Mot de passe obligatoire')
      process.exit(1)
    }
    const confirm = await ask('Confirmer le mot de passe : ')
    if (PASSWORD !== confirm) {
      console.error('❌ Les mots de passe ne correspondent pas')
      process.exit(1)
    }
  }

  if (PASSWORD.length < 8) {
    console.error('❌ Le mot de passe doit faire au moins 8 caractères')
    process.exit(1)
  }

  const hash = await hashPassword(PASSWORD)

  // Vérifier si un super_admin existe déjà
  const existant = await prisma.user.findFirst({ where: { login: LOGIN } })

  if (existant) {
    // Mettre à jour
    await prisma.user.update({
      where: { id: existant.id },
      data:  { password: hash, role: 'super_admin', actif: true },
    })
    console.log(`\n✅ Compte "${LOGIN}" mis à jour avec succès`)
    console.log('   Rôle : super_admin')
    console.log('   Statut : actif')
  } else {
    // Créer
    const nom = await ask('Nom complet (ex: Maman Biya) : ')
    await prisma.user.create({
      data: {
        login:    LOGIN,
        name:     nom || 'Propriétaire',
        role:     'super_admin',
        password: hash,
        actif:    true,
      },
    })
    console.log(`\n✅ Compte "${LOGIN}" créé avec succès`)
    console.log('   Rôle : super_admin')
    console.log('   URL  : /admin/login')
  }

  console.log('\n⚠️  Gardez ces informations en lieu sûr.')
  console.log('⚠️  Ne partagez ce mot de passe avec personne.\n')
}

main()
  .catch(e => { console.error('❌ Erreur :', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
