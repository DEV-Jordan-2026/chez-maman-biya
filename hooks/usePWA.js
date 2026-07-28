'use client'
// hooks/usePWA.js
// Enregistrement du Service Worker + détection mode installé
// Utilisé exclusivement par la route /cuisine

import { useEffect, useState } from 'react'

export default function usePWA() {
  const [swReady,     setSwReady]     = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall,  setCanInstall]  = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Détecte si l'app tourne en mode standalone (installée)
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mq.matches || window.navigator.standalone === true)
    const handler = (e) => setIsInstalled(e.matches)
    mq.addEventListener('change', handler)

    // Capture l'événement d'installation
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Enregistre le Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/cuisine/sw.js', { scope: '/cuisine/' })
        .then((reg) => {
          setSwReady(true)
          // Vérification des mises à jour toutes les heures
          setInterval(() => reg.update(), 60 * 60 * 1000)
        })
        .catch((err) => console.error('[PWA] SW registration failed:', err))
    }

    // Verrouiller l'écran en mode paysage si API disponible (tablettes)
    if (screen.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {})
    }

    // Empêcher la mise en veille (Wake Lock API)
    let wakeLock = null
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }
    requestWakeLock()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    })

    return () => {
      mq.removeEventListener('change', handler)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      wakeLock?.release()
    }
  }, [])

  async function installPWA() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setCanInstall(false)
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  return { swReady, isInstalled, canInstall, installPWA }
}
