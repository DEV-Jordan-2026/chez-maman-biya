// public/cuisine/sw.js
// Service Worker — PWA Cuisine Chez Maman Biya
//
// Stratégies :
//   - Shell app (HTML/JS/CSS)  → Cache First (mise à jour en arrière-plan)
//   - /api/commandes           → Network First, fallback cache 30s
//   - Assets statiques         → Cache First (stale-while-revalidate)
//   - Tout le reste            → Network Only

const CACHE_VERSION = 'cmb-cuisine-v1'
const SHELL_CACHE   = `${CACHE_VERSION}-shell`
const DATA_CACHE    = `${CACHE_VERSION}-data`

// Fichiers du shell applicatif à mettre en cache à l'installation
const SHELL_URLS = [
  '/cuisine',
  '/cuisine/offline',
]

// ── Installation : précache du shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  )
})

// ── Activation : nettoyage des anciens caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('cmb-cuisine-') && k !== SHELL_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch : stratégies par type de requête ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // SSE : toujours réseau (ne pas cacher un flux)
  if (url.pathname === '/api/events') return

  // API commandes : Network First, fallback cache 30s
  if (url.pathname.startsWith('/api/commandes') || url.pathname.startsWith('/api/messages')) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE, 30_000))
    return
  }

  // Mutations API (POST/PATCH/DELETE) : toujours réseau
  if (request.method !== 'GET') return

  // Page cuisine : Cache First + revalidation en arrière-plan
  if (url.pathname.startsWith('/cuisine')) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE))
    return
  }

  // Assets statiques (_next/static) : Cache First longue durée
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }
})

// ── Background Sync : renvoi des mutations en attente ─────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-status-updates') {
    event.waitUntil(replayPendingUpdates())
  }
})

// ── Push notifications (si activées) ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nouvelle commande 🍽️', {
      body:    data.body   || '',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [200, 100, 200],
      tag:     'nouvelle-commande',
      renotify: true,
      data:    data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(wcs => {
      const cuisine = wcs.find(c => c.url.includes('/cuisine'))
      if (cuisine) return cuisine.focus()
      return clients.openWindow('/cuisine')
    })
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function networkFirstWithCache(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName)
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)

  try {
    const response = await fetch(request, { signal: timeoutController.signal })
    clearTimeout(timeoutId)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    clearTimeout(timeoutId)
    const cached = await cache.match(request)
    if (cached) return cached
    // Fallback : page offline si la commande n'est pas en cache
    return caches.match('/cuisine/offline') || new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache    = await caches.open(cacheName)
  const cached   = await cache.match(request)
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => null)

  return cached || fetchPromise || caches.match('/cuisine/offline')
}

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function replayPendingUpdates() {
  // Rejouer les PATCH de statut qui ont échoué hors-ligne
  // Stockés en IndexedDB par le client (voir hooks/useOfflineQueue.js)
  try {
    const db = await openDB()
    const tx = db.transaction('pending_updates', 'readwrite')
    const store = tx.objectStore('pending_updates')
    const all = await storeGetAll(store)
    for (const item of all) {
      try {
        const res = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body })
        if (res.ok) await storeDelete(store, item.id)
      } catch {}
    }
  } catch {}
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cmb-offline', 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore('pending_updates', { keyPath: 'id', autoIncrement: true })
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = () => reject(req.error)
  })
}

function storeGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function storeDelete(store, id) {
  return new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
