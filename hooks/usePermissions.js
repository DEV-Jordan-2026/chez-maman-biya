// hooks/usePermissions.js — v14
// Hook léger pour charger les permissions effectives de la session courante.
// Combine flags natifs du rôle + permissions granulaires affectées manuellement.
//
// Usage :
//   const { can, loading } = usePermissions()
//   if (can('receptionner_marchandises')) { ... }

import { useState, useEffect } from 'react'

export default function usePermissions() {
  const [permissions, setPermissions] = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/me/permissions', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { permissions: [] })
      .then(d => setPermissions(Array.isArray(d.permissions) ? d.permissions : []))
      .catch(() => setPermissions([]))
      .finally(() => setLoading(false))
  }, [])

  function can(code) {
    return permissions.includes(code)
  }

  return { can, permissions, loading }
}
