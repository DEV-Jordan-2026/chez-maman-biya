'use client'

import { useState } from 'react'

const RESA_STATUS = {
  en_attente: { label: 'En attente', color: 'var(--warning)', bg: 'rgba(245,158,11,.1)',  emoji: '⏳' },
  confirmee:  { label: 'Confirmée',  color: 'var(--success)', bg: 'rgba(16,185,129,.1)',  emoji: '✅' },
  annulee:    { label: 'Annulée',    color: 'var(--danger)', bg: 'rgba(239,68,68,.1)',   emoji: '❌' },
  arrivee:    { label: 'Arrivée',    color: '#8B5CF6', bg: 'rgba(139,92,246,.1)',  emoji: '🪑' },
}

export default function ReservationsPanel({ reservations, onUpdateStatus }) {
  const [filtre, setFiltre] = useState('toutes')
  const today = new Date().toLocaleDateString('fr-CA')  // YYYY-MM-DD local

  const filtered = reservations
    .filter(r => {
      if (filtre === 'en_attente')  return r.status === 'en_attente'
      if (filtre === 'aujourd_hui') return r.date === today
      if (filtre === 'confirmee')   return r.status === 'confirmee'
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure))

  const filtres = [
    { id: 'toutes',      label: 'Toutes',     count: reservations.length },
    { id: 'en_attente',  label: 'En attente', count: reservations.filter(r => r.status === 'en_attente').length },
    { id: 'aujourd_hui', label: "Aujourd'hui",count: reservations.filter(r => r.date === today).length },
    { id: 'confirmee',   label: 'Confirmées', count: reservations.filter(r => r.status === 'confirmee').length },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {filtres.map(f => (
          <button key={f.id} onClick={() => setFiltre(f.id)} style={{
            padding: '6px 14px', borderRadius: 20,
            border: `1px solid ${filtre === f.id ? '#8B5CF6' : 'rgba(139,92,246,.2)'}`,
            background: filtre === f.id ? 'rgba(139,92,246,.1)' : 'transparent',
            color: filtre === f.id ? '#8B5CF6' : 'var(--cream-faint)',
            fontSize: 12, cursor: 'pointer',
          }}>
            {f.label}
            {f.count > 0 && (
              <span style={{ marginLeft: 6, background: filtre === f.id ? '#8B5CF6' : 'var(--border-subtle)', color: filtre === f.id ? '#fff' : 'var(--cream-faint)', padding: '1px 7px', borderRadius: 10, fontSize: 11 }}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', opacity: .3, fontSize: 15 }}>
          📅 Aucune réservation dans cette catégorie
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(resa => {
            const s = RESA_STATUS[resa.status] || RESA_STATUS.en_attente
            return (
              <div key={resa.id} style={{
                background: 'var(--ebony-2)',
                border: '1px solid rgba(139,92,246,.1)',
                borderLeft: `4px solid ${s.color}`,
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 90, textAlign: 'center' }}>
                  {s.emoji} {s.label}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#8B5CF6', fontSize: 12 }}>{resa.id}</span>
                    {[`📅 ${resa.date} à ${resa.heure}`, `👥 ${resa.personnes} pers.`, resa.zone && `🪑 ${resa.zone}`]
                      .filter(Boolean).map(tag => (
                        <span key={tag} style={{ background: 'rgba(255,255,255,.05)', padding: '1px 8px', borderRadius: 4, fontSize: 11, opacity: .65 }}>
                          {tag}
                        </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>
                    <strong>{resa.nom}</strong>
                    {resa.tel && <span style={{ opacity: .35, fontSize: 12, marginLeft: 10 }}>{resa.tel}</span>}
                  </div>
                  {resa.notes && <div style={{ fontSize: 12, opacity: .4, fontStyle: 'italic' }}>💬 {resa.notes}</div>}
                  {/* Badge arrhes */}
                  {resa.arrhes > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {resa.arrhesPaie
                        ? <span style={{ color: 'var(--success)', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 4, padding: '1px 8px' }}>✅ Arrhes reçues {resa.arrhes?.toLocaleString('fr-FR')} FCFA</span>
                        : <span style={{ color: 'var(--warning)', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 4, padding: '1px 8px' }}>⏳ Arrhes en attente {resa.arrhes?.toLocaleString('fr-FR')} FCFA</span>
                      }
                      {resa.arrhesRembStatut === 'rembourse' && <span style={{ color: '#8B5CF6', fontSize: 10 }}>↩ Remboursé</span>}
                      {resa.arrhesRembStatut === 'forfait'   && <span style={{ color: 'var(--danger)', fontSize: 10 }}>✗ Arrhes retenues</span>}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {resa.status === 'en_attente' && <>
                    <button onClick={() => onUpdateStatus(resa.id, 'confirmee')} style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.4)', color: 'var(--success)', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Confirmer
                    </button>
                    <button onClick={() => onUpdateStatus(resa.id, 'annulee')} style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✗ Annuler
                    </button>
                  </>}
                  {resa.status === 'confirmee' && (
                    <button onClick={() => onUpdateStatus(resa.id, 'arrivee')} style={{ background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.4)', color: '#8B5CF6', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🪑 Arrivée
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
