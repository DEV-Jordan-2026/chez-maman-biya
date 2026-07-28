'use client'

import { useEffect, useRef, useState } from 'react'

export default function NotifAlert({ commandes }) {
  const prevIds     = useRef(new Set())
  const audioCtxRef = useRef(null)
  const [nouvelles, setNouvelles] = useState([])

  function playBeep() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      // Double bip rapide style caisse enregistreuse
      ;[0, 200].forEach(delay => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.4, ctx.currentTime + delay / 1000)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.15)
        osc.start(ctx.currentTime + delay / 1000)
        osc.stop(ctx.currentTime + delay / 1000 + 0.15)
      })
    } catch {}
  }

  useEffect(() => {
    if (!commandes || commandes.length === 0) return
    const currentIds = new Set(commandes.map(c => c.id))

    if (prevIds.current.size > 0) {
      const nouvelles = commandes.filter(c =>
        !prevIds.current.has(c.id) && c.status === 'nouveau'
      )
      if (nouvelles.length > 0) {
        playBeep()
        setNouvelles(nouvelles)
        setTimeout(() => setNouvelles([]), 8000)
        // Notification navigateur si permis
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          nouvelles.forEach(c => {
            new Notification(`🆕 Nouvelle commande — ${c.id}`, {
              body: `${c.client} · ${(c.total||0).toLocaleString('fr-FR')} FCFA`,
              icon: '/favicon.ico',
            })
          })
        }
      }
    }
    prevIds.current = currentIds
  }, [commandes])

  // Demander la permission au premier rendu
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (nouvelles.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 80, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {nouvelles.map(c => (
        <div key={c.id} style={{
          background: 'rgba(16,185,129,.95)', color: '#fff',
          borderRadius: 12, padding: '12px 18px', fontSize: 13,
          fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          animation: 'slideIn .3s ease',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🆕</span>
          <div>
            <div>{c.id}</div>
            <div style={{ fontWeight: 400, fontSize: 11, opacity: .85 }}>{c.client} · {(c.total||0).toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
      ))}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(40px) } to { opacity:1; transform:translateX(0) } }`}</style>
    </div>
  )
}
