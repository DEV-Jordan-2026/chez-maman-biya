'use client'

import { useState, useEffect, useCallback } from 'react'

const ZONES = ['salle', 'terrasse', 'vip']
const ZONE_LABELS = { salle: '🏠 Salle', terrasse: '🌿 Terrasse', vip: '⭐ VIP' }

const STATUS_TABLE = {
  libre:     { label: 'Libre',     color: 'var(--success)', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)' },
  occupee:   { label: 'Occupée',   color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)' },
  reservee:  { label: 'Réservée',  color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  nettoyage: { label: 'Nettoyage', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)' },
}

// ── Modale commande sur table ─────────────────────────────────────────────────
function ModaleCommandeTable({ table, menu, onClose, onCreated }) {
  const [items, setItems]         = useState({}) // { menuItemId: qty }
  const [nbCouverts, setCouverts] = useState(1)
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  const cats = [...new Set(menu.map(p => p.cat))]
  const lignes = Object.entries(items)
    .map(([id, qty]) => ({ plat: menu.find(p => p.id === parseInt(id)), qty }))
    .filter(l => l.plat && l.qty > 0)
  const total = lignes.reduce((s, l) => s + l.plat.price * l.qty, 0)

  function set(id, delta) {
    setItems(prev => {
      const q = Math.max(0, (prev[id] || 0) + delta)
      const n = { ...prev }
      if (q === 0) delete n[id]; else n[id] = q
      return n
    })
  }

  async function envoyer() {
    if (lignes.length === 0) { setErr('Ajoutez au moins un plat'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        tableId: table.id,
        items: lignes.map(l => ({ id: l.plat.id, name: l.plat.name, price: l.plat.price, qty: l.qty })),
        nbCouverts, note: note || null,
      }
      const res = await fetch('/api/commandes-table', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erreur'); setSaving(false); return }
      onCreated(data)
    } catch { setErr('Erreur réseau. Veuillez réessayer.') }
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#141008',border:'1px solid rgba(201,151,60,.3)',borderRadius:16,width:'100%',maxWidth:520,maxHeight:'90vh',overflow:'auto',padding:24 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <div>
            <div style={{ fontWeight:800,fontSize:16,color:'var(--gold)' }}>🍽️ Table {table.numero}</div>
            <div style={{ fontSize:11,opacity:.4 }}>{ZONE_LABELS[table.zone]} · {table.capacite} couverts max</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'var(--cream-faint)',fontSize:22,cursor:'pointer' }}>×</button>
        </div>

        {/* Nb couverts */}
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:18,padding:'10px 14px',background:'rgba(255,255,255,.03)',borderRadius:10 }}>
          <span style={{ fontSize:12,opacity:.5,flex:1 }}>Nombre de couverts</span>
          <button onClick={() => setCouverts(c => Math.max(1,c-1))} style={btnSmall}>−</button>
          <span style={{ fontSize:16,fontWeight:700,minWidth:24,textAlign:'center' }}>{nbCouverts}</span>
          <button onClick={() => setCouverts(c => c+1)} style={{ ...btnSmall, background:'rgba(201,151,60,.15)',color:'var(--gold)' }}>+</button>
        </div>

        {/* Menu par catégorie */}
        {cats.map(cat => (
          <div key={cat} style={{ marginBottom:16 }}>
            <div style={{ fontSize:11,opacity:.35,letterSpacing:1.5,marginBottom:8 }}>{cat.toUpperCase()}</div>
            {menu.filter(p => p.cat === cat).map(plat => {
              const qty = items[plat.id] || 0
              return (
                <div key={plat.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(201,151,60,.06)' }}>
                  <span style={{ fontSize:18,flexShrink:0 }}>{plat.emoji}</span>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:qty>0?700:400 }}>{plat.name}</div>
                    <div style={{ fontSize:11,color:'var(--gold)' }}>{plat.price.toLocaleString('fr-FR')} FCFA</div>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    {qty > 0 ? (<>
                      <button onClick={() => set(plat.id,-1)} style={btnSmall}>−</button>
                      <span style={{ fontSize:14,fontWeight:700,minWidth:16,textAlign:'center' }}>{qty}</span>
                      <button onClick={() => set(plat.id,1)} style={{ ...btnSmall,background:'var(--gold)',color:'#fff',border:'none' }}>+</button>
                    </>) : (
                      <button onClick={() => set(plat.id,1)} style={{ padding:'4px 12px',borderRadius:6,border:'1px solid rgba(201,151,60,.3)',background:'transparent',color:'var(--gold)',fontSize:11,cursor:'pointer' }}>Ajouter</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ marginBottom:14 }}>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Instructions pour la cuisine (allergies, cuisson…)" rows={2}
            style={{ width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,151,60,.2)',borderRadius:8,color:'var(--cream)',padding:'8px 12px',fontSize:12,resize:'none',fontFamily:'inherit' }} />
        </div>

        {err && <div style={{ color:'var(--danger)',fontSize:12,marginBottom:10 }}>⚠️ {err}</div>}

        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:'transparent',border:'1px solid rgba(201,151,60,.2)',color:'var(--cream-faint)',padding:10,borderRadius:8,cursor:'pointer',fontSize:13 }}>Annuler</button>
          <button onClick={envoyer} disabled={saving||lignes.length===0} style={{ flex:2,background:'linear-gradient(135deg,var(--gold),#a85f28)',border:'none',color:'#fff',padding:10,borderRadius:8,fontSize:13,fontWeight:700,cursor:saving?'default':'pointer' }}>
            {saving ? '⏳…' : `✅ Envoyer en cuisine · ${total.toLocaleString('fr-FR')} FCFA`}
          </button>
        </div>
      </div>
    </div>
  )
}

const btnSmall = { width:28,height:28,borderRadius:6,background:'rgba(255,255,255,.06)',border:'1px solid rgba(201,151,60,.2)',color:'var(--cream)',fontSize:16,cursor:'pointer',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center' }

// ── Modale détail table occupée ────────────────────────────────────────────────
function ModaleTableOccupee({ table, menu, onClose, onRefresh }) {
  const [commande, setCmd] = useState(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')

  useEffect(() => {
    fetch(`/api/commandes-table?tableId=${table.id}`)
      .then(r => r.json())
      .then(data => { setCmd(Array.isArray(data) ? data[0] : null); setLoading(false) })
  }, [table.id])

  const total = commande && Array.isArray(commande.items)
    ? commande.items.reduce((s,it) => s+(it.price||0)*(it.qty||1), 0) : 0

  async function fermer() {
    if (!confirm('Clôturer cette commande de table ?')) return
    setAction('ferme')
    await fetch(`/api/commandes-table/${commande.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'fermer' }),
    })
    onRefresh(); onClose()
  }

  async function liberer() {
    await fetch(`/api/tables/${table.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status:'nettoyage', commandeId: null }),
    })
    onRefresh(); onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#141008',border:'1px solid rgba(239,68,68,.3)',borderRadius:16,width:'100%',maxWidth:420,padding:24 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <div style={{ fontWeight:800,fontSize:16,color:'var(--danger)' }}>🔴 Table {table.numero} — Occupée</div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'var(--cream-faint)',fontSize:22,cursor:'pointer' }}>×</button>
        </div>
        {loading ? <div style={{ textAlign:'center',padding:30,opacity:.3 }}>Chargement…</div> : !commande ? (
          <div style={{ textAlign:'center',padding:30,opacity:.3 }}>Aucune commande active</div>
        ) : (<>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11,opacity:.4,marginBottom:8 }}>COMMANDE {commande.id}</div>
            {commande.items?.map((it,i) => (
              <div key={i} style={{ display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4 }}>
                <span style={{ opacity:.7 }}>{it.qty}× {it.name}</span>
                <span style={{ color:'var(--gold)' }}>{((it.price||0)*(it.qty||1)).toLocaleString('fr-FR')} FCFA</span>
              </div>
            ))}
            <div style={{ borderTop:'1px dashed rgba(201,151,60,.2)',marginTop:10,paddingTop:10,display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:16 }}>
              <span>Total</span><span style={{ color:'var(--success)' }}>{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={fermer} style={{ flex:1,background:'linear-gradient(135deg,#10b981,#059669)',border:'none',color:'#fff',padding:10,borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer' }}>
              ✅ Fermer & libérer
            </button>
            <button onClick={liberer} style={{ flex:1,background:'rgba(139,92,246,.1)',border:'1px solid rgba(139,92,246,.3)',color:'#8b5cf6',padding:10,borderRadius:8,fontSize:12,cursor:'pointer' }}>
              🧹 Nettoyage
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}

// ── Panel principal ────────────────────────────────────────────────────────────
export default function PlanSallePanel({ user, menu }) {
  const [tables, setTables]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [zoneActive, setZone]   = useState('salle')
  const [modal, setModal]       = useState(null) // { type: 'commande'|'occupee', table }
  const [nouvellTable, setNT]   = useState({ numero:'', zone:'salle', capacite:4 })
  const [ajoutMode, setAjout]   = useState(false)
  const [feedback, setFb]       = useState('')
  const [erreur, setErreur]     = useState('')
  const isSuperAdmin            = user?.role === 'super_admin'

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/tables')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setTables(Array.isArray(data) ? data : [])
      setErreur('')
    } catch (e) {
      setErreur('Impossible de charger les tables. Vérifiez votre connexion.')
      console.error('[PlanSallePanel fetchTables]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTables(); const iv = setInterval(fetchTables, 20_000); return () => clearInterval(iv) }, [fetchTables])

  function fb(msg) { setFb(msg); setTimeout(() => setFb(''), 3000) }

  async function ajouterTable() {
    if (!nouvellTable.numero) return
    try {
      const res = await fetch('/api/tables', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(nouvellTable),
      })
      if (res.ok) { fetchTables(); setNT({ numero:'', zone:'salle', capacite:4 }); setAjout(false); fb('✅ Table ajoutée') }
      else { const d = await res.json(); fb('❌ ' + (d.error || 'Erreur')) }
    } catch (e) {
      fb('❌ Impossible d\'ajouter la table. Vérifiez votre connexion.')
      console.error('[PlanSallePanel ajouterTable]', e)
    }
  }

  async function supprimerTable(id) {
    if (!confirm('Supprimer cette table ?')) return
    try {
      const res = await fetch(`/api/tables/${id}`, { method:'DELETE' })
      if (res.ok) { fetchTables(); fb('🗑️ Table supprimée') }
      else fb('❌ Impossible de supprimer cette table.')
    } catch (e) {
      fb('❌ Impossible de supprimer cette table. Vérifiez votre connexion.')
      console.error('[PlanSallePanel supprimerTable]', e)
    }
  }

  async function changerStatus(id, status) {
    try {
      await fetch(`/api/tables/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status }),
      })
      fetchTables()
    } catch (e) {
      fb('❌ Impossible de mettre à jour le statut de la table.')
      console.error('[PlanSallePanel changerStatus]', e)
    }
  }

  const tablesFiltrees = tables.filter(t => t.zone === zoneActive)
  const stats = {
    libres:    tables.filter(t => t.status === 'libre').length,
    occupees:  tables.filter(t => t.status === 'occupee').length,
    reservees: tables.filter(t => t.status === 'reservee').length,
    nettoyage: tables.filter(t => t.status === 'nettoyage').length,
  }

  if (loading) return <div style={{ textAlign:'center',padding:'60px 0',opacity:.3 }}>Chargement du plan de salle…</div>
  if (erreur)  return <div style={{ padding: 40, color: '#f87171', textAlign: 'center' }}>{erreur}</div>

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24 }}>
        {[
          { label:'Libres',    val:stats.libres,    color:'var(--success)' },
          { label:'Occupées',  val:stats.occupees,  color:'var(--danger)' },
          { label:'Réservées', val:stats.reservees, color:'var(--warning)' },
          { label:'Nettoyage', val:stats.nettoyage, color:'#8b5cf6' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--ebony-2)',border:`1px solid ${s.color}20`,borderRadius:12,padding:'14px 16px',textAlign:'center' }}>
            <div style={{ fontSize:22,fontWeight:800,color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11,opacity:.4,marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {feedback && <div style={{ background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,color:'var(--success)' }}>{feedback}</div>}

      {/* Sélecteur zone */}
      <div style={{ display:'flex',gap:8,marginBottom:20 }}>
        {ZONES.map(z => (
          <button key={z} onClick={() => setZone(z)} style={{
            padding:'6px 16px',borderRadius:20,fontSize:12,cursor:'pointer',
            border:`1px solid ${zoneActive===z ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`,
            background: zoneActive===z ? 'rgba(201,151,60,.1)' : 'transparent',
            color: zoneActive===z ? 'var(--gold)' : 'var(--cream-faint)',
          }}>{ZONE_LABELS[z]} ({tables.filter(t=>t.zone===z).length})</button>
        ))}
        <button onClick={() => setAjout(a => !a)} style={{ marginLeft:'auto',padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid rgba(201,151,60,.3)',background:'rgba(201,151,60,.06)',color:'var(--gold)' }}>
          {ajoutMode ? '✕ Annuler' : '+ Ajouter table'}
        </button>
        <button
          onClick={() => {
            // Ouvre une page qui imprime tous les QR des tables de la zone active
            const ids = tables.filter(t => t.zone === zoneActive).map(t => t.id)
            if (ids.length === 0) return
            // Ouvre en séquence chaque QR print (le navigateur bloque les pop-ups multiples)
            // → On génère une page HTML consolidée
            const baseUrl = window.location.origin
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR Codes — ${ZONE_LABELS[zoneActive]}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#fff}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:16px}
.card{border:2px solid #c9973c;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}
.num{font-size:24px;font-weight:900;margin-bottom:8px}.qr{width:160px;height:160px}
.cta{font-size:11px;color:#c9973c;font-weight:700;margin-top:8px}
@media print{.grid{gap:8px;padding:8px}}</style></head>
<body><div class="grid">${ids.map(id => {
  const t = tables.find(x => x.id === id)
  return `<div class="card"><div class="num">Table ${t.numero}</div>
<img class="qr" src="${baseUrl}/api/tables/${id}/qr?size=160" alt="QR ${t.numero}"/>
<div class="cta">📱 Scanner pour commander</div></div>`
}).join('')}</div><script>window.onload=()=>window.print()<\/script></body></html>`
            const w = window.open('', '_blank')
            w.document.write(html)
            w.document.close()
          }}
          style={{ padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.04)',color:'rgba(240,232,216,.6)' }}>
          🖨️ Imprimer QR
        </button>
      </div>

      {/* Formulaire ajout */}
      {ajoutMode && (
        <div style={{ background:'rgba(201,151,60,.04)',border:'1px solid rgba(201,151,60,.2)',borderRadius:12,padding:16,marginBottom:20,display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end' }}>
          <div>
            <label style={lbl}>N° TABLE</label>
            <input type="number" value={nouvellTable.numero} onChange={e=>setNT(p=>({...p,numero:e.target.value}))} style={inp} placeholder="1" />
          </div>
          <div>
            <label style={lbl}>ZONE</label>
            <select value={nouvellTable.zone} onChange={e=>setNT(p=>({...p,zone:e.target.value}))} style={{ ...inp,background:'rgba(30,20,10,.95)' }}>
              {ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>CAPACITÉ</label>
            <input type="number" value={nouvellTable.capacite} onChange={e=>setNT(p=>({...p,capacite:e.target.value}))} style={inp} placeholder="4" />
          </div>
          <button onClick={ajouterTable} style={{ background:'linear-gradient(135deg,var(--gold),#a85f28)',border:'none',color:'#fff',padding:'9px 18px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer' }}>
            Ajouter
          </button>
        </div>
      )}

      {/* Grille tables */}
      {tablesFiltrees.length === 0 ? (
        <div style={{ textAlign:'center',padding:'60px 0',opacity:.25 }}>Aucune table dans cette zone</div>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14 }}>
          {tablesFiltrees.map(table => {
            const s = STATUS_TABLE[table.status] || STATUS_TABLE.libre
            return (
              <div key={table.id} style={{ background:s.bg,border:`2px solid ${s.border}`,borderRadius:14,padding:18,cursor:'pointer',transition:'transform .15s',textAlign:'center', position:'relative' }}
                   onClick={() => {
                     if (table.status === 'libre') setModal({ type:'commande', table })
                     else if (table.status === 'occupee') setModal({ type:'occupee', table })
                   }}>
                <div style={{ fontSize:28,marginBottom:6 }}>🪑</div>
                <div style={{ fontSize:18,fontWeight:800,color:s.color }}>T{table.numero}</div>
                <div style={{ fontSize:11,opacity:.5,marginTop:2 }}>{table.capacite} couverts</div>
                <div style={{ marginTop:8,background:s.bg,color:s.color,border:`1px solid ${s.border}`,borderRadius:6,padding:'3px 0',fontSize:10,fontWeight:700 }}>
                  {s.label}
                </div>
                {/* Bouton QR */}
                <button
                  onClick={e => { e.stopPropagation(); setModal({ type:'qr', table }) }}
                  title="Afficher le QR code"
                  style={{ marginTop:8,width:'100%',background:'rgba(201,151,60,.08)',border:'1px solid rgba(201,151,60,.25)',color:'#c9973c',padding:'5px 0',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:700 }}>
                  📱 QR code
                </button>
                {/* Actions rapides librer / nettoyage */}
                {table.status === 'nettoyage' && (
                  <button onClick={e => { e.stopPropagation(); changerStatus(table.id,'libre') }} style={{ marginTop:6,width:'100%',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',color:'var(--success)',padding:'5px 0',borderRadius:6,fontSize:11,cursor:'pointer' }}>
                    ✓ Prête
                  </button>
                )}
                {isSuperAdmin && table.status === 'libre' && (
                  <button onClick={e => { e.stopPropagation(); supprimerTable(table.id) }} style={{ position:'absolute',top:6,right:6,background:'none',border:'none',color:'rgba(239,68,68,.4)',fontSize:14,cursor:'pointer' }}>×</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Légende */}
      <div style={{ display:'flex',gap:16,marginTop:24,flexWrap:'wrap',opacity:.5 }}>
        {Object.entries(STATUS_TABLE).map(([k,v]) => (
          <div key={k} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11 }}>
            <span style={{ width:10,height:10,borderRadius:2,background:v.color,display:'inline-block' }}/>
            {v.label}
          </div>
        ))}
      </div>

      {/* Modales */}
      {modal?.type === 'commande' && (
        <ModaleCommandeTable
          table={modal.table} menu={menu}
          onClose={() => setModal(null)}
          onCreated={() => { setModal(null); fetchTables(); fb('✅ Commande envoyée en cuisine') }}
        />
      )}
      {modal?.type === 'occupee' && (
        <ModaleTableOccupee
          table={modal.table} menu={menu}
          onClose={() => setModal(null)}
          onRefresh={fetchTables}
        />
      )}

      {/* Modale QR code */}
      {modal?.type === 'qr' && (
        <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
             onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div style={{ background:'#141008',border:'1px solid rgba(201,151,60,.3)',borderRadius:20,padding:28,width:'100%',maxWidth:360,textAlign:'center' }}>
            <div style={{ fontWeight:800,fontSize:16,color:'#c9973c',marginBottom:4 }}>📱 Table {modal.table.numero}</div>
            <div style={{ fontSize:12,color:'rgba(240,232,216,.4)',marginBottom:20 }}>
              {modal.table.zone} · {modal.table.capacite} couverts
            </div>
            {/* QR SVG via img tag — simple et efficace */}
            <img
              src={`/api/tables/${modal.table.id}/qr?size=220`}
              alt={`QR Table ${modal.table.numero}`}
              width={220} height={220}
              style={{ borderRadius:12,border:'4px solid #fff',display:'block',margin:'0 auto 20px' }}
            />
            <div style={{ fontSize:11,color:'rgba(240,232,216,.35)',marginBottom:20,wordBreak:'break-all' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/table/${modal.table.id}` : ''}
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button
                onClick={() => window.open(`/api/tables/${modal.table.id}/qr?format=print`,'_blank')}
                style={{ flex:1,padding:'12px 0',background:'rgba(201,151,60,.12)',border:'1px solid rgba(201,151,60,.35)',color:'#c9973c',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                🖨️ Imprimer
              </button>
              <button
                onClick={() => setModal(null)}
                style={{ flex:1,padding:'12px 0',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',color:'rgba(240,232,216,.6)',borderRadius:10,fontSize:13,cursor:'pointer' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl = { fontSize:10,color:'var(--cream-faint)',letterSpacing:1,display:'block',marginBottom:4 }
const inp = { background:'rgba(255,255,255,.05)',border:'1px solid rgba(201,151,60,.2)',borderRadius:8,color:'var(--cream)',padding:'8px 12px',fontSize:13,width:90 }
