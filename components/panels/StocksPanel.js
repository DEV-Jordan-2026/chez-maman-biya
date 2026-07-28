'use client'

import { useState, useEffect, useCallback } from 'react'

const CATS = ['Légumes', 'Légumes secs', 'Protéines', 'Huiles', 'Féculents', 'Épices', 'Boissons', 'Emballage']

// ── Onglet Recettes ────────────────────────────────────────────────────────────
function RecettesTab({ user }) {
  const [menu,       setMenu]       = useState([])
  const [stocks,     setStocks]     = useState([])
  const [recettes,   setRecettes]   = useState([])   // toutes les recettes
  const [platSelec,  setPlatSelec]  = useState(null) // menuItem sélectionné
  const [form,       setForm]       = useState({ stockItemId: '', quantite: '', unite: '' })
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/menu').then(r => r.json()),
      fetch('/api/stocks').then(r => r.json()),
      fetch('/api/recettes').then(r => r.json()),
    ]).then(([m, s, r]) => {
      setMenu(Array.isArray(m) ? m.filter(p => p.actif) : [])
      setStocks(Array.isArray(s) ? s : [])
      setRecettes(Array.isArray(r) ? r : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const recettesPlat = recettes.filter(r => r.menuItemId === platSelec?.id)

  async function ajouterIngredient() {
    if (!platSelec || !form.stockItemId || !form.quantite) {
      setMsg({ type: 'err', text: 'Plat, ingrédient et quantité requis' }); return
    }
    setBusy(true)
    try {
      const stockItem = stocks.find(s => s.id === form.stockItemId)
      const res = await fetch('/api/recettes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId:  platSelec.id,
          menuItemNom: platSelec.name,
          stockItemId: form.stockItemId,
          quantite:    parseFloat(form.quantite),
          unite:       form.unite || stockItem?.unite || 'kg',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error }); return }
      setRecettes(prev => {
        const exists = prev.findIndex(r => r.id === data.id)
        return exists >= 0 ? prev.map(r => r.id === data.id ? data : r) : [...prev, data]
      })
      setForm({ stockItemId: '', quantite: '', unite: '' })
      setMsg({ type: 'ok', text: `✅ ${stockItem?.nom} ajouté à la recette` })
    } catch (e) {
      setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' })
    } finally {
      setBusy(false)
    }
  }

  async function supprimerIngredient(id) {
    if (!confirm('Supprimer cet ingrédient de la recette ?')) return
    try {
      await fetch('/api/recettes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setRecettes(prev => prev.filter(r => r.id !== id))
      setMsg({ type: 'ok', text: '✅ Ingrédient supprimé' })
    } catch { setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' }) }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,151,60,.2)',
    color: '#f0e8d8', borderRadius: 8, padding: '8px 12px', fontSize: 13,
    outline: 'none', fontFamily: 'var(--font-dm)', width: '100%',
  }

  if (loading) return <div style={{ padding: 32, color: 'rgba(240,232,216,.4)', textAlign: 'center' }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 400 }}>

      {/* Colonne gauche : liste des plats */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(240,232,216,.4)', marginBottom: 10, textTransform: 'uppercase' }}>
          Plats du menu
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 460, overflowY: 'auto' }}>
          {menu.map(plat => {
            const nbIngredients = recettes.filter(r => r.menuItemId === plat.id).length
            const isSelected    = platSelec?.id === plat.id
            return (
              <button key={plat.id} onClick={() => { setPlatSelec(plat); setMsg(null) }} style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isSelected ? 'rgba(201,151,60,.15)' : 'rgba(255,255,255,.03)',
                outline: isSelected ? '1px solid rgba(201,151,60,.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span style={{ fontSize: 13, color: isSelected ? '#c9973c' : '#f0e8d8', fontWeight: isSelected ? 700 : 400 }}>
                  {plat.emoji} {plat.name}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 7px',
                  background: nbIngredients > 0 ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.05)',
                  color: nbIngredients > 0 ? '#22C55E' : 'rgba(240,232,216,.3)',
                }}>
                  {nbIngredients > 0 ? `${nbIngredients} ingr.` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Colonne droite : recette du plat sélectionné */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!platSelec ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(240,232,216,.3)', fontSize: 13 }}>
            ← Sélectionnez un plat pour gérer sa recette
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#c9973c', marginBottom: 16 }}>
              {platSelec.emoji} {platSelec.name}
            </div>

            {msg && (
              <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: msg.type === 'ok' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: msg.type === 'ok' ? '#22C55E' : '#EF4444', border: `1px solid ${msg.type === 'ok' ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}` }}>
                {msg.text}
              </div>
            )}

            {/* Ingrédients existants */}
            {recettesPlat.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(240,232,216,.4)', marginBottom: 8, textTransform: 'uppercase' }}>Ingrédients</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recettesPlat.map(r => {
                    const si = r.stockItem || stocks.find(s => s.id === r.stockItemId)
                    const suffisant = si && si.stock > si.seuil
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: suffisant ? '#22C55E' : '#EF4444', flexShrink: 0 }} title={suffisant ? 'Stock suffisant' : 'Stock bas'} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e8d8' }}>{si?.nom || r.stockItemId}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 13, color: '#c9973c', fontWeight: 700 }}>
                            {r.quantite} {r.unite} / portion
                          </span>
                          {si && (
                            <span style={{ fontSize: 11, color: 'rgba(240,232,216,.4)' }}>
                              (stock : {si.stock} {si.unite})
                            </span>
                          )}
                          <button onClick={() => supprimerIngredient(r.id)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Formulaire ajout ingrédient */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.15)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(240,232,216,.35)', marginBottom: 12, textTransform: 'uppercase' }}>
                + Ajouter un ingrédient
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 160px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(240,232,216,.4)', marginBottom: 4 }}>Ingrédient stock</div>
                  <select value={form.stockItemId} onChange={e => {
                    const s = stocks.find(st => st.id === e.target.value)
                    setForm(p => ({ ...p, stockItemId: e.target.value, unite: s?.unite || '' }))
                  }} style={{ ...inputStyle, background: 'rgba(30,20,10,.95)' }}>
                    <option value="">Sélectionner…</option>
                    {stocks.map(s => <option key={s.id} value={s.id}>{s.nom} ({s.unite}) — {s.stock} en stock</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 90px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(240,232,216,.4)', marginBottom: 4 }}>Qté / portion</div>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.quantite} onChange={e => setForm(p => ({ ...p, quantite: e.target.value }))}
                    placeholder="Ex: 0.2" style={inputStyle}
                  />
                </div>
                <div style={{ flex: '1 1 70px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(240,232,216,.4)', marginBottom: 4 }}>Unité</div>
                  <input
                    value={form.unite} onChange={e => setForm(p => ({ ...p, unite: e.target.value }))}
                    placeholder="kg" style={inputStyle}
                  />
                </div>
                <button onClick={ajouterIngredient} disabled={busy} style={{
                  flex: '0 0 auto', padding: '8px 18px', borderRadius: 8, border: 'none', cursor: busy ? 'wait' : 'pointer',
                  background: 'rgba(201,151,60,.15)', color: '#c9973c', fontSize: 13, fontWeight: 700,
                  outline: '1px solid rgba(201,151,60,.3)',
                }}>
                  {busy ? '…' : 'Ajouter'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function StocksPanel({ user }) {
  const isSuperAdmin = user?.role === 'super_admin'
  const [activeTab, setActiveTab] = useState('stocks')
  const [stocks, setStocks]   = useState([])
  const [newItem, setNewItem] = useState({ nom: '', unite: 'kg', stock: '', seuil: '', cat: 'Légumes' })
  const [filtre, setFiltre]   = useState('tous')
  const [loading, setLoading] = useState(true)

  const fetchStocks = useCallback(async () => {
    try {
      const res  = await fetch('/api/stocks', { cache: 'no-store' })
      const data = await res.json()
      setStocks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[StocksPanel] fetch stocks:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStocks() }, [fetchStocks])

  const modifier = async (id, delta) => {
    // Optimistic
    setStocks(prev => prev.map(s => s.id === id ? { ...s, stock: Math.max(0, s.stock + delta) } : s))
    try {
      await fetch(`/api/stocks/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ delta }),
      })
    } catch (e) {
      console.error('[StocksPanel] update stock:', e)
      fetchStocks()
    }
  }

  const supprimerArticle = async (id, nom) => {
    if (!confirm(`Supprimer "${nom}" définitivement ?`)) return
    setStocks(prev => prev.filter(s => s.id !== id))
    try {
      await fetch(`/api/stocks/${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('[StocksPanel] delete stock:', e)
      fetchStocks()
    }
  }

  const ajouterArticle = async () => {
    if (!newItem.nom || !newItem.stock) return
    try {
      const res  = await fetch('/api/stocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...newItem, stock: parseFloat(newItem.stock), seuil: parseFloat(newItem.seuil) || 0 }),
      })
      const item = await res.json()
      setStocks(prev => [...prev, item])
      setNewItem({ nom: '', unite: 'kg', stock: '', seuil: '', cat: 'Légumes' })
    } catch (e) {
      console.error('[StocksPanel] ajout article:', e)
    }
  }

  const filtered = stocks.filter(s => {
    if (filtre === 'alerte') return s.stock <= s.seuil
    if (filtre === 'ok')     return s.stock > s.seuil
    return true
  })

  const enAlerte = stocks.filter(s => s.stock <= s.seuil).length

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,151,60,.2)',
    borderRadius: 8, color: 'var(--cream)',
    padding: '8px 12px', fontSize: 13,
  }

  return (
    <div>
      {/* ── Navigation onglets ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[
          { id: 'stocks',   label: '📦 Stocks' },
          { id: 'recettes', label: '📋 Recettes' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
            fontFamily: 'var(--font-dm)', fontWeight: activeTab === t.id ? 700 : 400,
            background: activeTab === t.id ? 'rgba(201,151,60,.15)' : 'rgba(255,255,255,.04)',
            color: activeTab === t.id ? '#c9973c' : 'rgba(240,232,216,.5)',
            outline: activeTab === t.id ? '1px solid rgba(201,151,60,.3)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Onglet Recettes ──────────────────────────────────────── */}
      {activeTab === 'recettes' && <RecettesTab user={user} />}

      {/* ── Onglet Stocks ────────────────────────────────────────── */}
      {activeTab === 'stocks' && <>
      {enAlerte > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontWeight: 700 }}>{enAlerte} article{enAlerte > 1 ? 's' : ''} en rupture ou sous le seuil d&apos;alerte</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['tous', 'Tous'], ['alerte', `⚠️ Alertes (${enAlerte})`], ['ok', '✅ OK']].map(([id, label]) => (
          <button key={id} onClick={() => setFiltre(id)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${filtre === id ? 'var(--warning)' : 'rgba(245,158,11,.2)'}`,
            background: filtre === id ? 'rgba(245,158,11,.1)' : 'transparent',
            color: filtre === id ? 'var(--warning)' : 'var(--cream-faint)',
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', opacity: .3 }}>Chargement…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12, marginBottom: 28 }}>
          {filtered.map(s => {
            const alerteRouge  = s.stock < s.seuil
            const alerteOrange = s.stock === s.seuil
            const couleur      = alerteRouge ? 'var(--danger)' : alerteOrange ? 'var(--warning)' : 'var(--success)'
            const pct          = s.seuil > 0 ? Math.min(100, Math.round((s.stock / (s.seuil * 2)) * 100)) : 100

            return (
              <div key={s.id} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${couleur}25`, borderLeft: `4px solid ${couleur}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{s.nom}</div>
                    <div style={{ fontSize: 10, opacity: .4, letterSpacing: .5 }}>{s.cat}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, background: `${couleur}18`, color: couleur, padding: '2px 8px', borderRadius: 4 }}>
                    {alerteRouge ? '🔴 RUPTURE' : alerteOrange ? '🟡 SEUIL' : '🟢 OK'}
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: couleur, borderRadius: 2, transition: 'width .3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 20, fontWeight: 800, color: couleur }}>{s.stock}</span>
                    <span style={{ fontSize: 11, opacity: .45, marginLeft: 4 }}>{s.unite}</span>
                    <span style={{ fontSize: 10, opacity: .3, marginLeft: 8 }}>/ seuil {s.seuil}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => modifier(s.id, -1)} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>−</button>
                    <button onClick={() => modifier(s.id, 1)} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,.3)', color: 'var(--success)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>+</button>
                    {isSuperAdmin && (
                      <button onClick={() => supprimerArticle(s.id, s.nom)} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,.25)', color: '#6b7280', fontSize: 14, cursor: 'pointer', lineHeight: 1 }} title="Supprimer">×</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ajout article */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,151,60,0.12)', borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 11, opacity: .35, marginBottom: 12, letterSpacing: 1 }}>+ AJOUTER UN ARTICLE</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={newItem.nom} onChange={e => setNewItem(p => ({ ...p, nom: e.target.value }))}
            placeholder="Nom de l'article" style={{ ...inputStyle, flex: '2 1 160px' }} />
          <input value={newItem.stock} onChange={e => setNewItem(p => ({ ...p, stock: e.target.value }))}
            placeholder="Stock" type="number" style={{ ...inputStyle, flex: '1 1 80px' }} />
          <input value={newItem.seuil} onChange={e => setNewItem(p => ({ ...p, seuil: e.target.value }))}
            placeholder="Seuil" type="number" style={{ ...inputStyle, flex: '1 1 80px' }} />
          <input value={newItem.unite} onChange={e => setNewItem(p => ({ ...p, unite: e.target.value }))}
            placeholder="Unité" style={{ ...inputStyle, flex: '0 1 70px' }} />
          <select value={newItem.cat} onChange={e => setNewItem(p => ({ ...p, cat: e.target.value }))}
            style={{ ...inputStyle, flex: '1 1 110px', background: 'rgba(30,20,10,0.95)' }}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={ajouterArticle} style={{ background: 'rgba(201,151,60,0.12)', border: '1px solid rgba(201,151,60,.4)', color: 'var(--gold)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Ajouter
          </button>
        </div>
      </div>
      </>}
    </div>
  )
}
