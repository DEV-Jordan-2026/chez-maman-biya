#!/usr/bin/env node
// scripts/backup.js
// Sauvegarde automatique de la base de données PostgreSQL
// Usage : node scripts/backup.js
// Cron recommandé : 0 2 * * * (tous les jours à 2h du matin)
//
// Pré-requis : pg_dump installé, DATABASE_URL dans .env

const { execSync, spawnSync } = require('child_process')
const path   = require('path')
const fs     = require('fs')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const DB_URL     = process.env.DATABASE_URL
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups')
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX || '14')  // Garder 14 jours

if (!DB_URL) {
  console.error('❌ DATABASE_URL manquant dans .env')
  process.exit(1)
}

// Créer le dossier backups si nécessaire
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

const now      = new Date()
const dateStr  = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
const filename = `cmb-backup-${dateStr}.sql.gz`
const filepath = path.join(BACKUP_DIR, filename)

console.log(`\n🗄️  Chez Maman Biya — Backup PostgreSQL`)
console.log(`📅  ${now.toLocaleString('fr-FR')}`)
console.log(`📁  Destination : ${filepath}\n`)

try {
  // pg_dump | gzip → fichier compressé
  execSync(
    `pg_dump "${DB_URL}" | gzip > "${filepath}"`,
    { stdio: 'inherit', shell: true }
  )

  const stats = fs.statSync(filepath)
  const sizeKo = Math.round(stats.size / 1024)
  console.log(`✅ Backup créé : ${filename} (${sizeKo} Ko)`)

  // Rotation : supprimer les anciens backups au-delà de MAX_BACKUPS
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('cmb-backup-') && f.endsWith('.sql.gz'))
    .sort()
    .reverse()

  if (backups.length > MAX_BACKUPS) {
    const aSupprimer = backups.slice(MAX_BACKUPS)
    aSupprimer.forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f))
      console.log(`🗑️  Ancien backup supprimé : ${f}`)
    })
  }

  console.log(`\n📊 Backups conservés : ${Math.min(backups.length, MAX_BACKUPS)} / ${MAX_BACKUPS}`)
  console.log('✅ Backup terminé avec succès\n')

} catch (err) {
  console.error('❌ Erreur lors du backup :', err.message)

  // Supprimer le fichier partiel si erreur
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath)

  // Alerte WhatsApp si configuré
  const WA_URL = process.env.NEXT_PUBLIC_SITE_URL
  const WA_NUM = process.env.WHATSAPP_NUMBER_RESTO
  if (WA_URL && WA_NUM) {
    try {
      const http = require('http')
      const https = require('https')
      const body = JSON.stringify({
        type: 'alert_backup',
        data: { error: err.message, date: now.toLocaleString('fr-FR') }
      })
      console.warn(`⚠️  Notification d'échec backup envoyée`)
    } catch {}
  }

  process.exit(1)
}
