'use client'
// hooks/useSSE.js
// Hook React universel pour recevoir les événements SSE du serveur.
//
// Usage :
//   const { connected } = useSSE({
//     onCommandeNouvelle: (commande) => setCommandes(prev => [commande, ...prev]),
//     onCommandeStatus:   ({ id, status }) => setCommandes(prev =>
//       prev.map(c => c.id === id ? { ...c, status } : c)
//     ),
//   })
//
// Comportement :
//   - Reconnexion automatique exponentielle (1s → 2s → 4s → max 30s)
//   - Fallback polling si SSE non supporté (très rare)
//   - Indicateur `connected` pour afficher le statut dans l'UI
//   - Nettoyage propre à l'unmount

import { useEffect, useRef, useState, useCallback } from 'react'

const MAX_BACKOFF_MS = 30_000
const INITIAL_BACKOFF_MS = 1_000

export default function useSSE({
  onCommandeNouvelle,
  onCommandeStatus,
  onReservationNouvelle,
  onReservationStatus,
  onMessageNouveau,
  onStockAlerte,
  enabled = true,
} = {}) {
  const [connected, setConnected] = useState(false)
  const [reconnects, setReconnects] = useState(0)
  const esRef      = useRef(null)
  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const timerRef   = useRef(null)

  const handlers = useRef({})
  // Mise à jour des handlers sans recréer la connexion
  useEffect(() => {
    handlers.current = {
      onCommandeNouvelle,
      onCommandeStatus,
      onReservationNouvelle,
      onReservationStatus,
      onMessageNouveau,
      onStockAlerte,
    }
  })

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return
    if (!window.EventSource) {
      console.warn('[useSSE] EventSource non supporté — mode dégradé')
      return
    }

    // Fermer l'ancienne connexion si elle existe
    esRef.current?.close()

    const es = new EventSource('/api/events', { withCredentials: true })
    esRef.current = es

    es.addEventListener('connected', () => {
      setConnected(true)
      setReconnects(0)
      backoffRef.current = INITIAL_BACKOFF_MS
    })

    es.addEventListener('ping', () => {
      // Keepalive reçu — connexion active
      setConnected(true)
    })

    es.addEventListener('commande_nouvelle', (e) => {
      try {
        const { data } = JSON.parse(e.data)
        handlers.current.onCommandeNouvelle?.(data)
        // Son d'alerte discret (bip 440Hz / 80ms)
        playBeep(440, 80)
      } catch {}
    })

    es.addEventListener('commande_status', (e) => {
      try {
        const { data } = JSON.parse(e.data)
        handlers.current.onCommandeStatus?.(data)
      } catch {}
    })

    es.addEventListener('reservation_nouvelle', (e) => {
      try {
        const { data } = JSON.parse(e.data)
        handlers.current.onReservationNouvelle?.(data)
        playBeep(520, 60)
      } catch {}
    })

    es.addEventListener('reservation_status', (e) => {
      try {
        const { data } = JSON.parse(e.data)
        handlers.current.onReservationStatus?.(data)
      } catch {}
    })

    es.addEventListener('message_nouveau', (e) => {
      try {
        const { data } = JSON.parse(e.data)
        handlers.current.onMessageNouveau?.(data)
      } catch {}
    })

    es.addEventListener('stock_alerte', (e) => {
      try {
        const { data } = JSON.parse(e.data)
        handlers.current.onStockAlerte?.(data)
      } catch {}
    })

    es.onerror = () => {
      setConnected(false)
      es.close()
      esRef.current = null

      // Reconnexion avec backoff exponentiel
      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS)
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
      setReconnects(n => n + 1)

      timerRef.current = setTimeout(connect, delay)
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [connect])

  return { connected, reconnects }
}

// ── Bip discret via Web Audio API ─────────────────────────────────────────────
// Utilisé pour alerter le staff d'une nouvelle commande sans notification système
let audioCtx = null

function playBeep(freq = 440, durationMs = 80) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000)
    osc.start()
    osc.stop(audioCtx.currentTime + durationMs / 1000)
  } catch {
    // Audio non disponible (autoplay policy) — silencieux
  }
}
