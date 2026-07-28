#!/usr/bin/env node
// scripts/restore.js
// Restaure un backup PostgreSQL
// Usage : node scripts/restore.js backups/cmb-backup-2025-01-15.sql.gz

const { execSync } = require('child_process')
const path = require('path')
const fs   = require('fs')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const DB_URL   = process.env.DATABASE_URL
const filepath = process.argv[2]

if (!DB_URL || !filepath) {
  console.error('Usage : node scripts/restore.js <chemin-du-backup.sql.gz>')
  process.exit(1)
}

if (!fs.existsSync(filepath)) {
  console.error(`❌ Fichier introuvable : ${filepath}`)
  process.exit(1)
}

const stats   = fs.statSync(filepath)
const sizeKo  = Math.round(stats.size / 1024)

console.log('\n⚠️  RESTAURATION DE LA BASE DE DONNÉES')
console.log(`📁  Fichier : ${filepath} (${sizeKo} Ko)`)
console.log('⚠️  Cette opération va écraser toutes les données actuelles !\n')

const readline = require('readline')
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('Tapez "CONFIRMER" pour continuer : ', answer => {
  rl.close()
  if (answer.trim() !== 'CONFIRMER') {
    console.log('❌ Restauration annulée')
    process.exit(0)
  }

  try {
    console.log('\n🔄 Restauration en cours…')
    execSync(`gunzip -c "${filepath}" | psql "${DB_URL}"`, { stdio: 'inherit', shell: true })
    console.log('✅ Restauration terminée avec succès')
  } catch (err) {
    console.error('❌ Erreur lors de la restauration :', err.message)
    process.exit(1)
  }
})
