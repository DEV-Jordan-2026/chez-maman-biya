'use client'
// hooks/useRestaurantConfig.js — Branding hook · CMB v16
// Priorité : DB (API) → localStorage (cache) → DEFAULT_CONFIG

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_CONFIG, CONFIG_KEY, COLOR_CSS_MAP } from '@/config/restaurant.config'

function applyColors(couleurs) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  Object.entries(COLOR_CSS_MAP).forEach(([key, cssVar]) => {
    if (couleurs[key]) root.style.setProperty(cssVar, couleurs[key])
  })
}

export function useRestaurantConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loaded, setLoaded] = useState(false)

  // Chargement initial : DB en priorité, localStorage en fallback
  useEffect(() => {
    async function load() {
      try {
        // 1. Essayer l'API (config persistée en DB par restaurant)
        const res = await fetch('/api/parametres/branding')
        if (res.ok) {
          const { parametres } = await res.json()
          if (parametres) {
            const merged = {
              ...DEFAULT_CONFIG, ...parametres,
              couleurs: { ...DEFAULT_CONFIG.couleurs, ...parametres.couleurs },
            }
            setConfig(merged)
            applyColors(merged.couleurs)
            localStorage.setItem(CONFIG_KEY, JSON.stringify(merged)) // cache local
            setLoaded(true)
            return
          }
        }
      } catch { /* API indisponible — fallback localStorage */ }

      // 2. Fallback localStorage
      try {
        const raw = localStorage.getItem(CONFIG_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          const merged = {
            ...DEFAULT_CONFIG, ...parsed,
            couleurs: { ...DEFAULT_CONFIG.couleurs, ...parsed.couleurs },
          }
          setConfig(merged)
          applyColors(merged.couleurs)
        }
      } catch { /* localStorage indisponible */ }

      setLoaded(true)
    }
    load()
  }, [])

  // Écouter les changements depuis d'autres composants
  useEffect(() => {
    const handler = (e) => { setConfig(e.detail); applyColors(e.detail.couleurs) }
    window.addEventListener('cmb-config-change', handler)
    return () => window.removeEventListener('cmb-config-change', handler)
  }, [])

  const saveConfig = useCallback(async (newConfig) => {
    const merged = {
      ...DEFAULT_CONFIG, ...newConfig,
      couleurs: { ...DEFAULT_CONFIG.couleurs, ...newConfig.couleurs },
    }
    // Sauvegarder en DB ET en localStorage
    try {
      await fetch('/api/parametres/branding', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(merged),
      })
    } catch { /* non bloquant */ }

    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged))
    setConfig(merged)
    applyColors(merged.couleurs)
    window.dispatchEvent(new CustomEvent('cmb-config-change', { detail: merged }))
  }, [])

  const resetConfig = useCallback(async () => {
    try {
      await fetch('/api/parametres/branding', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(DEFAULT_CONFIG),
      })
    } catch { /* non bloquant */ }

    localStorage.removeItem(CONFIG_KEY)
    setConfig(DEFAULT_CONFIG)
    applyColors(DEFAULT_CONFIG.couleurs)
    window.dispatchEvent(new CustomEvent('cmb-config-change', { detail: DEFAULT_CONFIG }))
  }, [])

  return { config, saveConfig, resetConfig, loaded }
}
