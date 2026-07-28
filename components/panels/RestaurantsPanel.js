'use client'
// components/panels/RestaurantsPanel.js — v13
// Gestion multi-restaurants (super_admin uniquement)

import { useState, useEffect, useCallback } from 'react'

const COULEURS = ['#C9973C','#8B5CF6','#10b981','#ef4444','#06b6d4','#f59e0b','#84cc16','#ec4899']

const s = {
  card: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(201,151,60,0.15)',
    borderRadius: 14, padding: '18px 22px', marginBottom: 12,
    transition: 'border-color .2s, box-shadow .2s',
  },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,151,60,0.2)', borderRadius: 8,
    color: 'var(--cream)', padding: '10px 14px', fontSize: 13,
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  label: { fontSize: 10, color: 'rgba(245,239,230,0.4)', letterSpacing: 1, display: 'block', marginBottom: 5 },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--gold), #a85f28)',
    border: 'none', color: 'white', padding: '10px 22px',
    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 600, background: `${color}22`, color,
    border: `1px solid ${color}44`,
  }),
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 },
  error: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 12,
  },
}

function FormulaireRestaurant({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { nom: '', ville: '', quartier: '', adresse: '', tel: '', couleur: COULEURS[0] })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  async function sauvegarder() {
    setErr('')
    if (!form.nom.trim() || !form.ville.trim() || !form.quartier.trim()) {
      setErr('Nom, ville et quartier sont obligatoires.')
      return
    }
    setBusy(true)
    try {
      const url    = initial?.id ? `/api/restaurants/${initial.id}` : '/api/restaurants'
      const method = initial?.id ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data   = await res.json()
      if (!res.ok) { setErr(data.error || 'Erreur serveur'); return }
      onSave(data)
    } catch { setErr('Erreur réseau. Veuillez réessayer.') }
    finally { setBusy(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ ...s.card, border: '1px solid rgba(201,151,60,0.35)', marginBottom: 24 }}>
      <h3 style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700, marginBottom: 16, margin: '0 0 16px' }}>
        {initial?.id ? '✏️ Modifier le restaurant' : '🏪 Nouveau restaurant'}
      </h3>
      {err && <div style={s.error}>{err}</div>}
      <div style={s.row}>
        <div>
          <label style={s.label}>NOM DU RESTAURANT *</label>
          <input style={s.input} value={form.nom} onChange={f('nom')} placeholder="ex: Chez Maman Biya" />
        </div>
        <div>
          <label style={s.label}>VILLE *</label>
          <input style={s.input} value={form.ville} onChange={f('ville')} placeholder="ex: Yaoundé" />
        </div>
      </div>
      <div style={s.row}>
        <div>
          <label style={s.label}>QUARTIER *</label>
          <input style={s.input} value={form.quartier} onChange={f('quartier')} placeholder="ex: Bastos" />
        </div>
        <div>
          <label style={s.label}>TÉLÉPHONE</label>
          <input style={s.input} value={form.tel} onChange={f('tel')} placeholder="+237 6XX XXX XXX" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={s.label}>ADRESSE COMPLÈTE</label>
        <input style={s.input} value={form.adresse} onChange={f('adresse')} placeholder="Rue, immeuble..." />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={s.label}>COULEUR D'IDENTIFICATION</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {COULEURS.map(c => (
            <button key={c} onClick={() => setForm(p => ({ ...p, couleur: c }))}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                cursor: 'pointer', outline: form.couleur === c ? `3px solid white` : 'none',
                outlineOffset: 2, transition: 'outline .15s',
              }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={sauvegarder} disabled={busy} style={s.btnPrimary}>
          {busy ? '...' : (initial?.id ? 'Enregistrer' : 'Créer le restaurant')}
        </button>
        <button onClick={onCancel}
          style={{ background: 'transparent', border: '1px solid rgba(201,151,60,0.3)', color: 'var(--cream)', padding: '10px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}

export default function RestaurantsPanel() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [err, setErr]                 = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/restaurants')
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erreur'); return }
      setRestaurants(Array.isArray(data) ? data : [])
    } catch { setErr('Erreur réseau. Veuillez réessayer.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActif(r) {
    await fetch(`/api/restaurants/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !r.actif }),
    })
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(201,151,60,0.2)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>🏪 Restaurants</h2>
          <p style={{ color: 'rgba(245,239,230,0.5)', fontSize: 13, margin: 0 }}>
            {restaurants.length} établissement{restaurants.length > 1 ? 's' : ''} dans la chaîne
          </p>
        </div>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)} style={s.btnPrimary}>+ Nouveau restaurant</button>
        )}
      </div>

      {err && <div style={s.error}>{err}</div>}

      {/* Formulaire création */}
      {showForm && (
        <FormulaireRestaurant
          onSave={(r) => { setRestaurants(p => [r, ...p]); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Formulaire édition */}
      {editing && (
        <FormulaireRestaurant
          initial={editing}
          onSave={(r) => { setRestaurants(p => p.map(x => x.id === r.id ? r : x)); setEditing(null) }}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Liste */}
      {restaurants.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏪</div>
          <p style={{ color: 'rgba(245,239,230,0.5)', fontSize: 14 }}>
            Aucun restaurant configuré.<br />Créez votre premier établissement.
          </p>
        </div>
      ) : (
        restaurants.map(r => (
          <div key={r.id} style={{ ...s.card, borderLeft: `3px solid ${r.couleur || 'var(--gold)'}`,
            opacity: r.actif ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: r.couleur || 'var(--gold)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--cream)', fontWeight: 700, fontSize: 15 }}>{r.nom}</span>
                  <span style={s.badge(r.actif ? '#10b981' : '#6b7280')}>
                    {r.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
                <div style={{ color: 'rgba(245,239,230,0.55)', fontSize: 13, paddingLeft: 22 }}>
                  📍 {r.quartier}, {r.ville}
                  {r.adresse && <span> · {r.adresse}</span>}
                  {r.tel && <span> · {r.tel}</span>}
                </div>
                {r._count && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingLeft: 22 }}>
                    <span style={{ fontSize: 12, color: 'rgba(245,239,230,0.4)' }}>
                      👥 {r._count.users} employé{r._count.users > 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(245,239,230,0.4)' }}>
                      🧾 {r._count.commandes} commandes
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setEditing(r)}
                  style={{ background: 'rgba(201,151,60,0.1)', border: '1px solid rgba(201,151,60,0.25)', color: 'var(--gold)', padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  ✏️ Modifier
                </button>
                <button onClick={() => toggleActif(r)}
                  style={{ background: r.actif ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${r.actif ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    color: r.actif ? 'var(--danger)' : 'var(--success)',
                    padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  {r.actif ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
