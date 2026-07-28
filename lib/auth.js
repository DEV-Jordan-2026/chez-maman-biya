// lib/auth.js — v17 Production-ready
// Auth CMB — Node.js Route Handlers uniquement
// ⚠️  NE PAS importer dans lib/auth-edge.js (Edge Runtime incompatible avec bcryptjs)

import bcrypt        from 'bcryptjs'  // KDF cost 12 — Node.js only, pas Edge Runtime
import { randomBytes } from 'crypto'

// ── Redis lazy-init pour la liste noire de tokens révoqués (S1) ──────────────
let _redis = null
async function getRedisForRevoke() {
  if (_redis) return _redis
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const { Redis } = await import('@upstash/redis')
    _redis = new Redis({ url, token })
    return _redis
  } catch { return null }
}

export const SESSION_COOKIE   = 'cmb_session'
export const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8h

// v26 — Session dédiée à l'app livreur (/livraison), distincte de la session staff
export const LIVREUR_SESSION_COOKIE   = 'cmb_livreur_session'
export const LIVREUR_SESSION_DURATION = 12 * 60 * 60 * 1000 // 12h (durée d'un service)

// ── Permissions par rôle ──────────────────────────────────────────────────────
export const ROLES_PERMISSIONS = {
  super_admin: {
    label: 'Propriétaire', emoji: '👑', color: 'var(--gold)',
    tabs: ['commandes','plan_salle','reservations','menu','facturation','caisse',
           'analytics','comptabilite','stocks','achats','livreurs',
           'messagerie','journal','parametres','equipe','restaurants'],
    canReadCommandes:           true,
    canWriteCommandes:          true,
    canManageMenu:              true,
    canManageEquipe:            true,
    canSeeFinances:             true,
    canManageParams:            true,
    canCreateDemandeAchat:      true,
    canValiderDemandeAchat:     true,
    canReceptionnerMarchandises: true,
    canManageRestaurants:       true,
    canSeeAllRestaurants:       true,
    canManageRH:                true,
  },
  manager: {
    label: 'Gérant', emoji: '🧑‍💼', color: '#8B5CF6',
    // Liste de référence documentaire — la source de vérité pour le rendu est TABS dans AdminClient.js
    // (flags superAdminOnly / managerAndUp). Mettre à jour les deux en cas d'ajout de tab.
    tabs: ['dashboard','commandes','plan_salle','reservations','menu','facturation','caisse',
           'stocks','achats','livreurs','rh','messagerie','equipe'],
    canReadCommandes:           true,
    canWriteCommandes:          true,
    canManageMenu:              false,
    canManageEquipe:            true,
    canSeeFinances:             false,
    canManageParams:            false,
    canCreateDemandeAchat:      true,
    canValiderDemandeAchat:     true,
    canReceptionnerMarchandises: true,
    canManageRestaurants:       false,
    canSeeAllRestaurants:       false,
    canManageRH:                true,
  },
  caissier: {
    label: 'Caissier', emoji: '💳', color: '#10b981',
    tabs: ['encaissement','factures'],
    canReadCommandes:           true,
    canWriteCommandes:          false,
    canManageMenu:              false,
    canManageEquipe:            false,
    canSeeFinances:             false,
    canManageParams:            false,
    canCreateDemandeAchat:      false,
    canValiderDemandeAchat:     false,
    canReceptionnerMarchandises: false,
    canManageRestaurants:       false,
    canSeeAllRestaurants:       false,
    canManageRH:                false,
  },
  staff: {
    label: 'Staff cuisine', emoji: '👨‍🍳', color: '#f59e0b',
    tabs: ['cuisine'],
    canReadCommandes:           true,
    canWriteCommandes:          true,
    canManageMenu:              false,
    canManageEquipe:            false,
    canSeeFinances:             false,
    canManageParams:            false,
    canCreateDemandeAchat:      false,
    canValiderDemandeAchat:     false,
    canReceptionnerMarchandises: false,
    canManageRestaurants:       false,
    canSeeAllRestaurants:       false,
    canManageRH:                false,
  },
  // ── NOUVEAUX RÔLES v13 ──────────────────────────────────────────
  serveur: {
    label: 'Serveur', emoji: '🍽️', color: '#06b6d4',
    tabs: ['commandes','reservations','plan_salle','messagerie'],
    canReadCommandes:           true,
    canWriteCommandes:          true,
    canManageMenu:              false,
    canManageEquipe:            false,
    canSeeFinances:             false,
    canManageParams:            false,
    canCreateDemandeAchat:      false,
    canValiderDemandeAchat:     false,
    canReceptionnerMarchandises: false,
    canManageRestaurants:       false,
    canSeeAllRestaurants:       false,
    canManageRH:                false,
  },
  magasinier: {
    label: 'Magasinier', emoji: '📦', color: '#84cc16',
    tabs: ['stocks','achats'],
    canReadCommandes:           false,
    canWriteCommandes:          false,
    canManageMenu:              false,
    canManageEquipe:            false,
    canSeeFinances:             false,
    canManageParams:            false,
    canCreateDemandeAchat:      true,
    canValiderDemandeAchat:     false,
    canReceptionnerMarchandises: true,
    canManageRestaurants:       false,
    canSeeAllRestaurants:       false,
    canManageRH:                false,
  },
}

// ── Catalogue de permissions granulaires ───────────────────────────────────────
export const PERMISSIONS_CATALOGUE = [
  // Opérations
  { code: 'voir_commandes',     label: 'Voir les commandes',      groupe: 'Opérations' },
  { code: 'modifier_commandes', label: 'Modifier les commandes',  groupe: 'Opérations' },
  { code: 'annuler_commandes',  label: 'Annuler les commandes',   groupe: 'Opérations' },
  { code: 'voir_plan_salle',    label: 'Voir le plan de salle',   groupe: 'Opérations' },
  { code: 'modifier_menu',      label: 'Modifier le menu',        groupe: 'Opérations' },
  // Finance
  { code: 'voir_comptabilite',  label: 'Voir la comptabilité',    groupe: 'Finance' },
  { code: 'voir_analytics',     label: 'Voir les analytics',      groupe: 'Finance' },
  { code: 'ouvrir_caisse',      label: 'Ouvrir/fermer la caisse', groupe: 'Finance' },
  { code: 'voir_depenses',      label: 'Voir les dépenses',       groupe: 'Finance' },
  // Achats
  { code: 'creer_demande_achat',  label: 'Créer des demandes d\'achat',   groupe: 'Achats' },
  { code: 'valider_demande_achat',label: 'Valider des demandes d\'achat', groupe: 'Achats' },
  { code: 'gerer_fournisseurs',   label: 'Gérer les fournisseurs',        groupe: 'Achats' },
  { code: 'receptionner_marchandises', label: 'Réceptionner les marchandises', groupe: 'Achats' },
  // RH
  { code: 'voir_equipe',        label: 'Voir l\'équipe',           groupe: 'RH' },
  { code: 'gerer_equipe',       label: 'Gérer l\'équipe',          groupe: 'RH' },
  { code: 'gerer_pointages',    label: 'Gérer les pointages',      groupe: 'RH' },
  { code: 'gerer_primes',       label: 'Attribuer des primes',     groupe: 'RH' },
  // Stocks
  { code: 'voir_stocks',        label: 'Voir les stocks',          groupe: 'Stocks' },
  { code: 'modifier_stocks',    label: 'Modifier les stocks',      groupe: 'Stocks' },
]

export function getRoleInfo(role) {
  return ROLES_PERMISSIONS[role] || ROLES_PERMISSIONS.staff
}

export function canAccess(role, tab) {
  return ROLES_PERMISSIONS[role]?.tabs?.includes(tab) ?? false
}

export function isAdmin(role) {
  return ['super_admin', 'manager'].includes(role)
}

export function isSuperAdmin(role) {
  return role === 'super_admin'
}

// ── Clé secrète ───────────────────────────────────────────────────────────────
function getSecret() {
  const s = process.env.AUTH_SECRET
  if (!s || s.startsWith('changez-moi')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[AUTH] AUTH_SECRET doit être défini en production (openssl rand -hex 32)')
    }
  }
  return s || 'dev-secret-changez-moi-en-prod-32c'
}

// ── Clé interne API ───────────────────────────────────────────────────────────
export function getInternalKey() {
  const key = process.env.INTERNAL_API_KEY
  // A3 — Alerter explicitement si la clé est absente en production.
  // Contrairement à AUTH_SECRET, l'absence n'est pas bloquante (les routes internes
  // vérifient la clé mais ne sont pas exposées publiquement), mais elle ouvre une
  // surface d'attaque si la valeur par défaut est connue.
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[AUTH] INTERNAL_API_KEY non défini en production — utilisation de la valeur par défaut. ' +
        'Définissez INTERNAL_API_KEY=<openssl rand -hex 32> dans vos variables d\'environnement.')
    }
    return 'dev-internal-key'
  }
  return key
}

export function verifyInternalKey(request) {
  const key = request.headers.get('x-internal-key')
  return key === getInternalKey()
}

// ── Crypto helpers (Web Crypto — signature tokens uniquement) ─────────────────
async function hmacSign(data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Hachage legacy HMAC-SHA256 (migration uniquement) ─────────────────────────
// Ne pas utiliser pour de nouveaux mots de passe — bcrypt uniquement.
// Exporté pour que verifyPassword puisse comparer les anciens hashes en base.
export async function _legacyHmacHash(password) {
  return hmacSign(password)
}

// ── Hachage de mot de passe bcrypt (production) ───────────────────────────────
/**
 * Hash un mot de passe avec bcrypt cost 12.
 * Utilisé par le script create-admin.js.
 * @param {string} password
 * @returns {Promise<string>}  hash bcrypt commençant par $2b$
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

// ── Vérification de mot de passe avec migration progressive HMAC → bcrypt ──────
/**
 * Vérifie un mot de passe contre son hash stocké en base.
 * Supporte les deux formats :
 *   - Bcrypt ($2b$ / $2a$) : comparaison directe
 *   - HMAC-SHA256 legacy   : vérification HMAC + re-hash bcrypt automatique (silencieux)
 *
 * @param {string}      pwd         - Mot de passe en clair saisi par l'utilisateur
 * @param {string}      storedHash  - Hash stocké en base (bcrypt ou HMAC legacy)
 * @param {string|null} userId      - ID de l'utilisateur (pour la migration en base)
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(pwd, storedHash, userId) {
  // ── Format bcrypt (nouveau) ──────────────────────────────────────────────────
  if (storedHash?.startsWith('$2b$') || storedHash?.startsWith('$2a$')) {
    return bcrypt.compare(pwd, storedHash)
  }

  // ── Format HMAC-SHA256 legacy ────────────────────────────────────────────────
  const legacyHash = await _legacyHmacHash(pwd)
  const hmacMatch  = await _timingSafeEqual(legacyHash, storedHash)

  if (hmacMatch && userId) {
    // Migration silencieuse : re-hasher en bcrypt sans bloquer la connexion
    bcrypt.hash(pwd, 12)
      .then(newHash =>
        import('@/lib/db').then(({ default: prisma }) =>
          prisma.user.update({ where: { id: userId }, data: { password: newHash } })
            .catch(err => console.warn('[AUTH] Migration bcrypt échouée:', err.message))
        )
      )
      .catch(err => console.warn('[AUTH] Re-hash bcrypt échoué:', err.message))
  }

  return hmacMatch
}

// Comparaison timing-safe via HMAC des deux chaînes (évite les attaques temporelles)
async function _timingSafeEqual(a, b) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const s1  = await crypto.subtle.sign('HMAC', key, enc.encode(a))
  const s2  = await crypto.subtle.sign('HMAC', key, enc.encode(b))
  const b1  = new Uint8Array(s1)
  const b2  = new Uint8Array(s2)
  let equal = b1.length === b2.length
  for (let i = 0; i < b1.length; i++) {
    if (b1[i] !== b2[i]) equal = false
  }
  return equal
}

// Kept for backward-compat (token verification uses this internally)
async function compareHashes(h1, h2) {
  return _timingSafeEqual(h1, h2)
}

const WEAK_DEFAULTS = new Set(['admin123', 'manager123', 'caissier123', 'staff123'])

function checkPasswordStrength(envVarName, password) {
  if (process.env.NODE_ENV === 'production' && WEAK_DEFAULTS.has(password)) {
    throw new Error(
      `[AUTH] Mot de passe faible détecté pour ${envVarName} en production. ` +
      `Définissez une vraie valeur dans vos variables d'environnement.`
    )
  }
}

function getEnvUsers() {
  const adminPwd    = process.env.ADMIN_PASSWORD    || 'admin123'
  const managerPwd  = process.env.MANAGER_PASSWORD  || 'manager123'
  const caissierPwd = process.env.CAISSIER_PASSWORD || 'caissier123'
  const staffPwd    = process.env.STAFF_PASSWORD    || 'staff123'

  checkPasswordStrength('ADMIN_PASSWORD',    adminPwd)
  checkPasswordStrength('MANAGER_PASSWORD',  managerPwd)
  checkPasswordStrength('CAISSIER_PASSWORD', caissierPwd)
  checkPasswordStrength('STAFF_PASSWORD',    staffPwd)

  return {
    [process.env.ADMIN_LOGIN    || 'admin']:    { password: adminPwd,    role: 'super_admin', name: process.env.ADMIN_NAME    || 'Maman Biya' },
    [process.env.MANAGER_LOGIN  || 'manager']:  { password: managerPwd,  role: 'manager',     name: process.env.MANAGER_NAME  || 'Le Gérant' },
    [process.env.CAISSIER_LOGIN || 'caissier']: { password: caissierPwd, role: 'caissier',    name: process.env.CAISSIER_NAME || 'Le Caissier' },
    [process.env.STAFF_LOGIN    || 'staff']:    { password: staffPwd,    role: 'staff',        name: process.env.STAFF_NAME    || 'Staff Cuisine' },
  }
}

// ── Token ─────────────────────────────────────────────────────────────────────
export async function createToken(payload) {
  // S1 — jti (JWT ID) unique par token — permet la révocation ciblée sans schema BD
  const jti  = randomBytes(16).toString('hex')
  const data = btoa(JSON.stringify({ ...payload, jti }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const sig = await hmacSign(data)
  return `${data}.${sig}`
}

export async function verifyToken(token) {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null

  const data = token.slice(0, dot)
  const sig  = token.slice(dot + 1)
  const expected = await hmacSign(data)

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const s1 = await crypto.subtle.sign('HMAC', key, enc.encode(expected))
  const s2 = await crypto.subtle.sign('HMAC', key, enc.encode(sig))
  const b1 = new Uint8Array(s1)
  const b2 = new Uint8Array(s2)
  let match = b1.length === b2.length
  for (let i = 0; i < b1.length; i++) { if (b1[i] !== b2[i]) match = false }
  if (!match) return null

  try {
    const padded  = data.replace(/-/g, '+').replace(/_/g, '/')
      + '='.repeat((4 - data.length % 4) % 4)
    const payload = JSON.parse(atob(padded))
    if (payload.exp && Date.now() > payload.exp) return null

    // S1 — Vérifier si le jti est dans la liste noire (token révoqué par logout)
    if (payload.jti) {
      try {
        const redis = await getRedisForRevoke()
        if (redis) {
          const revoked = await redis.get(`cmb:revoked:${payload.jti}`)
          if (revoked) return null  // Token révoqué explicitement
        }
      } catch { /* Redis indisponible — on accepte le token (dégradé gracieux) */ }
    }

    return payload
  } catch {
    return null
  }
}

export async function verifyCredentials(login, password) {
  try {
    const { default: prisma } = await import('@/lib/db')
    const userBD = await prisma.user.findUnique({
      where:  { login },
      // id inclus pour la migration progressive HMAC → bcrypt dans verifyPassword
      select: { id: true, login: true, password: true, role: true, name: true, actif: true, restaurantId: true },
    })
    if (userBD) {
      if (!userBD.actif) {
        await new Promise(r => setTimeout(r, 50 + Math.random() * 50))
        return null
      }
      const ok = await verifyPassword(password, userBD.password, userBD.id)
      if (!ok) {
        await new Promise(r => setTimeout(r, 50 + Math.random() * 50))
        return null
      }
      return { login: userBD.login, userId: userBD.id, role: userBD.role, name: userBD.name, restaurantId: userBD.restaurantId, source: 'db' }
    }
  } catch (dbErr) {
    // En production : logger l'indisponibilité BD en ERROR (monitored par Vercel/Sentry)
    if (process.env.NODE_ENV === 'production') {
      console.error('[AUTH] ⚠️  BD indisponible en production — activation du fallback .env:', dbErr.message)
      console.error('[AUTH] Vérifier la connectivité Supabase et les variables DATABASE_URL / DIRECT_URL.')
    } else {
      console.warn('[AUTH] BD indisponible, fallback .env:', dbErr.message)
    }
  }

  // Fallback .env : DÉSACTIVÉ par défaut en production.
  // FIX #2 — Opt-in explicite requis via ENABLE_ENV_FALLBACK=true
  //   N'activer qu'en urgence opérationnelle (BD inaccessible).
  //   Désactiver dès que la BD est restaurée.
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ENABLE_ENV_FALLBACK !== 'true') {
      console.error('[AUTH] Fallback .env bloqué — ENABLE_ENV_FALLBACK non activé. Accès refusé.')
      return null
    }
    console.error(`[AUTH] ⚠️  URGENCE — Fallback .env actif pour "${login}". Désactiver ENABLE_ENV_FALLBACK dès que la BD est restaurée.`)
  }

  const envUsers = getEnvUsers()
  const envUser  = envUsers[login]
  if (!envUser) {
    await new Promise(r => setTimeout(r, 50 + Math.random() * 50))
    return null
  }

  // Utilisateurs .env : mots de passe en clair → comparaison HMAC des deux côtés
  // (timing-safe : on ne compare jamais les chaînes directement)
  const legacyHash = await _legacyHmacHash(password)
  const envHash    = await _legacyHmacHash(envUser.password)
  const ok         = await compareHashes(legacyHash, envHash)

  if (!ok) return null
  return { login, role: envUser.role, name: envUser.name, restaurantId: null, source: 'env' }
}

export async function requireAuth(cookieStore) {
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return verifyToken(token)
}

export async function requireAdmin(cookieStore) {
  const session = await requireAuth(cookieStore)
  if (!session) return null
  if (!isAdmin(session.role)) return null
  return session
}

// v26 — Session livreur (app /livraison), cookie et rôle dédiés
export async function requireLivreur(cookieStore) {
  const token = cookieStore.get(LIVREUR_SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || session.role !== 'livreur') return null
  return session
}

// ── Vérification permission granulaire ───────────────────────────────────────
// Retourne true si :
//   1. le rôle de base inclut la capacité (super_admin, manager, magasinier…)
//   2. OU l'employé possède explicitement la permission en base (UserPermission)
// Permet d'affecter une permission à n'importe quel rôle sans le changer.
export async function hasPermission(session, permissionCode) {
  if (!session) return false

  // super_admin a toujours tout
  if (session.role === 'super_admin') return true

  // 1 — flag booléen natif du rôle
  const rolePerms = ROLES_PERMISSIONS[session.role]
  const FLAG_MAP = {
    receptionner_marchandises: 'canReceptionnerMarchandises',
    creer_demande_achat:       'canCreateDemandeAchat',
    valider_demande_achat:     'canValiderDemandeAchat',
    voir_analytics:            'canSeeFinances',
    voir_comptabilite:         'canSeeFinances',
    modifier_menu:             'canManageMenu',
    gerer_equipe:              'canManageEquipe',
  }
  const flag = FLAG_MAP[permissionCode]
  if (flag && rolePerms?.[flag]) return true

  // 2 — permission granulaire affectée manuellement en base
  if (!session.userId) return false
  try {
    const { default: prisma } = await import('@/lib/db')
    const perm = await prisma.userPermission.findFirst({
      where: {
        userId:     session.userId,
        permission: { code: permissionCode },
      },
    })
    return !!perm
  } catch {
    return false
  }
}

