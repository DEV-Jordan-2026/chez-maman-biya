'use client'
// components/Toast.js — système de notifications global v11
// Usage: import { useToast } from '@/components/Toast'
//        const toast = useToast()
//        toast.success('Commande mise à jour !')
//        toast.error('Erreur de connexion')
//        toast.info('Synchronisation en cours…')
//        toast.warning('Stock faible : Ndolé')

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastCtx = createContext(null)

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    '●',
  warning: '⚠',
}

let _toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((type, message, duration = 3500) => {
    const id = ++_toastId
    setToasts(t => [...t, { id, type, message, leaving: false }])
    setTimeout(() => {
      // Marquer comme "leaving" pour l'animation de sortie
      setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x))
      setTimeout(() => {
        setToasts(t => t.filter(x => x.id !== id))
      }, 260)
    }, duration)
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 260)
  }, [])

  const api = {
    success: (msg, dur) => add('success', msg, dur),
    error:   (msg, dur) => add('error',   msg, dur),
    info:    (msg, dur) => add('info',    msg, dur),
    warning: (msg, dur) => add('warning', msg, dur),
    dismiss,
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast ${t.type} ${t.leaving ? 'toast-out' : 'toast-in'}`}
            role="alert"
            onClick={() => dismiss(t.id)}
            style={{ cursor: 'pointer' }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 900,
              background: t.type === 'success' ? 'rgba(16,185,129,.25)'
                        : t.type === 'error'   ? 'rgba(239,68,68,.25)'
                        : t.type === 'warning' ? 'rgba(245,158,11,.2)'
                        : 'rgba(201,151,60,.2)',
            }}>
              {ICONS[t.type]}
            </span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast doit être dans <ToastProvider>')
  return ctx
}
