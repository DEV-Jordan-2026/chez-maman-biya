'use client'
// components/OfflineBanner.js — Indicateur de connexion
// Crucial au Cameroun avec les coupures internet fréquentes

import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)

    // Vérifier l'état initial
    if (!navigator.onLine) setOffline(true)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return (
    <div
      className={`offline-banner ${offline ? 'show' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      📡 Pas de connexion internet — Certaines fonctionnalités sont indisponibles
    </div>
  )
}
