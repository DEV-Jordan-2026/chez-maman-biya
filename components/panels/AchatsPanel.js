'use client'
// components/panels/AchatsPanel.js — v13
// Remplace FournisseursPanel — 4 sous-panneaux : Demandes | Commandes | Réception | Notes de frais

import { useState, useEffect, useCallback } from 'react'

const URGENCE_CONFIG = {
  normale:   { label: 'Normale',   color: '#6b7280' },
  urgent:    { label: 'Urgent',    color: '#f59e0b' },
  critique:  { label: 'Critique',  color: '#ef4444' },
}

const STATUS_CONFIG = {
  en_attente:          { label: 'En attente',       color: '#6b7280' },
  en_attente_admin:    { label: 'Attente admin',    color: '#8b5cf6' },
  approuvee_manager:   { label: 'Approuvée',        color: '#10b981' },
  approuvee_admin:     { label: 'Approuvée admin',  color: '#10b981' },
  refusee:             { label: 'Refusée',           color: '#ef4444' },
  commandee:           { label: 'Commandée',         color: '#06b6d4' },
  recue:               { label: 'Reçue',             color: '#84cc16' },
}

const s = {
  card: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(201,151,60,0.12)',
    borderRadius: 14, padding: '16px 20px', marginBottom: 10,
  },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,151,60,0.2)', borderRadius: 8,
    color: 'var(--cream)', padding: '9px 13px', fontSize: 13,
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  label: { fontSize: 10, color: 'rgba(245,239,230,0.4)', letterSpacing: 1, display: 'block', marginBottom: 5 },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--gold), #a85f28)',
    border: 'none', color: 'white', padding: '10px 20px',
    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  subTab: (active) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 700 : 400, fontFamily: 'inherit',
    background: active ? 'linear-gradient(135deg, var(--gold), #a85f28)' : 'rgba(255,255,255,0.05)',
    color: active ? 'white' : 'rgba(245,239,230,0.6)',
    transition: 'all .18s',
  }),
  badge: (color) => ({
    display: 'inline-block', padding: '2px 9px', borderRadius: 20,
    fontSize: 11, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}44`,
  }),
  row2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
}

// ── Sous-panneau 1 : Demandes d'achat ─────────────────────────────────────────
function DemandesAchatPanel({ userRole, restaurantId }) {
  const [demandes, setDemandes]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ article: '', quantite: '', unite: 'kg', montantEstime: '', motif: '', urgence: 'normale' })
  const [busy, setBusy]             = useState(false)
  const [msg, setMsg]               = useState({ type: '', text: '' })
  const [filtreStatus, setFiltreStatus] = useState('tous')

  const canCreate  = ['super_admin','manager','magasinier'].includes(userRole)
  const canValider = ['super_admin','manager'].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs  = restaurantId ? `?restaurantId=${restaurantId}` : ''
      const res = await fetch(`/api/achats/demandes${qs}`)
      if (!res.ok) throw new Error('Erreur ' + res.status)
      const d   = await res.json()
      setDemandes(Array.isArray(d) ? d : [])
    } catch(e) {
      console.error('[Demandes]', e)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function creerDemande() {
    if (!form.article.trim() || !form.quantite || !form.unite.trim()) {
      setMsg({ type: 'err', text: "L'article, la quantité et l'unité sont requis" }); return
    }
    setBusy(true)
    try {
      const res  = await fetch('/api/achats/demandes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, restaurantId }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error }); return }
      setMsg({ type: 'ok', text: `✅ Demande créée pour "${form.article}"` })
      setForm({ article: '', quantite: '', unite: 'kg', montantEstime: '', motif: '', urgence: 'normale' })
      setShowForm(false)
      load()
    } catch(e) {
      console.error('[creerDemande]', e)
      setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' })
    } finally {
      setBusy(false)  // BUG FIX: toujours débloquer le bouton
    }
  }

  async function valider(id, action, motifRefus) {
    try {
      const res = await fetch(`/api/achats/demandes/${id}/valider`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, motifRefus }),
      })
      if (res.ok) {
        load()
        setMsg({ type: 'ok', text: action === 'approuver' ? '✅ Demande approuvée' : '❌ Demande refusée' })
      } else {
        const d = await res.json()
        setMsg({ type: 'err', text: d.error || 'Erreur serveur' })
      }
    } catch(e) {
      setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' })
    }
  }

  const demFiltrees = filtreStatus === 'tous' ? demandes : demandes.filter(d => d.status === filtreStatus)
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['tous','en_attente','approuvee_manager','approuvee_admin','refusee','recue'].map(st => (
            <button key={st} onClick={() => setFiltreStatus(st)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit',
              background: filtreStatus === st ? 'rgba(201,151,60,0.3)' : 'rgba(255,255,255,0.05)',
              color: filtreStatus === st ? 'var(--gold)' : 'rgba(245,239,230,0.5)',
            }}>
              {st === 'tous' ? 'Toutes' : STATUS_CONFIG[st]?.label || st}
            </button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(p => !p)} style={s.btnPrimary}>
            {showForm ? 'Annuler' : '+ Nouvelle demande'}
          </button>
        )}
      </div>

      {msg.text && (
        <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
          border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          borderRadius: 8, padding: '10px 14px', color: msg.type === 'err' ? 'var(--danger)' : 'var(--success)',
          fontSize: 13, marginBottom: 12 }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div style={{ ...s.card, border: '1px solid rgba(201,151,60,0.3)', marginBottom: 16 }}>
          <h4 style={{ color: 'var(--gold)', margin: '0 0 14px', fontSize: 14 }}>🛒 Nouvelle demande d'achat</h4>
          <div style={s.row3}>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={s.label}>ARTICLE *</label>
              <input style={s.input} value={form.article} onChange={f('article')} placeholder="ex: Ndolé frais" />
            </div>
            <div>
              <label style={s.label}>URGENCE</label>
              <select style={s.input} value={form.urgence} onChange={f('urgence')}>
                <option style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }} value="normale">Normale</option>
                <option style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }} value="urgent">Urgent</option>
                <option style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }} value="critique">Critique</option>
              </select>
            </div>
          </div>
          <div style={s.row3}>
            <div>
              <label style={s.label}>QUANTITÉ *</label>
              <input style={s.input} type="number" min="0" value={form.quantite} onChange={f('quantite')} placeholder="5" />
            </div>
            <div>
              <label style={s.label}>UNITÉ *</label>
              <select style={s.input} value={form.unite} onChange={f('unite')}>
                {['kg','g','L','cl','unité','carton','sac','bouteille','boîte'].map(u => <option key={u} style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>MONTANT ESTIMÉ (FCFA)</label>
              <input style={s.input} type="number" min="0" value={form.montantEstime} onChange={f('montantEstime')} placeholder="5000" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>MOTIF / JUSTIFICATION</label>
            <input style={s.input} value={form.motif} onChange={f('motif')} placeholder="Pourquoi cette demande ?" />
          </div>
          <button onClick={creerDemande} disabled={busy} style={s.btnPrimary}>
            {busy ? 'Envoi...' : 'Soumettre la demande'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(245,239,230,0.4)' }}>Chargement...</div>
      ) : demFiltrees.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <p style={{ color: 'rgba(245,239,230,0.4)', fontSize: 13 }}>Aucune demande</p>
        </div>
      ) : demFiltrees.map(d => {
        const urg = URGENCE_CONFIG[d.urgence] || URGENCE_CONFIG.normale
        const sta = STATUS_CONFIG[d.status]   || { label: d.status, color: '#6b7280' }
        return (
          <div key={d.id} style={{ ...s.card, borderLeft: `3px solid ${urg.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--cream)', fontWeight: 700, fontSize: 14 }}>
                    {d.article}
                  </span>
                  <span style={s.badge(urg.color)}>{urg.label}</span>
                  <span style={s.badge(sta.color)}>{sta.label}</span>
                </div>
                <div style={{ color: 'rgba(245,239,230,0.55)', fontSize: 12 }}>
                  {d.quantite} {d.unite}
                  {d.montantEstime && ` · ~${d.montantEstime.toLocaleString()} FCFA`}
                  {d.motif && ` · ${d.motif}`}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.35)', marginTop: 4 }}>
                  Par {d.demandeurNom} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                  {d.motifRefus && <span style={{ color: 'var(--danger)' }}> · Refus : {d.motifRefus}</span>}
                </div>
              </div>
              {canValider && d.status === 'en_attente' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => valider(d.id, 'approuver')}
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--success)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    ✓ Approuver
                  </button>
                  <button onClick={() => {
                    const motif = prompt('Motif du refus :')
                    if (motif) valider(d.id, 'refuser', motif)
                  }}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    ✗ Refuser
                  </button>
                </div>
              )}
              {canValider && d.status === 'en_attente_admin' && userRole === 'super_admin' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => valider(d.id, 'approuver')}
                    style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#8b5cf6', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    👑 Valider (admin)
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Sous-panneau 4 : Notes de frais ──────────────────────────────────────────
function NotesFraisPanel({ userRole, restaurantId }) {
  const [notes, setNotes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ montant: '', categorie: 'Transport', description: '' })
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState({ type: '', text: '' })

  const canValider = ['super_admin','manager'].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs  = restaurantId ? `?restaurantId=${restaurantId}` : ''
      const res = await fetch(`/api/achats/notes-frais${qs}`)
      if (!res.ok) throw new Error('Erreur ' + res.status)
      const d   = await res.json()
      setNotes(Array.isArray(d) ? d : [])
    } catch(e) {
      console.error('[Notes frais]', e)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function creer() {
    if (!form.montant || !form.description.trim()) {
      setMsg({ type: 'err', text: 'Le montant et la description sont requis' }); return
    }
    setBusy(true)
    const res = await fetch('/api/achats/notes-frais', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, restaurantId }),
    })
    const d = await res.json()
    if (!res.ok) { setMsg({ type: 'err', text: d.error }); setBusy(false); return }
    setMsg({ type: 'ok', text: '✅ Note de frais soumise' })
    setForm({ montant: '', categorie: 'Transport', description: '' })
    setShowForm(false)
    load()
    setBusy(false)
  }

  async function validerNote(id, status) {
    try {
      const res = await fetch('/api/achats/notes-frais', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) load()
      else setMsg({ type: 'err', text: 'Erreur lors de la validation. Veuillez réessayer.' })
    } catch(e) {
      setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' })
    }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const STATUS_NF = { en_attente: { label: 'En attente', color: '#6b7280' }, validee: { label: 'Validée', color: '#10b981' }, refusee: { label: 'Refusée', color: '#ef4444' } }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowForm(p => !p)} style={s.btnPrimary}>
          {showForm ? 'Annuler' : '+ Nouvelle note de frais'}
        </button>
      </div>

      {msg.text && (
        <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
          border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          borderRadius: 8, padding: '10px 14px', color: msg.type === 'err' ? 'var(--danger)' : 'var(--success)', fontSize: 13, marginBottom: 12 }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div style={{ ...s.card, border: '1px solid rgba(201,151,60,0.3)', marginBottom: 16 }}>
          <h4 style={{ color: 'var(--gold)', margin: '0 0 14px', fontSize: 14 }}>🧾 Note de frais</h4>
          <div style={s.row2}>
            <div>
              <label style={s.label}>MONTANT (FCFA) *</label>
              <input style={s.input} type="number" min="0" value={form.montant} onChange={f('montant')} />
            </div>
            <div>
              <label style={s.label}>CATÉGORIE</label>
              <select style={s.input} value={form.categorie} onChange={f('categorie')}>
                {['Transport','Repas','Matériel','Fournitures','Autre'].map(c => <option key={c} style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>DESCRIPTION *</label>
            <input style={s.input} value={form.description} onChange={f('description')} placeholder="Détail de la dépense" />
          </div>
          <button onClick={creer} disabled={busy} style={s.btnPrimary}>{busy ? '...' : 'Soumettre'}</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(245,239,230,0.4)' }}>Chargement...</div>
      ) : notes.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'rgba(245,239,230,0.4)', fontSize: 13 }}>Aucune note de frais</p>
        </div>
      ) : notes.map(n => {
        const st = STATUS_NF[n.status] || { label: n.status, color: '#6b7280' }
        return (
          <div key={n.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 15 }}>
                    {n.montant.toLocaleString()} FCFA
                  </span>
                  <span style={s.badge('#06b6d4')}>{n.categorie}</span>
                  <span style={s.badge(st.color)}>{st.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(245,239,230,0.6)' }}>{n.description}</div>
                <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.35)', marginTop: 4 }}>
                  {n.employeNom} · {new Date(n.createdAt).toLocaleDateString('fr-FR')}
                  {n.valideePar && ` · Traité par ${n.valideePar}`}
                </div>
              </div>
              {canValider && n.status === 'en_attente' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => validerNote(n.id, 'validee')}
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--success)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    ✓ Valider
                  </button>
                  <button onClick={() => validerNote(n.id, 'refusee')}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    ✗ Refuser
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AchatsPanel principal ─────────────────────────────────────────────────────
// ── Onglet Prévisions ──────────────────────────────────────────────────────────
const URGENCE_PREV = {
  critique: { color: '#EF4444', bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.25)', label: '🚨 Critique' },
  haute:    { color: '#F59E0B', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)', label: '⚠️ Haute'    },
  normale:  { color: '#6B7280', bg: 'rgba(107,114,128,.06)', border: 'rgba(107,114,128,.15)', label: '📋 Normale' },
}

function PrevisionsAchatTab({ user }) {
  const restaurantId = user?.restaurantId || null
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [horizon,   setHorizon]   = useState(7)
  const [creating,  setCreating]  = useState(null)  // stockItemId en cours de création
  const [created,   setCreated]   = useState(new Set())
  const [msg,       setMsg]       = useState(null)
  const [filtre,    setFiltre]    = useState('tous') // 'tous' | 'critique' | 'haute'

  const load = useCallback(async (h = horizon) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ horizon: h, ...(restaurantId ? { restaurantId } : {}) })
      const res = await fetch(`/api/achats/previsions?${qs}`)
      const d   = await res.json()
      if (res.ok) setData(d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [horizon, restaurantId])

  useEffect(() => { load() }, [load])

  async function creerDemande(sugg) {
    setCreating(sugg.stockItemId)
    try {
      const res = await fetch('/api/achats/demandes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          article:      sugg.nom,
          quantite:     sugg.qteSuggested,
          unite:        sugg.unite,
          montantEstime: sugg.montantEstime || null,
          motif:        `Prévision auto ${horizon}j — stock ${sugg.stockActuel} ${sugg.unite}, besoin estimé ${sugg.besoinBrut} ${sugg.unite}. Plats : ${sugg.platsImpactes.join(', ')}`,
          urgence:      sugg.urgence === 'critique' ? 'critique' : sugg.urgence === 'haute' ? 'urgent' : 'normale',
        }),
      })
      if (!res.ok) { const d = await res.json(); setMsg({ type: 'err', text: d.error }); return }
      setCreated(prev => new Set([...prev, sugg.stockItemId]))
      setMsg({ type: 'ok', text: `✅ Demande créée pour ${sugg.nom} (${sugg.qteSuggested} ${sugg.unite})` })
    } catch { setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' }) }
    finally { setCreating(null) }
  }

  async function creerToutesCritiques() {
    const critiques = (data?.suggestions || []).filter(s => s.urgence === 'critique' && !created.has(s.stockItemId))
    for (const s of critiques) await creerDemande(s)
    setMsg({ type: 'ok', text: `✅ ${critiques.length} demande(s) critique(s) créée(s)` })
  }

  const suggestions = (data?.suggestions || []).filter(s =>
    filtre === 'tous' ? true : s.urgence === filtre
  )
  const resume = data?.resume || {}

  const inputStyle = { ...s.input, width: 'auto', padding: '7px 12px' }

  return (
    <div>
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:'var(--gold)', marginBottom:4 }}>🤖 Prévisions d'achats intelligentes</div>
          <div style={{ fontSize:12, color:'rgba(245,239,230,.45)' }}>
            Basé sur {resume.nbJoursAnalyses || 0} jours d'historique · Fiabilité {resume.fiabilite || 0}%
            {resume.fiabilite < 50 && <span style={{ color:'#F59E0B' }}> · Données insuffisantes, configurez plus de recettes</span>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <label style={s.label}>Horizon :</label>
          <select value={horizon} onChange={e => { setHorizon(+e.target.value); load(+e.target.value) }} style={{ ...inputStyle, background:'rgba(20,15,10,.9)', color:'var(--cream)', fontFamily:'inherit' }}>
            <option style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }} value={3}>3 jours</option>
            <option style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }} value={7}>7 jours</option>
            <option style={{ background: 'var(--ebony-1)', color: 'var(--cream)' }} value={14}>14 jours</option>
          </select>
          <button onClick={() => load()} style={{ ...s.btnPrimary, padding:'8px 14px', fontSize:12 }}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, fontSize:13, fontWeight:600, background: msg.type==='ok'?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)', color: msg.type==='ok'?'#22C55E':'#EF4444', border:`1px solid ${msg.type==='ok'?'rgba(34,197,94,.25)':'rgba(239,68,68,.25)'}` }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ padding:'48px 0', textAlign:'center', color:'rgba(245,239,230,.3)', fontSize:14 }}>
          ⏳ Calcul des prévisions…
        </div>
      ) : !data || suggestions.length === 0 && data.suggestions?.length === 0 ? (
        <div style={{ padding:'48px 0', textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--cream)', marginBottom:8 }}>Stocks suffisants</div>
          <div style={{ fontSize:13, color:'rgba(245,239,230,.4)', maxWidth:380, margin:'0 auto', lineHeight:1.7 }}>
            Aucun réapprovisionnement nécessaire sur {horizon} jours.
            {resume.fiabilite < 30 && ' Configurez des recettes dans Stocks → Recettes pour affiner les prévisions.'}
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Critiques',  val: resume.nbCritiques || 0, color:'#EF4444', bg:'rgba(239,68,68,.08)', cursor: 'pointer', onClick:()=>setFiltre('critique') },
              { label:'Urgences',   val: resume.nbHautes    || 0, color:'#F59E0B', bg:'rgba(245,158,11,.08)', cursor: 'pointer', onClick:()=>setFiltre('haute') },
              { label:'Total',      val: resume.nbSuggestions||0, color:'#6B7280', bg:'rgba(107,114,128,.06)', cursor: 'pointer', onClick:()=>setFiltre('tous') },
            ].map(k => (
              <div key={k.label} onClick={k.onClick} style={{ background:k.bg, border:`1px solid ${k.color}30`, borderRadius:12, padding:'14px 16px', textAlign:'center', cursor: k.cursor }}>
                <div style={{ fontSize:28, fontWeight:900, color:k.color }}>{k.val}</div>
                <div style={{ fontSize:11, color:'rgba(245,239,230,.45)', letterSpacing:1, textTransform:'uppercase' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Bouton créer toutes les critiques */}
          {(resume.nbCritiques || 0) > 0 && (
            <button onClick={creerToutesCritiques} style={{ ...s.btnPrimary, background:'linear-gradient(135deg,#EF4444,#B91C1C)', width:'100%', padding:'12px', marginBottom:16, fontSize:13 }}>
              🚨 Créer {resume.nbCritiques} demande{resume.nbCritiques>1?'s':''} critique{resume.nbCritiques>1?'s':''} d'un coup
            </button>
          )}

          {/* Filtres */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {['tous','critique','haute','normale'].map(f => (
              <button key={f} onClick={()=>setFiltre(f)} style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight: filtre===f?700:400, fontSize:12, background: filtre===f?'rgba(201,151,60,.15)':'rgba(255,255,255,.04)', color: filtre===f?'#C9973C':'rgba(245,239,230,.5)', outline: filtre===f?'1px solid rgba(201,151,60,.3)':'none' }}>
                {f === 'tous' ? `Tout (${data?.suggestions?.length||0})` : URGENCE_PREV[f]?.label}
              </button>
            ))}
          </div>

          {/* Liste suggestions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {suggestions.map(sugg => {
              const urg     = URGENCE_PREV[sugg.urgence] || URGENCE_PREV.normale
              const isDone  = created.has(sugg.stockItemId)
              const isBusy  = creating === sugg.stockItemId
              const pct     = Math.min(100, Math.round(sugg.ratio * 100))
              return (
                <div key={sugg.stockItemId} style={{ background: urg.bg, border:`1px solid ${urg.border}`, borderRadius:14, padding:'16px 18px', opacity: isDone?.6:1 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:'var(--cream)' }}>{sugg.nom}</span>
                        <span style={{ fontSize:10, fontWeight:700, background:urg.bg, color:urg.color, border:`1px solid ${urg.border}`, borderRadius:20, padding:'2px 8px' }}>{urg.label}</span>
                        {isDone && <span style={{ fontSize:10, color:'#22C55E', fontWeight:700 }}>✅ Demande créée</span>}
                      </div>
                      <div style={{ fontSize:12, color:'rgba(245,239,230,.5)', marginBottom:8 }}>
                        Plats concernés : {sugg.platsImpactes.slice(0,4).join(', ')}{sugg.platsImpactes.length>4?` +${sugg.platsImpactes.length-4}`:''}
                      </div>
                      {/* Barre de stock */}
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,.06)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background: pct<20?'#EF4444':pct<50?'#F59E0B':'#22C55E', borderRadius:3, transition:'width .4s' }}/>
                        </div>
                        <span style={{ fontSize:11, color:'rgba(245,239,230,.45)', flexShrink:0, minWidth:90, textAlign:'right' }}>
                          {sugg.stockActuel} / {sugg.besoinBrut} {sugg.unite} ({pct}%)
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:11, color:'rgba(245,239,230,.4)', marginBottom:3 }}>À commander</div>
                      <div style={{ fontSize:20, fontWeight:900, color: urg.color }}>{sugg.qteSuggested} <span style={{ fontSize:12 }}>{sugg.unite}</span></div>
                      <div style={{ fontSize:10, color:'rgba(245,239,230,.3)' }}>besoin : {sugg.besoinNet} {sugg.unite}</div>
                    </div>
                  </div>
                  {!isDone && (
                    <button onClick={()=>creerDemande(sugg)} disabled={isBusy} style={{ ...s.btnPrimary, width:'100%', padding:'10px', fontSize:12, opacity:isBusy?.6:1, background: sugg.urgence==='critique'?'linear-gradient(135deg,#EF4444,#B91C1C)':sugg.urgence==='haute'?'linear-gradient(135deg,#F59E0B,#B45309)':'linear-gradient(135deg,var(--gold),#a85f28)' }}>
                      {isBusy ? '⏳ Création…' : `📋 Créer demande d'achat (${sugg.qteSuggested} ${sugg.unite})`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Contexte : top plats */}
          {data?.topPlats?.length > 0 && (
            <div style={{ marginTop:28 }}>
              <div style={{ fontSize:11, letterSpacing:1, color:'rgba(245,239,230,.35)', textTransform:'uppercase', marginBottom:12 }}>Top plats sur 28 jours</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {data.topPlats.map(p => (
                  <div key={p.nom} style={{ padding:'6px 12px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', borderRadius:20, fontSize:12, color:'rgba(245,239,230,.6)' }}>
                    {p.emoji} {p.nom} <span style={{ color:'#C9973C', fontWeight:700 }}>×{p.totalQte}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AchatsPanel({ user }) {
  const userRole    = user?.role || 'staff'
  const restaurantId = user?.restaurantId || null
  const [subTab, setSubTab] = useState('previsions')

  const SUB_TABS = [
    { id: 'previsions',  label: '🤖 Prévisions' },
    { id: 'demandes',    label: '🛒 Demandes d\'achat' },
    { id: 'commandes',   label: '📄 Commandes fournisseurs' },
    { id: 'reception',   label: '📦 Réception marchandises' },
    { id: 'notes_frais', label: '🧾 Notes de frais' },
    { id: 'fournisseurs',label: '🏭 Fournisseurs' },
  ]

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>🛒 Achats</h2>
        <p style={{ color: 'rgba(245,239,230,0.5)', fontSize: 13, margin: '0 0 16px' }}>
          Gestion des achats, fournisseurs et notes de frais
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={s.subTab(subTab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'previsions' && <PrevisionsAchatTab user={user} />}

      {subTab === 'demandes' && <DemandesAchatPanel userRole={userRole} restaurantId={restaurantId} />}

      {subTab === 'commandes' && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,0.4)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          <p>Commandes fournisseurs — anciennement dans l'onglet Fournisseurs</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Migration en cours depuis FournisseursPanel</p>
        </div>
      )}

      {subTab === 'reception' && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,0.4)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
          <p style={{ fontSize: 14, marginBottom: 6 }}>Réception marchandises</p>
          <p style={{ fontSize: 12 }}>Associez une réception à un bon de commande depuis l'onglet Réceptions.</p>
        </div>
      )}

      {subTab === 'notes_frais' && <NotesFraisPanel userRole={userRole} restaurantId={restaurantId} />}

      {subTab === 'fournisseurs' && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,0.4)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏭</div>
          <p>Annuaire fournisseurs — contenu migré depuis FournisseursPanel</p>
        </div>
      )}
    </div>
  )
}
