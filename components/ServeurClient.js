'use client'
// ServeurClient.js — v14
// Interface dédiée serveur : tables + commandes + réservations + RH

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import RHPanel from '@/components/panels/RHPanel'
import useSSE from '@/hooks/useSSE'
import usePermissions from '@/hooks/usePermissions'

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_CMD = {
  nouveau:        { label: 'Nouveau',      color: '#3B82F6', bg: 'rgba(59,130,246,.12)',  emoji: '📋' },
  en_cours:       { label: 'En cuisine',   color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  emoji: '👨‍🍳' },
  en_preparation: { label: 'En prépa',     color: '#8B5CF6', bg: 'rgba(139,92,246,.12)',  emoji: '🍳' },
  pret:           { label: 'Prêt',         color: '#10b981', bg: 'rgba(16,185,129,.12)',  emoji: '✅' },
  en_livraison:   { label: 'En livraison', color: '#06b6d4', bg: 'rgba(6,182,212,.12)',   emoji: '🛵' },
  livre:          { label: 'Livré',        color: '#6b7280', bg: 'rgba(107,114,128,.1)',  emoji: '📦' },
  annule:         { label: 'Annulé',       color: '#ef4444', bg: 'rgba(239,68,68,.1)',    emoji: '❌' },
}

const STATUS_RESA = {
  en_attente: { label: 'En attente', color: '#f59e0b', emoji: '⏳' },
  confirmee:  { label: 'Confirmée',  color: '#10b981', emoji: '✅' },
  annulee:    { label: 'Annulée',    color: '#ef4444', emoji: '❌' },
  arrivee:    { label: 'Arrivée',    color: '#8B5CF6', emoji: '🎉' },
  no_show:    { label: 'No-show',    color: '#6b7280', emoji: '👻' },
}

const STATUS_TABLE = {
  libre:     { label: 'Libre',      color: '#10b981', bg: 'rgba(16,185,129,.12)'  },
  occupee:   { label: 'Occupée',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)'  },
  reservee:  { label: 'Réservée',   color: '#8B5CF6', bg: 'rgba(139,92,246,.12)'  },
  nettoyage: { label: 'Nettoyage',  color: '#6b7280', bg: 'rgba(107,114,128,.1)'  },
}

const ZONES = ['salle', 'terrasse', 'vip']
const ZONE_LABELS = { salle: '🪑 Salle', terrasse: '☀️ Terrasse', vip: '⭐ VIP' }

// ── Styles globaux ────────────────────────────────────────────────────────────
// Les keyframes (spin, fadeIn, pulse, slideUp) sont déclarés dans globals.css — pas de doublon ici.
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { background: var(--ebony); color: var(--cream); font-family: var(--font-dm), system-ui, sans-serif; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(201,151,60,.3); border-radius: 2px; }
  select, input, textarea { outline: none; }
  button { font-family: inherit; }
`

// ── Helpers ───────────────────────────────────────────────────────────────────
function tempsEcoule(createdAt) {
  if (!createdAt) return null
  const min = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  if (min < 1)  return { label: "À l'instant", color: '#10b981', urgent: false }
  if (min < 20) return { label: `${min} min`,  color: '#10b981', urgent: false }
  if (min < 40) return { label: `${min} min`,  color: '#f59e0b', urgent: true  }
  return              { label: `${min} min`,   color: '#ef4444', urgent: true  }
}

function totalCmd(cmd) {
  if (Array.isArray(cmd?.items)) return cmd.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
  return cmd?.total || 0
}

function parseItems(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
  return []
}

// ── Composants UI ─────────────────────────────────────────────────────────────
const Spinner = ({ size = 24, color = '#C9973C' }) => (
  <div style={{ width: size, height: size, border: `3px solid ${color}20`, borderTopColor: color, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
)

const Badge = ({ label, color, bg }) => (
  <span style={{ fontSize: 10, background: bg || `${color}15`, color, border: `1px solid ${color}40`, padding: '2px 8px', borderRadius: 20, fontWeight: 600, letterSpacing: .3 }}>
    {label}
  </span>
)

// ── Modal prise de commande à table ──────────────────────────────────────────
function ModalCommandeTable({ table, onClose, onSuccess, serveurNom }) {
  const [menu,    setMenu]    = useState([])
  const [panier,  setPanier]  = useState({}) // { menuItemId: qty }
  const [note,    setNote]    = useState('')
  const [couverts,setCouverts]= useState(table.capacite || 2)
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)
  const [err,     setErr]     = useState('')
  const [cat,     setCat]     = useState('tous')

  useEffect(() => {
    fetch(`/api/tables/${table.id}/commande`)
      .then(r => r.json())
      .then(d => {
        setMenu(Array.isArray(d.menu) ? d.menu : [])
        // Pré-remplir le panier si commande déjà ouverte
        if (d.commande?.items) {
          const init = {}
          parseItems(d.commande.items).forEach(it => { init[it.id] = it.qty || 1 })
          setPanier(init)
        }
      })
      .catch(() => setErr('Impossible de charger le menu'))
      .finally(() => setLoading(false))
  }, [table.id])

  // Empêche le scroll de "fuiter" vers la page derrière le modal : quand la
  // catégorie filtrée a peu de plats, la liste interne n'a plus besoin de
  // défiler, et le geste de scroll remonte alors jusqu'au body (page des
  // tables), donnant l'impression que la fenêtre devient impossible à
  // contrôler. On bloque le scroll du body tant que le modal est ouvert.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function setQty(id, delta) {
    setPanier(p => {
      const cur = p[id] || 0
      const nxt = Math.max(0, cur + delta)
      if (nxt === 0) { const { [id]: _, ...rest } = p; return rest }
      return { ...p, [id]: nxt }
    })
  }

  const cats = ['tous', ...new Set(menu.map(m => m.cat))]
  const menuFiltré = cat === 'tous' ? menu : menu.filter(m => m.cat === cat)
  const lignesPanier = Object.entries(panier)
    .map(([id, qty]) => {
      const plat = menu.find(m => String(m.id) === String(id))
      if (!plat) return null
      return { id, name: plat.name, price: plat.price, qty }
    })
    .filter(Boolean)
  const total = lignesPanier.reduce((s, it) => s + it.price * it.qty, 0)

  async function commander() {
    if (lignesPanier.length === 0) { setErr('Ajoutez au moins un plat'); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/tables/${table.id}/commande`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:     lignesPanier.map(it => ({ id: it.id, name: it.name, price: it.price, qty: it.qty })),
          note:      note.trim() || null,
          nbCouverts: parseInt(couverts) || 1,
          nom:       serveurNom || 'Serveur',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erreur'); setBusy(false); return }
      onSuccess(data)
    } catch { setErr('Erreur réseau'); setBusy(false) }
  }

  const inp = {
    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(201,151,60,.2)',
    borderRadius: 8, color: '#f5efe6', padding: '8px 12px', fontSize: 13,
    fontFamily: 'inherit',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#12121a', borderRadius: '20px 20px 0 0',
        border: '1px solid rgba(201,151,60,.2)', borderBottom: 'none',
        width: '100%', maxWidth: 600, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', animation: 'slideUp .25s ease',
      }}>
        {/* Header modal */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,151,60,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#C9973C' }}>
              Table {table.numero} — {ZONE_LABELS[table.zone] || table.zone}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(245,239,230,.4)', marginTop: 2 }}>
              Capacité : {table.capacite} pers.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: 'none', color: 'rgba(245,239,230,.6)', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

            {/* Couverts + note */}
            <div style={{ padding: '12px 20px', display: 'flex', gap: 10, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>COUVERTS</label>
                <input type="number" min="1" max={table.capacite} value={couverts}
                  onChange={e => setCouverts(e.target.value)}
                  style={{ ...inp, width: '100%' }} />
              </div>
              <div style={{ flex: 3 }}>
                <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>NOTE SPÉCIALE</label>
                <input placeholder="Allergie, cuisson, demande spéciale..." value={note}
                  onChange={e => setNote(e.target.value)}
                  style={{ ...inp, width: '100%' }} />
              </div>
            </div>

            {/* Filtre catégories */}
            <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit',
                  background: cat === c ? 'linear-gradient(135deg,#C9973C,#a85f28)' : 'rgba(255,255,255,.06)',
                  color: cat === c ? '#fff' : 'rgba(245,239,230,.55)',
                  fontWeight: cat === c ? 700 : 400,
                }}>
                  {c === 'tous' ? '🍽️ Tous' : c}
                </button>
              ))}
            </div>

            {/* Menu */}
            <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '0 20px' }}>
              {menuFiltré.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'rgba(245,239,230,.4)' }}>Aucun plat disponible</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {menuFiltré.map(plat => {
                    const qty = panier[plat.id] || 0
                    return (
                      <div key={plat.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: qty > 0 ? 'rgba(201,151,60,.08)' : 'rgba(255,255,255,.025)',
                        border: `1px solid ${qty > 0 ? 'rgba(201,151,60,.3)' : 'rgba(255,255,255,.06)'}`,
                        borderRadius: 10, padding: '10px 12px', transition: 'all .15s',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: qty > 0 ? 700 : 400, color: qty > 0 ? '#f5efe6' : 'rgba(245,239,230,.8)' }}>
                            {plat.emoji && <span style={{ marginRight: 6 }}>{plat.emoji}</span>}
                            {plat.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#C9973C', fontWeight: 600, marginTop: 2 }}>
                            {plat.price.toLocaleString()} F
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {qty > 0 && (
                            <>
                              <button onClick={() => setQty(plat.id, -1)} style={{
                                width: 28, height: 28, borderRadius: 7, border: 'none',
                                background: 'rgba(239,68,68,.15)', color: '#ef4444',
                                cursor: 'pointer', fontSize: 16, fontWeight: 700,
                              }}>−</button>
                              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, color: '#C9973C', fontSize: 14 }}>{qty}</span>
                            </>
                          )}
                          <button onClick={() => setQty(plat.id, 1)} style={{
                            width: 28, height: 28, borderRadius: 7, border: 'none',
                            background: 'rgba(201,151,60,.2)', color: '#C9973C',
                            cursor: 'pointer', fontSize: 18, fontWeight: 700,
                          }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Récap panier + bouton */}
            {lignesPanier.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(201,151,60,.15)', background: 'rgba(201,151,60,.04)', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10, maxHeight: 80, overflowY: 'auto' }}>
                  {lignesPanier.map(it => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(245,239,230,.7)' }}>
                      <span>{it.qty}× {it.name}</span>
                      <span>{(it.price * it.qty).toLocaleString()} F</span>
                    </div>
                  ))}
                </div>
                {err && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{err}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#C9973C' }}>
                    Total : {total.toLocaleString()} F
                  </div>
                  <button onClick={commander} disabled={busy} style={{
                    background: busy ? 'rgba(16,185,129,.3)' : 'linear-gradient(135deg,#10b981,#059669)',
                    border: 'none', color: 'white', padding: '10px 22px',
                    borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {busy ? <Spinner size={16} color="#fff" /> : '🍽️'}
                    {busy ? 'Envoi...' : `Envoyer en cuisine`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Carte table ───────────────────────────────────────────────────────────────
function CarteTable({ table, onCommander, onLiberer }) {
  const st = STATUS_TABLE[table.status] || STATUS_TABLE.libre
  const libre = table.status === 'libre'
  const occupee = table.status === 'occupee'

  return (
    <div style={{
      background: st.bg, border: `2px solid ${st.color}40`,
      borderRadius: 14, padding: '14px 16px', cursor: libre || occupee ? 'pointer' : 'default',
      transition: 'all .2s', position: 'relative', animation: 'fadeIn .2s ease',
    }}
      onClick={() => libre && onCommander(table)}
    >
      {/* Numéro + zone */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 22, color: st.color, lineHeight: 1 }}>
            {table.numero}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
            {table.capacite} pers.
          </div>
        </div>
        <Badge label={st.label} color={st.color} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {libre && (
          <button
            onClick={e => { e.stopPropagation(); onCommander(table) }}
            style={{
              flex: 1, background: 'rgba(16,185,129,.2)', border: '1px solid rgba(16,185,129,.4)',
              color: '#10b981', padding: '6px 8px', borderRadius: 7, fontSize: 11,
              cursor: 'pointer', fontWeight: 600,
            }}>
            ➕ Commander
          </button>
        )}
        {occupee && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onCommander(table) }}
              style={{
                flex: 1, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.4)',
                color: '#f59e0b', padding: '6px 8px', borderRadius: 7, fontSize: 11,
                cursor: 'pointer', fontWeight: 600,
              }}>
              ➕ Ajouter
            </button>
            <button
              onClick={e => { e.stopPropagation(); onLiberer(table.id, 'nettoyage') }}
              style={{
                background: 'rgba(107,114,128,.15)', border: '1px solid rgba(107,114,128,.3)',
                color: '#9ca3af', padding: '6px 8px', borderRadius: 7, fontSize: 11,
                cursor: 'pointer', fontWeight: 600,
              }}>
              🧹
            </button>
          </>
        )}
        {table.status === 'nettoyage' && (
          <button
            onClick={e => { e.stopPropagation(); onLiberer(table.id, 'libre') }}
            style={{
              flex: 1, background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)',
              color: '#10b981', padding: '6px 8px', borderRadius: 7, fontSize: 11,
              cursor: 'pointer', fontWeight: 600,
            }}>
            ✓ Prête
          </button>
        )}
      </div>
    </div>
  )
}

// ── Onglet Tables ─────────────────────────────────────────────────────────────
function TabTables({ user }) {
  const [tables,   setTables]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [zoneTab,  setZoneTab]  = useState('tous')
  const [modal,    setModal]    = useState(null) // table sélectionnée
  const [toast,    setToast]    = useState('')

  const load = useCallback(async () => {
    try {
      const qs  = user?.restaurantId ? `?restaurantId=${user.restaurantId}` : ''
      const res = await fetch(`/api/tables${qs}`)
      const d   = await res.json()
      setTables(Array.isArray(d) ? d : [])
    } catch { /* silencieux */ }
    finally { setLoading(false) }
  }, [user?.restaurantId])

  useEffect(() => { load() }, [load])

  async function libererTable(id, newStatus) {
    try {
      await fetch(`/api/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, commandeId: newStatus === 'libre' ? null : undefined }),
      })
      await load()
      setToast(newStatus === 'nettoyage' ? '🧹 Table en nettoyage' : '✅ Table libérée')
      setTimeout(() => setToast(''), 3000)
    } catch { /* silencieux */ }
  }

  function onCommandeOK() {
    setModal(null)
    setToast('✅ Commande envoyée en cuisine !')
    setTimeout(() => setToast(''), 3000)
    load()
  }

  const zones = ['tous', ...ZONES.filter(z => tables.some(t => t.zone === z))]
  const tablesFiltrees = zoneTab === 'tous' ? tables : tables.filter(t => t.zone === zoneTab)

  // Stats rapides
  const stats = {
    libres:   tables.filter(t => t.status === 'libre').length,
    occupees: tables.filter(t => t.status === 'occupee').length,
    nettoyage:tables.filter(t => t.status === 'nettoyage').length,
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: '#10b981', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 300,
          animation: 'fadeIn .2s ease', boxShadow: '0 4px 20px rgba(16,185,129,.4)',
        }}>{toast}</div>
      )}

      {/* Mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Libres',     val: stats.libres,    color: '#10b981' },
          { label: 'Occupées',   val: stats.occupees,  color: '#f59e0b' },
          { label: 'Nettoyage',  val: stats.nettoyage, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: 10, padding: '10px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: 'rgba(245,239,230,.45)', marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtre zones */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {zones.map(z => (
          <button key={z} onClick={() => setZoneTab(z)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: zoneTab === z ? 'linear-gradient(135deg,#C9973C,#a85f28)' : 'rgba(255,255,255,.06)',
            color: zoneTab === z ? '#fff' : 'rgba(245,239,230,.55)',
            fontWeight: zoneTab === z ? 700 : 400,
          }}>
            {z === 'tous' ? '🍽️ Toutes' : (ZONE_LABELS[z] || z)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : tablesFiltrees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,.4)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🪑</div>
          <p>Aucune table dans cette zone</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {tablesFiltrees
            .sort((a, b) => a.numero - b.numero)
            .map(t => (
              <CarteTable
                key={t.id}
                table={t}
                onCommander={setModal}
                onLiberer={libererTable}
              />
            ))
          }
        </div>
      )}

      {/* Modal prise de commande */}
      {modal && (
        <ModalCommandeTable
          table={modal}
          serveurNom={user?.name}
          onClose={() => setModal(null)}
          onSuccess={onCommandeOK}
        />
      )}
    </div>
  )
}

// ── Card commande (livraison / emporter) ──────────────────────────────────────
function CardCommande({ cmd, onAction, busy }) {
  const st    = STATUS_CMD[cmd.status] || STATUS_CMD.nouveau
  const tps   = tempsEcoule(cmd.createdAt)
  const total = totalCmd(cmd)
  const items = parseItems(cmd.items)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${tps?.urgent ? 'rgba(239,68,68,.3)' : 'rgba(201,151,60,.12)'}`,
      borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: '14px 16px',
      animation: 'fadeIn .25s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>{st.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{cmd.client}</span>
            {cmd.mode === 'Livraison' && <Badge label="🛵 Livraison" color="#06b6d4" />}
            {cmd.mode === 'Sur place' && <Badge label="🍽️ Sur place" color="#8B5CF6" />}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,239,230,.5)' }}>
            📞 <a href={`tel:${cmd.tel}`} style={{ color: '#06b6d4', textDecoration: 'none' }}>{cmd.tel}</a>
            {cmd.addr && <span> · 📍 {cmd.addr}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#C9973C' }}>{total.toLocaleString()} F</div>
          {tps && <div style={{ fontSize: 11, color: tps.color, marginTop: 2 }}>⏱ {tps.label}</div>}
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12, color: 'rgba(245,239,230,.7)' }}>
        {items.slice(0, 3).map((it, i) => (
          <span key={i}>{i > 0 && ' · '}{it.qty || 1}× {it.name || it.nom}</span>
        ))}
        {items.length > 3 && <span style={{ color: 'rgba(245,239,230,.4)' }}> +{items.length - 3}</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Badge label={st.label} color={st.color} bg={st.bg} />
        <div style={{ display: 'flex', gap: 6 }}>
          <a href={`tel:${cmd.tel}`} style={{
            background: 'rgba(6,182,212,.12)', border: '1px solid rgba(6,182,212,.3)',
            color: '#06b6d4', padding: '5px 10px', borderRadius: 7, fontSize: 12,
            textDecoration: 'none',
          }}>📞</a>
          {cmd.status === 'nouveau' && (
            <button onClick={() => onAction(cmd.id, 'en_cours')} disabled={busy}
              style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.4)', color: '#10b981', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              ✓ Confirmer
            </button>
          )}
          {cmd.status === 'pret' && cmd.mode === 'Livraison' && (
            <button onClick={() => onAction(cmd.id, 'en_livraison')} disabled={busy}
              style={{ background: 'rgba(6,182,212,.15)', border: '1px solid rgba(6,182,212,.4)', color: '#06b6d4', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              🛵 Envoyer
            </button>
          )}
          {cmd.status === 'en_livraison' && (
            <button onClick={() => onAction(cmd.id, 'livre')} disabled={busy}
              style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.4)', color: '#10b981', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              ✅ Livré
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card réservation ──────────────────────────────────────────────────────────
function CardReservation({ resa, onAction }) {
  const st = STATUS_RESA[resa.status] || STATUS_RESA.en_attente
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,151,60,.12)',
      borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{st.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{resa.nom}</span>
            <span style={{ fontSize: 12, color: 'rgba(245,239,230,.5)' }}>👥 {resa.personnes} pers.</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,239,230,.5)' }}>
            📞 <a href={`tel:${resa.tel}`} style={{ color: '#06b6d4', textDecoration: 'none' }}>{resa.tel}</a>
            {resa.zone && <span> · {resa.zone}</span>}
            {resa.notes && <span> · {resa.notes}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: '#C9973C', fontSize: 14 }}>{resa.heure}</div>
          <div style={{ fontSize: 11, color: 'rgba(245,239,230,.4)' }}>{resa.date}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {resa.status === 'en_attente' && (
          <button onClick={() => onAction(resa.id, 'confirmee')}
            style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.4)', color: '#10b981', padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>
            ✓ Confirmer
          </button>
        )}
        {['en_attente','confirmee'].includes(resa.status) && (
          <button onClick={() => onAction(resa.id, 'arrivee')}
            style={{ background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.4)', color: '#8B5CF6', padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>
            🎉 Arrivée
          </button>
        )}
        {['en_attente','confirmee'].includes(resa.status) && (
          <button onClick={() => onAction(resa.id, 'no_show')}
            style={{ background: 'rgba(107,114,128,.1)', border: '1px solid rgba(107,114,128,.3)', color: '#9ca3af', padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>
            👻 No-show
          </button>
        )}
        <a href={`tel:${resa.tel}`}
          style={{ background: 'rgba(6,182,212,.12)', border: '1px solid rgba(6,182,212,.3)', color: '#06b6d4', padding: '5px 10px', borderRadius: 7, fontSize: 11, textDecoration: 'none' }}>
          📞 Appeler
        </a>
      </div>
    </div>
  )
}

// ── Formulaire réservation rapide ─────────────────────────────────────────────
function FormResa({ onSuccess, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ nom: '', tel: '', date: today, heure: '12:00', personnes: 2, notes: '' })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const inp = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: '#f5efe6', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', width: '100%' }
  const lbl = { fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }

  async function submit() {
    if (!form.nom.trim() || !form.tel.trim()) { setErr('Nom et téléphone requis'); return }
    setBusy(true)
    const res  = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setErr(data.error || 'Erreur'); return }
    onSuccess(data)
  }

  return (
    <div style={{ background: 'rgba(201,151,60,.05)', border: '1px solid rgba(201,151,60,.25)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ color: '#C9973C', fontWeight: 700, fontSize: 14 }}>📅 Nouvelle réservation</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,239,230,.4)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      {err && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div><label style={lbl}>NOM *</label><input style={inp} value={form.nom} onChange={f('nom')} placeholder="Nom du client" /></div>
        <div><label style={lbl}>TÉLÉPHONE *</label><input style={inp} value={form.tel} onChange={f('tel')} placeholder="+237 6XX..." /></div>
        <div><label style={lbl}>DATE</label><input style={inp} type="date" value={form.date} onChange={f('date')} /></div>
        <div><label style={lbl}>HEURE</label><input style={inp} type="time" value={form.heure} onChange={f('heure')} /></div>
        <div><label style={lbl}>PERSONNES</label><input style={inp} type="number" min="1" max="50" value={form.personnes} onChange={f('personnes')} /></div>
        <div><label style={lbl}>NOTES</label><input style={inp} value={form.notes} onChange={f('notes')} placeholder="Anniversaire, allergie..." /></div>
      </div>
      <button onClick={submit} disabled={busy} style={{ background: 'linear-gradient(135deg,#C9973C,#a85f28)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
        {busy ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  )
}

// ── Checklist légère ──────────────────────────────────────────────────────────
function ChecklistLite({ role, restaurantId }) {
  const [data,   setData]   = useState({ templates: [], completions: [] })
  const [moment, setMoment] = useState('ouverture')
  const [checks, setChecks] = useState({})
  const [busy,   setBusy]   = useState(false)
  const [msg,    setMsg]    = useState({ type: '', text: '' })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const qs = [`date=${today}`, `moment=${moment}`, `role=${role}`, restaurantId && `restaurantId=${restaurantId}`].filter(Boolean).join('&')
    fetch(`/api/rh/checklists?${qs}`).then(r => r.json()).then(d => {
      setData(d)
      const init = {}
      d.completions?.forEach(c => c.itemsCoches?.forEach(i => { init[i.id] = i.coche }))
      setChecks(init)
    }).catch(() => {})
  }, [restaurantId, moment, today, role])

  async function valider(templateId, items) {
    setBusy(true)
    const itemsCoches = items.map(it => ({ id: it.id, label: it.label, coche: !!checks[it.id], obligatoire: it.obligatoire }))
    if (itemsCoches.filter(i => i.obligatoire && !i.coche).length > 0) {
      setMsg({ type: 'err', text: 'Points obligatoires manquants' }); setBusy(false); return
    }
    await fetch('/api/rh/checklists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, date: today, moment, itemsCoches, restaurantId }),
    })
    setMsg({ type: 'ok', text: '✅ Checklist validée !' }); setBusy(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['ouverture','fermeture'].map(m => (
          <button key={m} onClick={() => setMoment(m)} style={{
            flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13,
            background: moment === m ? 'linear-gradient(135deg,#C9973C,#a85f28)' : 'rgba(255,255,255,.05)',
            color: moment === m ? 'white' : 'rgba(245,239,230,.55)', fontFamily: 'inherit', fontWeight: moment === m ? 700 : 400,
          }}>{m === 'ouverture' ? '🌅 Ouverture' : '🌙 Fermeture'}</button>
        ))}
      </div>
      {msg.text && (
        <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'err' ? '#ef4444' : '#10b981', fontSize: 13, marginBottom: 12 }}>
          {msg.text}
        </div>
      )}
      {(data.templates?.filter(t => t.moment === moment) || []).map(tmpl => {
        const done = data.completions?.find(c => c.templateId === tmpl.id)?.complet
        return (
          <div key={tmpl.id} style={{ background: done ? 'rgba(16,185,129,.05)' : 'rgba(255,255,255,.025)', border: `1px solid ${done ? 'rgba(16,185,129,.25)' : 'rgba(201,151,60,.12)'}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: done ? '#10b981' : '#f5efe6', marginBottom: 12 }}>{done ? '✅ ' : ''}{tmpl.titre}</div>
            {tmpl.items.map(item => (
              <label key={item.id} style={{ display: 'flex', gap: 10, marginBottom: 10, cursor: done ? 'default' : 'pointer', opacity: done ? .6 : 1 }}>
                <input type="checkbox" checked={!!checks[item.id]} onChange={e => !done && setChecks(p => ({ ...p, [item.id]: e.target.checked }))}
                  disabled={done} style={{ accentColor: '#C9973C', width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: checks[item.id] ? 'rgba(245,239,230,.4)' : '#f5efe6', textDecoration: checks[item.id] ? 'line-through' : 'none' }}>
                  {item.label}{item.obligatoire && <span style={{ color: '#ef4444', marginLeft: 4, fontSize: 10 }}>*</span>}
                </span>
              </label>
            ))}
            {!done && (
              <button onClick={() => valider(tmpl.id, tmpl.items)} disabled={busy}
                style={{ background: 'linear-gradient(135deg,#C9973C,#a85f28)', border: 'none', color: 'white', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {busy ? '...' : '✓ Valider'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Signalement anonyme ───────────────────────────────────────────────────────
function SignalementLite({ restaurantId }) {
  const [form, setForm] = useState({ categorie: 'hygiene', description: '', gravite: 'normale' })
  const [msg,  setMsg]  = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)
  const inp = { width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: '#f5efe6', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }

  async function soumettre() {
    if (!form.description.trim()) { setMsg({ type: 'err', text: 'Description requise' }); return }
    setBusy(true)
    const res = await fetch('/api/rh/signalements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, restaurantId }) })
    setBusy(false)
    if (!res.ok) { setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' }); return }
    setMsg({ type: 'ok', text: '✅ Signalement envoyé anonymement à la direction. Merci.' })
    setForm({ categorie: 'hygiene', description: '', gravite: 'normale' })
  }

  return (
    <div>
      <div style={{ background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🔒 Signalement anonyme</div>
        <p style={{ fontSize: 12, color: 'rgba(245,239,230,.5)', marginBottom: 14, lineHeight: 1.5 }}>
          Votre identité n'est jamais stockée. Ce signalement va directement au propriétaire.
        </p>
        {msg.text && (
          <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'err' ? '#ef4444' : '#10b981', fontSize: 13, marginBottom: 12 }}>
            {msg.text}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={lbl}>CATÉGORIE</label>
            <select style={inp} value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))}>
              <option value="hygiene">🧹 Hygiène</option>
              <option value="conflit">⚡ Conflit</option>
              <option value="vol">🚨 Vol / détournement</option>
              <option value="securite">🔒 Sécurité</option>
              <option value="autre">💬 Autre</option>
            </select>
          </div>
          <div>
            <label style={lbl}>GRAVITÉ</label>
            <select style={inp} value={form.gravite} onChange={e => setForm(p => ({ ...p, gravite: e.target.value }))}>
              <option value="normale">Normale</option>
              <option value="grave">Grave</option>
              <option value="critique">🚨 Critique</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>DESCRIPTION *</label>
          <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Décrivez la situation de façon précise..." />
        </div>
        <button onClick={soumettre} disabled={busy}
          style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {busy ? 'Envoi...' : '⚠️ Envoyer le signalement'}
        </button>
      </div>
    </div>
  )
}

// ── Onglet Réception colis (conditionnel — permission affectable) ─────────────
function TabReception({ restaurantId }) {
  const [receptions,  setReceptions]  = useState([])
  const [bons,        setBons]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [bonId,       setBonId]       = useState('')
  const [items,       setItems]       = useState([{ article: '', qteCommandee: '', qteRecue: '', conforme: true }])
  const [observation, setObservation] = useState('')
  const [statusRec,   setStatusRec]   = useState('complete')
  const [busy,        setBusy]        = useState(false)
  const [msg,         setMsg]         = useState({ type: '', text: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = restaurantId ? `?restaurantId=${restaurantId}` : ''
      const [rRec, rBons] = await Promise.all([
        fetch(`/api/achats/receptions${qs}`),
        fetch(`/api/bons-commande?status=en_cours${restaurantId ? '&restaurantId=' + restaurantId : ''}`),
      ])
      setReceptions(rRec.ok  ? await rRec.json()  : [])
      setBons(      rBons.ok ? await rBons.json() : [])
    } catch(e) { console.error('[TabReception]', e) }
    finally { setLoading(false) }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  function updateItem(i, k, v) { setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it)) }
  function addItem()    { setItems(p => [...p, { article: '', qteCommandee: '', qteRecue: '', conforme: true }]) }
  function removeItem(i){ setItems(p => p.filter((_, idx) => idx !== i)) }

  async function soumettre() {
    if (!bonId) { setMsg({ type: 'err', text: 'Sélectionnez un bon de commande' }); return }
    const validItems = items.filter(it => it.article.trim() && it.qteRecue)
    if (validItems.length === 0) { setMsg({ type: 'err', text: 'Renseignez au moins un article reçu' }); return }
    setBusy(true)
    const res  = await fetch('/api/achats/receptions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, bonCommandeId: bonId, items: validItems, observation, status: statusRec }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Erreur serveur' }); return
    }
    setMsg({ type: 'ok', text: '✅ Réception enregistrée — stocks mis à jour' })
    setShowForm(false); setBonId(''); setItems([{ article: '', qteCommandee: '', qteRecue: '', conforme: true }]); setObservation('')
    load()
  }

  const inp = {
    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(132,204,22,.2)',
    borderRadius: 8, color: '#f5efe6', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit',
  }

  return (
    <div>
      {/* Bandeau info permission */}
      <div style={{ background: 'rgba(132,204,22,.06)', border: '1px solid rgba(132,204,22,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔑</span>
        <div>
          <div style={{ fontSize: 12, color: '#84cc16', fontWeight: 700 }}>Permission accordée : Réception marchandises</div>
          <div style={{ fontSize: 11, color: 'rgba(245,239,230,.45)', marginTop: 2 }}>Cette permission vous a été attribuée par votre manager pour aujourd'hui ou de façon permanente.</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowForm(p => !p)} style={{ background: 'linear-gradient(135deg,#84cc16,#4d7c0f)', border: 'none', color: 'white', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? '✕ Annuler' : '📦 Enregistrer une réception'}
        </button>
      </div>

      {msg.text && (
        <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(132,204,22,.08)', border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,.3)' : 'rgba(132,204,22,.3)'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'err' ? '#ef4444' : '#84cc16', fontSize: 13, marginBottom: 12 }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div style={{ background: 'rgba(132,204,22,.04)', border: '1px solid rgba(132,204,22,.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ color: '#84cc16', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📦 Réception marchandises</div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }}>BON DE COMMANDE</label>
            {bons.length > 0 ? (
              <select style={{ ...inp, width: '100%' }} value={bonId} onChange={e => setBonId(e.target.value)}>
                <option value="">— Sélectionner un bon —</option>
                {bons.map(b => <option key={b.id} value={b.id}>BC #{b.id.slice(-6)} · {b.dateCommande}</option>)}
              </select>
            ) : (
              <input style={{ ...inp, width: '100%' }} value={bonId} onChange={e => setBonId(e.target.value)} placeholder="ID du bon de commande" />
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, marginBottom: 8 }}>ARTICLES REÇUS</div>
            {items.map((it, i) => (
              <div key={i} className="serveur-reception-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input style={inp} value={it.article} onChange={e => updateItem(i,'article',e.target.value)} placeholder="Article" />
                <input style={inp} type="number" value={it.qteCommandee} onChange={e => updateItem(i,'qteCommandee',e.target.value)} placeholder="Commandé" />
                <input style={inp} type="number" value={it.qteRecue}     onChange={e => updateItem(i,'qteRecue',    e.target.value)} placeholder="Reçu" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(245,239,230,.6)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={it.conforme} onChange={e => updateItem(i,'conforme',e.target.checked)} style={{ accentColor: '#84cc16' }} />
                  OK
                </label>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={addItem} style={{ background: 'transparent', border: '1px dashed rgba(132,204,22,.3)', color: '#84cc16', padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
              + Ajouter un article
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }}>STATUT</label>
              <select style={{ ...inp, width: '100%' }} value={statusRec} onChange={e => setStatusRec(e.target.value)}>
                <option value="complete">✅ Complète</option>
                <option value="partielle">⚠️ Partielle</option>
                <option value="litige">🚨 Litige</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }}>OBSERVATION</label>
              <input style={{ ...inp, width: '100%' }} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Produit abîmé, quantité manquante..." />
            </div>
          </div>

          <button onClick={soumettre} disabled={busy} style={{ background: 'linear-gradient(135deg,#84cc16,#4d7c0f)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {busy ? 'Enregistrement...' : 'Valider la réception'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner color="#84cc16" /></div>
      ) : receptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,.4)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
          <p>Aucune réception enregistrée</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {receptions.map(r => {
            const itms = Array.isArray(r.items) ? r.items : []
            const stColor = { complete: '#10b981', partielle: '#f59e0b', litige: '#ef4444' }[r.status] || '#6b7280'
            return (
              <div key={r.id} style={{ background: 'rgba(255,255,255,.025)', border: `1px solid ${stColor}25`, borderLeft: `4px solid ${stColor}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(245,239,230,.5)', marginBottom: 4 }}>
                      BC #{r.bonCommandeId?.slice(-6)} · par {r.receptionnePar}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {itms.slice(0, 3).map((it, i) => (
                        <span key={i} style={{ fontSize: 11, background: it.conforme === false ? 'rgba(239,68,68,.1)' : 'rgba(132,204,22,.1)', color: it.conforme === false ? '#ef4444' : '#84cc16', border: `1px solid ${it.conforme === false ? 'rgba(239,68,68,.2)' : 'rgba(132,204,22,.2)'}`, padding: '2px 8px', borderRadius: 20 }}>
                          {it.article} ({it.qteRecue}/{it.qteCommandee || '?'})
                        </span>
                      ))}
                      {itms.length > 3 && <span style={{ fontSize: 11, color: 'rgba(245,239,230,.3)' }}>+{itms.length - 3}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, background: `${stColor}20`, color: stColor, border: `1px solid ${stColor}40`, padding: '2px 9px', borderRadius: 20 }}>{r.status}</span>
                    <div style={{ fontSize: 10, color: 'rgba(245,239,230,.3)', marginTop: 4 }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
                {r.observation && (
                  <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,.08)', borderRadius: 6, padding: '5px 10px' }}>⚠️ {r.observation}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet Carte (menu disponible) ────────────────────────────────────────────
function TabCarte({ restaurantId }) {
  const [menu,    setMenu]    = useState([])
  const [loading, setLoading] = useState(true)
  const [cat,     setCat]     = useState('tous')
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    const qs = restaurantId ? `?restaurantId=${restaurantId}` : ''
    fetch(`/api/menu${qs}`)
      .then(r => r.json())
      .then(d => setMenu(Array.isArray(d) ? d : (d?.items || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [restaurantId])

  const cats     = ['tous', ...new Set(menu.map(m => m.cat || m.category).filter(Boolean))]
  const filtered = menu
    .filter(m => cat === 'tous' || (m.cat || m.category) === cat)
    .filter(m => !search || m.name?.toLowerCase().includes(search.toLowerCase()))
  const actifs   = filtered.filter(m => m.actif !== false)
  const inactifs = filtered.filter(m => m.actif === false)

  function PlatRow({ plat }) {
    const dispo = plat.actif !== false
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: dispo ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.015)',
        border: `1px solid ${dispo ? 'rgba(201,151,60,.15)' : 'rgba(107,114,128,.1)'}`,
        borderLeft: `3px solid ${dispo ? '#C9973C' : '#6b7280'}`,
        borderRadius: 10, padding: '11px 14px',
        opacity: dispo ? 1 : 0.5, transition: 'opacity .2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {plat.emoji && <span style={{ fontSize: 20, flexShrink: 0 }}>{plat.emoji}</span>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: dispo ? '#f5efe6' : 'rgba(245,239,230,.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {plat.name}
              {plat.popular && (
                <span style={{ marginLeft: 6, fontSize: 9, background: 'rgba(201,151,60,.2)', color: '#C9973C', border: '1px solid rgba(201,151,60,.3)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                  ⭐ POP
                </span>
              )}
            </div>
            {plat.desc && (
              <div style={{ fontSize: 11, color: 'rgba(245,239,230,.35)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {plat.desc}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: dispo ? '#C9973C' : '#6b7280' }}>
            {(plat.price || 0).toLocaleString()} F
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: .5,
            background: dispo ? 'rgba(16,185,129,.12)' : 'rgba(107,114,128,.12)',
            color: dispo ? '#10b981' : '#6b7280',
            border: `1px solid ${dispo ? 'rgba(16,185,129,.25)' : 'rgba(107,114,128,.25)'}`,
            padding: '2px 7px', borderRadius: 10,
          }}>
            {dispo ? 'DISPO' : 'ÉPUISÉ'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none', opacity: .5 }}>🔍</span>
        <input
          placeholder="Rechercher un plat..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)',
            borderRadius: 10, color: '#f5efe6', padding: '9px 12px 9px 36px',
            fontSize: 13, fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: cat === c ? 'linear-gradient(135deg,#C9973C,#a85f28)' : 'rgba(255,255,255,.06)',
            color: cat === c ? '#fff' : 'rgba(245,239,230,.55)',
            fontWeight: cat === c ? 700 : 400,
          }}>
            {c === 'tous' ? '🍽️ Tous' : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,.4)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
          <p>Aucun plat trouvé</p>
        </div>
      ) : (
        <div>
          {actifs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#10b981', letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
                DISPONIBLES ({actifs.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actifs.map(p => <PlatRow key={p.id} plat={p} />)}
              </div>
            </div>
          )}
          {inactifs.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: '#6b7280', borderRadius: '50%', display: 'inline-block' }} />
                ÉPUISÉS ({inactifs.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {inactifs.map(p => <PlatRow key={p.id} plat={p} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Onglet En cuisine (suivi préparation par table) ───────────────────────────
function TabEnCuisine({ commandes, onNotifier, busy }) {
  const EN_PREP = ['nouveau', 'en_cours', 'en_preparation']
  const enCuisine = commandes.filter(c => EN_PREP.includes(c.status))
  const pretes    = commandes.filter(c => c.status === 'pret')
  // Ids déjà notifiés — survit aux re-renders causés par fetchData
  const [notifies, setNotifies] = useState(new Set())

  const ST = {
    nouveau:        { label: 'Nouveau',    color: '#3B82F6', bg: 'rgba(59,130,246,.12)',  dot: '🔵' },
    en_cours:       { label: 'En cuisine', color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  dot: '🟡' },
    en_preparation: { label: 'Finition',   color: '#8B5CF6', bg: 'rgba(139,92,246,.12)',  dot: '🟣' },
  }

  function tempsRestant(createdAt) {
    const min   = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
    const reste = 20 - min
    if (reste > 5)  return { label: `→ ~${reste} min`, color: '#10b981', urgent: false }
    if (reste > 0)  return { label: `→ ${reste} min`,  color: '#f59e0b', urgent: true  }
    return              { label: 'En retard !',               color: '#ef4444', urgent: true  }
  }

  function CardPrep({ cmd }) {
    const st    = ST[cmd.status] || ST.nouveau
    const tps   = tempsRestant(cmd.createdAt)
    const items = parseItems(cmd.items)
    const label = cmd.tableNumero ? `Table ${cmd.tableNumero}` : (cmd.client || '—')

    return (
      <div style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${tps.urgent ? 'rgba(239,68,68,.2)' : 'rgba(201,151,60,.1)'}`,
        borderLeft: `4px solid ${st.color}`,
        borderRadius: 12, padding: '13px 14px', animation: 'fadeIn .2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: st.color }}>{label}</span>
            {cmd.mode && (
              <span style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', background: 'rgba(255,255,255,.05)', padding: '2px 7px', borderRadius: 4 }}>
                {cmd.mode}
              </span>
            )}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
            background: `${tps.color}15`, color: tps.color, border: `1px solid ${tps.color}35`,
            animation: tps.urgent ? 'pulse 1.5s ease infinite' : undefined,
          }}>
            {tps.label}
          </span>
        </div>

        <div style={{ background: 'rgba(0,0,0,.18)', borderRadius: 8, padding: '8px 10px', marginBottom: cmd.note ? 8 : 10 }}>
          {items.length === 0
            ? <span style={{ fontSize: 12, color: 'rgba(245,239,230,.3)' }}>—</span>
            : items.map((it, i) => (
              <div key={i} style={{ fontSize: 12, color: 'rgba(245,239,230,.75)', lineHeight: 1.9 }}>
                <span style={{ color: '#C9973C', fontWeight: 700 }}>{it.qty || 1}×</span>{' '}{it.name || it.nom}
              </div>
            ))
          }
        </div>

        {cmd.note && (
          <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,.07)', borderRadius: 6, padding: '5px 9px', marginBottom: 8 }}>
            📝 {cmd.note}
          </div>
        )}

        <span style={{ fontSize: 10, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}40`, padding: '3px 9px', borderRadius: 20 }}>
          {st.dot} {st.label}
        </span>
      </div>
    )
  }

  function CardPrete({ cmd }) {
    const items = parseItems(cmd.items)
    const label = cmd.tableNumero ? `Table ${cmd.tableNumero}` : (cmd.client || '—')
    const sent  = notifies.has(cmd.id)

    async function notifier() {
      try {
        await onNotifier(cmd.id)
        setNotifies(prev => new Set([...prev, cmd.id]))
      } catch(e) { console.error('[notifier]', e) }
    }

    return (
      <div style={{
        background: 'rgba(16,185,129,.04)', border: '1px solid rgba(16,185,129,.25)',
        borderLeft: '4px solid #10b981', borderRadius: 12, padding: '13px 14px', animation: 'fadeIn .2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>{label}</span>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(245,239,230,.35)' }}>
            {new Date(cmd.updatedAt || cmd.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(245,239,230,.65)', marginBottom: 10, lineHeight: 1.8 }}>
          {items.slice(0, 4).map((it, i) => (
            <span key={i}>{i > 0 && ' · '}<strong style={{ color: '#C9973C' }}>{it.qty || 1}×</strong> {it.name || it.nom}</span>
          ))}
          {items.length > 4 && <span style={{ color: 'rgba(245,239,230,.35)' }}> +{items.length - 4}</span>}
        </div>

        <button
          onClick={notifier}
          disabled={busy || sent}
          style={{
            width: '100%',
            background: sent ? 'rgba(16,185,129,.25)' : 'linear-gradient(135deg,#10b981,#059669)',
            border: 'none', color: 'white', padding: '9px 0', borderRadius: 8,
            fontWeight: 700, fontSize: 13, cursor: busy || sent ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {sent ? '✅ Table notifiée' : '🔔 Notifier la table'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {pretes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 0 3px rgba(16,185,129,.2)' }} />
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, letterSpacing: 1.5 }}>PRÊTES À SERVIR ({pretes.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pretes.map(c => <CardPrete key={c.id} cmd={c} />)}
          </div>
        </div>
      )}

      {enCuisine.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} />
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: 1.5 }}>EN PRÉPARATION ({enCuisine.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enCuisine
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .map(c => <CardPrep key={c.id} cmd={c} />)}
          </div>
        </div>
      )}

      {pretes.length === 0 && enCuisine.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(245,239,230,.4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍🍳</div>
          <p>Aucune commande en cours en cuisine</p>
          <p style={{ fontSize: 12, marginTop: 6, color: 'rgba(245,239,230,.25)' }}>Les commandes apparaitront ici en temps réel</p>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ServeurClient({ user }) {
  const router = useRouter()
  const { can, loading: permsLoading } = usePermissions()
  const [tab,          setTab]         = useState('tables')
  const [commandes,    setCommandes]   = useState([])
  const [reservations, setReservations]= useState([])
  const [loading,      setLoading]     = useState(true)
  const [syncing,      setSyncing]     = useState(false)
  const [busy,         setBusy]        = useState(false)
  const [showResa,     setShowResa]    = useState(false)
  const [filtre,       setFiltre]      = useState('actives')
  const [now,          setNow]         = useState(new Date())
  const timerRef = useRef(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [rCmd, rResa] = await Promise.all([
        fetch('/api/commandes', { cache: 'no-store' }),
        fetch('/api/reservations', { cache: 'no-store' }),
      ])
      const [cmds, resas] = await Promise.all([rCmd.json(), rResa.json()])
      setCommandes(Array.isArray(cmds) ? cmds : (cmds?.commandes || []))
      setReservations(Array.isArray(resas) ? resas : [])
    } catch(e) { console.error(e) }
    finally { setLoading(false); setSyncing(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(() => { fetchData(true); setNow(new Date()) }, 120_000)
    timerRef.current = setInterval(() => setNow(new Date()), 60_000)
    return () => { clearInterval(iv); clearInterval(timerRef.current) }
  }, [fetchData])

  // SSE temps réel
  useSSE({
    onCommandeNouvelle: (commande) => {
      setCommandes(prev => prev.find(c => c.id === commande.id) ? prev : [commande, ...prev])
    },
    onCommandeStatus: ({ id, status }) => {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    },
    onReservationNouvelle: (reservation) => {
      setReservations(prev => prev.find(r => r.id === reservation.id) ? prev : [reservation, ...prev])
    },
    onReservationStatus: ({ id, status }) => {
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    },
  })

  async function actionCommande(id, status) {
    setBusy(true)
    try {
      await fetch(`/api/commandes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      await fetchData(true)
    } catch(e) { console.error('[actionCommande]', e) }
    finally { setBusy(false) }
  }

  async function actionReservation(id, status) {
    try {
      await fetch(`/api/reservations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      await fetchData(true)
    } catch(e) { console.error('[actionReservation]', e) }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function notifierTable(id) {
    try {
      await fetch(`/api/commandes/${id}/notifier`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      await fetchData(true)
    } catch(e) { console.error('[notifierTable]', e) }
  }

  const cmdsActives    = commandes.filter(c => !['livre','annule'].includes(c.status))
  const cmdsAffichees  = filtre === 'actives' ? cmdsActives : commandes
  const today          = new Date().toISOString().split('T')[0]
  const resaAujourdhui = reservations.filter(r => r.date === today)
  const resaActives    = resaAujourdhui.filter(r => !['annulee','no_show'].includes(r.status))

  const kpis = [
    { label: 'Commandes',      val: cmdsActives.length,                                                                   color: '#06b6d4', emoji: '📋' },
    { label: 'En livraison',   val: commandes.filter(c => c.status === 'en_livraison').length,                            color: '#C9973C', emoji: '🛵' },
    { label: 'Réservations',   val: resaActives.length,                                                                   color: '#10b981', emoji: '📅' },
    { label: 'Urgentes',       val: cmdsActives.filter(c => Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60_000) >= 30).length, color: '#ef4444', emoji: '⚠️' },
  ]

  const cmdsEnCuisine = commandes.filter(c => ['nouveau','en_cours','en_preparation','pret'].includes(c.status))
  const nbPrets       = commandes.filter(c => c.status === 'pret').length

  const TABS = [
    { id: 'tables',       label: '🚪 Tables' },
    { id: 'carte',        label: '🍽️ Menu' },
    { id: 'en_cuisine',   label: `👨‍🍳 Cuisine${nbPrets > 0 ? ` ✅${nbPrets}` : cmdsEnCuisine.length > 0 ? ` (${cmdsEnCuisine.length})` : ''}` },
    { id: 'commandes',    label: `📋 Commandes${cmdsActives.length > 0 ? ` (${cmdsActives.length})` : ''}` },
    { id: 'reservations', label: `📅 Résa${resaActives.length > 0 ? ` (${resaActives.length})` : ''}` },
    ...(can('receptionner_marchandises') ? [{ id: 'reception', label: '📦 Réception' }] : []),
    { id: 'checklist',    label: '✅ Checklist' },
    { id: 'rh',           label: '👤 RH' },
    { id: 'signalement',  label: '🔒 Signaler' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{ background: 'rgba(10,10,15,.95)', borderBottom: '1px solid rgba(201,151,60,.15)', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🍽️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#f5efe6', letterSpacing: .5 }}>Chez Maman Biya</div>
              <div style={{ fontSize: 10, color: '#06b6d4', letterSpacing: 1 }}>SERVEUR · {user?.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="serveur-clock" style={{ fontSize: 12, color: 'rgba(245,239,230,.4)' }}>
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {syncing && <Spinner size={16} />}
            <div className="serveur-dev-sig" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'rgba(245,239,230,.12)', letterSpacing: .5 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(245,239,230,.14)' }}>&lt;/&gt;</span>
              Jordan – full-Dev
            </div>
            <button onClick={logout} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Déco
            </button>
          </div>
        </header>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 16px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: `${k.color}10`, border: `1px solid ${k.color}25`, borderRadius: 10, padding: '10px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{k.emoji}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 9, color: 'rgba(245,239,230,.4)', marginTop: 1, lineHeight: 1.3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', borderBottom: '1px solid rgba(201,151,60,.1)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 13px', borderRadius: 9, border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              fontSize: 12, fontFamily: 'inherit', fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? 'linear-gradient(135deg,#C9973C,#a85f28)' : 'rgba(255,255,255,.05)',
              color: tab === t.id ? 'white' : 'rgba(245,239,230,.55)', transition: 'all .18s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Contenu */}
        <main style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>

          {tab === 'tables' && <TabTables user={user} />}

          {tab === 'commandes' && (
            loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><Spinner /></div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['actives','Actives'], ['toutes','Toutes']].map(([id, lbl]) => (
                      <button key={id} onClick={() => setFiltre(id)} style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        background: filtre === id ? 'rgba(201,151,60,.25)' : 'rgba(255,255,255,.05)',
                        color: filtre === id ? '#C9973C' : 'rgba(245,239,230,.5)',
                      }}>{lbl}</button>
                    ))}
                  </div>
                  <button onClick={() => fetchData(true)} style={{ background: 'transparent', border: '1px solid rgba(201,151,60,.2)', color: '#C9973C', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    🔄
                  </button>
                </div>
                {cmdsAffichees.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(245,239,230,.4)' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                    <p>Aucune commande en cours</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cmdsAffichees
                      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                      .map(cmd => <CardCommande key={cmd.id} cmd={cmd} onAction={actionCommande} busy={busy} />)}
                  </div>
                )}
              </div>
            )
          )}

          {tab === 'reservations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'rgba(245,239,230,.5)' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <button onClick={() => setShowResa(p => !p)} style={{ background: 'linear-gradient(135deg,#C9973C,#a85f28)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  + Réservation
                </button>
              </div>
              {showResa && (
                <FormResa
                  onSuccess={r => { setReservations(p => [r, ...p]); setShowResa(false) }}
                  onClose={() => setShowResa(false)}
                />
              )}
              {resaAujourdhui.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(245,239,230,.4)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                  <p>Aucune réservation aujourd'hui</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {resaAujourdhui
                    .sort((a, b) => a.heure.localeCompare(b.heure))
                    .map(r => <CardReservation key={r.id} resa={r} onAction={actionReservation} />)}
                </div>
              )}
            </div>
          )}

          {tab === 'carte'      && <TabCarte restaurantId={user?.restaurantId} />}

          {tab === 'en_cuisine' && (
            <TabEnCuisine
              commandes={commandes}
              onNotifier={notifierTable}
              busy={busy}
            />
          )}

          {tab === 'checklist'   && <ChecklistLite role="serveur" restaurantId={user?.restaurantId} />}
          {tab === 'reception'   && <TabReception restaurantId={user?.restaurantId} />}
          {tab === 'rh'          && <RHPanel user={user} />}
          {tab === 'signalement' && <SignalementLite restaurantId={user?.restaurantId} />}

        </main>
      </div>
    </>
  )
}
