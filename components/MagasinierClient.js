'use client'
// MagasinierClient.js — v21
// Refonte visuelle : Dashboard KPI + Design system cohérent + Health Ring

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import RHPanel from '@/components/panels/RHPanel'
import useSSE from '@/hooks/useSSE'

// ── Tokens ─────────────────────────────────────────────────────────────────────
// bg/surf/elev/txt/muted/faint sont alignés aux CSS vars de globals.css :
//   bg   → var(--ebony)       #080605
//   surf → var(--ebony-1)     #100D09
//   elev → var(--ebony-2)     #1A1410
//   txt  → var(--cream)       #f0e8d8
//   muted→ var(--cream-dim)   rgba(240,232,216,.6)
//   faint→ var(--cream-faint) rgba(240,232,216,.25)
// L'accent lime (#84cc16) reste spécifique au rôle Magasinier.
const C = {
  bg:'#080605', surf:'#100D09', elev:'#1A1410',
  lime:'#84cc16', limeDk:'#4a7c10',
  red:'#ef4444', amber:'#f59e0b', cyan:'#22d3ee', green:'#10b981', purple:'#8b5cf6',
  txt:'#f0e8d8', muted:'rgba(240,232,216,.6)', faint:'rgba(240,232,216,.25)',
  bdr:'rgba(132,204,22,.12)', bdrA:'rgba(132,204,22,.28)',
}

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:${C.bg};color:${C.txt};
    font-family:var(--font-dm),system-ui,sans-serif;-webkit-font-smoothing:antialiased;
    background-image:radial-gradient(rgba(132,204,22,.018) 1px,transparent 1px);
    background-size:22px 22px;
  }
  /* Les keyframes spin et fadeUp sont déjà dans globals.css */
  @keyframes blink   {0%,100%{opacity:1}50%{opacity:.3}}
  @keyframes glow    {0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
  @keyframes slideIn {from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:none}}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-thumb{background:rgba(132,204,22,.2);border-radius:2px}
  select,input,button{font-family:inherit}
  .kpi:hover{transform:translateY(-2px);transition:transform .18s ease;cursor:pointer}
  .lime-btn:hover{opacity:.87;transform:translateY(-1px);transition:all .15s}
  .row-h:hover{background:rgba(255,255,255,.04)!important;transition:background .12s}
  .card-h:hover{background:rgba(255,255,255,.042)!important;border-color:rgba(132,204,22,.22)!important;transition:all .15s}
  .tab-btn{transition:all .18s ease}
`

// ── Constantes métier ──────────────────────────────────────────────────────────
const URGENCE = {
  normale:{color:'#6b7280',label:'Normale'},
  urgent:{color:'#f59e0b',label:'Urgent'},
  critique:{color:'#ef4444',label:'Critique'},
}
const STATUS_DEMANDE = {
  en_attente:{color:'#6b7280',label:'En attente'},
  en_attente_admin:{color:'#8b5cf6',label:'Attente admin'},
  approuvee_manager:{color:'#10b981',label:'Approuvée ✓'},
  approuvee_admin:{color:'#10b981',label:'Approuvée ✓✓'},
  refusee:{color:'#ef4444',label:'Refusée'},
  commandee:{color:'#06b6d4',label:'Commandée'},
  recue:{color:'#84cc16',label:'Reçue'},
}
const MVT_CFG = {
  entree:    {color:'#10b981',bg:'rgba(16,185,129,.09)',border:'rgba(16,185,129,.22)',icon:'↑',label:'Entrée',    sign:'+'},
  sortie:    {color:'#ef4444',bg:'rgba(239,68,68,.09)', border:'rgba(239,68,68,.22)', icon:'↓',label:'Sortie',    sign:'−'},
  ajustement:{color:'#3b82f6',bg:'rgba(59,130,246,.09)',border:'rgba(59,130,246,.22)',icon:'↔',label:'Ajustement',sign:'~'},
  inventaire:{color:'#f59e0b',bg:'rgba(245,158,11,.09)',border:'rgba(245,158,11,.22)',icon:'≡',label:'Inventaire',sign:'='},
}
const SRC_LABEL = {
  reception:'📦 Réception',commande:'🍽️ Commande',
  manuel:'✏️ Manuel',inventaire:'📋 Inventaire',
}

// ── Composants partagés ────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{textAlign:'center',padding:48}}>
    <div style={{width:28,height:28,border:'3px solid rgba(132,204,22,.15)',borderTopColor:'#84cc16',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto'}}/>
  </div>
)

const Empty = ({icon, text}) => (
  <div style={{textAlign:'center',padding:'44px 20px',color:C.muted}}>
    <div style={{fontSize:42,marginBottom:10}}>{icon}</div>
    <p style={{fontSize:14}}>{text}</p>
  </div>
)

const Badge = ({color, label}) => (
  <span style={{fontSize:11,background:`${color}18`,color,border:`1px solid ${color}35`,padding:'2px 9px',borderRadius:20,flexShrink:0,fontWeight:500}}>
    {label}
  </span>
)

const FeedbackMsg = ({msg}) => msg?.text ? (
  <div style={{background:msg.type==='err'?'rgba(239,68,68,.07)':'rgba(132,204,22,.07)',border:`1px solid ${msg.type==='err'?'rgba(239,68,68,.28)':'rgba(132,204,22,.28)'}`,borderRadius:10,padding:'10px 14px',color:msg.type==='err'?C.red:C.lime,fontSize:13,marginBottom:14}}>
    {msg.text}
  </div>
) : null

const INP = {background:'rgba(255,255,255,.055)',border:'1px solid rgba(132,204,22,.18)',borderRadius:9,color:C.txt,padding:'9px 13px',fontSize:13,fontFamily:'inherit',width:'100%'}
const LBL = {fontSize:10,color:C.faint,letterSpacing:1.2,textTransform:'uppercase',display:'block',marginBottom:6}

// ── Signature visuelle : anneau de santé SVG ───────────────────────────────────
function HealthRing({percent, size=76}) {
  const r    = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(percent, 100) / 100 * circ)
  const col  = percent >= 80 ? C.lime : percent >= 50 ? C.amber : C.red
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={6}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{transition:'stroke-dasharray .65s ease, stroke .4s ease'}}
        />
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:13,fontWeight:900,color:col}}>{percent}%</span>
      </div>
    </div>
  )
}

// ── Onglet Dashboard ───────────────────────────────────────────────────────────
function DashboardTab({restaurantId, user, onNavigate}) {
  const [s,      setS]   = useState(null)
  const [mvts,   setMvts]= useState([])
  const [loading,setLd]  = useState(true)

  const now     = new Date()
  const greet   = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bonne après-midi' : 'Bonsoir'
  const dateStr = now.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'})

  const load = useCallback(async () => {
    setLd(true)
    try {
      const qs  = restaurantId ? `?restaurantId=${restaurantId}` : ''
      const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1)

      const [sr, dr, rr, mr] = await Promise.all([
        fetch(`/api/stocks${qs}`),
        fetch(`/api/achats/demandes${qs}`),
        fetch(`/api/achats/receptions${qs}`),
        fetch(`/api/stocks/mouvements?limit=6${restaurantId ? '&restaurantId=' + restaurantId : ''}`),
      ])
      const stocks     = sr.ok ? await sr.json() : []
      const demandes   = dr.ok ? await dr.json() : []
      const receptions = rr.ok ? await rr.json() : []
      const mData      = mr.ok ? await mr.json() : {}

      const critiques  = stocks.filter(x => x.stock <= x.seuil)
      const bas        = stocks.filter(x => x.stock <= x.seuil * 2 && x.stock > x.seuil)
      const actives    = demandes.filter(x => !['refusee','recue'].includes(x.status))
      const recMois    = receptions.filter(x => new Date(x.createdAt) >= moisDebut)
      const health     = stocks.length > 0
        ? Math.round(((stocks.length - critiques.length) / stocks.length) * 100)
        : 100

      setS({critiques, nCrit:critiques.length, nBas:bas.length,
            nTotal:stocks.length, nDem:actives.length, nRec:recMois.length, health})
      setMvts(Array.isArray(mData.mouvements) ? mData.mouvements.slice(0, 6) : [])
    } catch(e) {
      console.error('[Dashboard]', e)
    } finally { setLd(false) }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner/>
  if (!s)      return <Empty icon="⚠️" text="Impossible de charger les données"/>

  return (
    <div style={{animation:'fadeUp .25s ease'}}>

      {/* En-tête salutation */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:17,fontWeight:700}}>
          {greet}, <span style={{color:C.lime}}>{user?.name}</span> 👋
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:3,textTransform:'capitalize'}}>{dateStr}</div>
      </div>

      {/* Bannière rupture critique */}
      {s.nCrit > 0 && (
        <div onClick={() => onNavigate('stocks')} style={{
          background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.28)',
          borderLeft:'3px solid #ef4444',borderRadius:12,padding:'12px 16px',marginBottom:16,
          display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:18,animation:'blink 1.5s infinite'}}>🚨</span>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:C.red}}>
                {s.nCrit} rupture{s.nCrit > 1 ? 's' : ''} critique{s.nCrit > 1 ? 's' : ''} — action requise
              </div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                {s.critiques.slice(0, 3).map(c => c.nom).join(', ')}
                {s.nCrit > 3 ? ` +${s.nCrit - 3} autres` : ''}
              </div>
            </div>
          </div>
          <span style={{color:'rgba(239,68,68,.45)',fontSize:18}}>›</span>
        </div>
      )}

      {/* KPI 2×2 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
        {[
          {color:C.red,  icon:'🚨', val:s.nCrit, label:'Ruptures',        sub:`seuil min atteint`,    tab:'stocks',   alert:s.nCrit > 0},
          {color:C.amber,icon:'⚠️',  val:s.nBas,  label:'Stocks bas',      sub:`/${s.nTotal} articles`, tab:'stocks'},
          {color:C.cyan, icon:'🛒', val:s.nDem,  label:'Dem. actives',    sub:'en cours d\'approbation',tab:'demandes'},
          {color:C.lime, icon:'📦', val:s.nRec,  label:'Réceptions/mois', sub:'marchandises reçues',   tab:'reception'},
        ].map(k => (
          <div key={k.label} className="kpi" onClick={() => onNavigate(k.tab)} style={{
            background:C.surf, borderRadius:14,
            border:`1px solid ${k.alert ? `${k.color}38` : C.bdr}`,
            borderTop:`3px solid ${k.color}`,
            padding:'15px 16px', animation:'fadeUp .3s ease',
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <span style={{fontSize:20}}>{k.icon}</span>
              {k.alert && <div style={{width:7,height:7,borderRadius:'50%',background:k.color,animation:'glow 2s infinite'}}/>}
            </div>
            <div style={{fontWeight:900,fontSize:34,color:k.color,lineHeight:1,marginBottom:3,letterSpacing:'-1px'}}>{k.val}</div>
            <div style={{fontWeight:600,fontSize:12,color:C.txt}}>{k.label}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Anneau de santé — signature visuelle */}
      <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:14,padding:'16px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
        <HealthRing percent={s.health}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>Santé globale du stock</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>
            {s.nTotal - s.nCrit} / {s.nTotal} articles au-dessus du seuil minimum
          </div>
          <div style={{height:5,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden'}}>
            <div style={{
              width:`${s.health}%`,height:'100%',borderRadius:3,
              background: s.health >= 80
                ? `linear-gradient(90deg,${C.limeDk},${C.lime})`
                : s.health >= 50
                ? `linear-gradient(90deg,#92400e,${C.amber})`
                : `linear-gradient(90deg,#7f1d1d,${C.red})`,
              transition:'width .65s ease',
            }}/>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div style={{marginBottom:16}}>
        <div style={{...LBL,marginBottom:10}}>Actions rapides</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <button onClick={() => onNavigate('demandes')} className="lime-btn" style={{
            background:`linear-gradient(135deg,${C.lime},${C.limeDk})`,
            border:'none',color:'white',padding:'13px 14px',borderRadius:12,
            fontWeight:700,fontSize:12,textAlign:'left',cursor:'pointer',
          }}>
            <div style={{fontSize:18,marginBottom:5}}>🛒</div>
            <div>Nouvelle demande</div>
            <div style={{fontSize:10,opacity:.75,marginTop:2,fontWeight:400}}>Créer une demande d'achat</div>
          </button>
          <button onClick={() => onNavigate('reception')} className="lime-btn" style={{
            background:C.elev,border:`1px solid ${C.bdrA}`,
            color:C.lime,padding:'13px 14px',borderRadius:12,
            fontWeight:700,fontSize:12,textAlign:'left',cursor:'pointer',
          }}>
            <div style={{fontSize:18,marginBottom:5}}>📥</div>
            <div>Enregistrer réception</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2,fontWeight:400}}>Marchandises reçues</div>
          </button>
        </div>
      </div>

      {/* Mouvements récents */}
      {mvts.length > 0 && (
        <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'13px 18px',borderBottom:`1px solid ${C.bdr}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,fontWeight:600}}>Mouvements récents</span>
            <button onClick={() => onNavigate('historique')} style={{background:'none',border:'none',color:C.lime,fontSize:12,padding:0,cursor:'pointer'}}>
              Tout voir →
            </button>
          </div>
          {mvts.map((m, i) => {
            const cfg = MVT_CFG[m.type] || MVT_CFG.ajustement
            const h   = new Date(m.createdAt).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})
            return (
              <div key={m.id} className="row-h" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 18px',borderBottom:i < mvts.length - 1 ? `1px solid rgba(255,255,255,.04)` : 'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:26,height:26,borderRadius:7,background:cfg.bg,border:`1px solid ${cfg.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:cfg.color,fontWeight:800,flexShrink:0}}>
                    {cfg.icon}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{m.stockItem?.nom || '—'}</div>
                    <div style={{fontSize:11,color:C.muted}}>
                      {m.stockAvant?.toFixed(1)} → {m.stockApres?.toFixed(1)} {m.stockItem?.unite || ''}
                    </div>
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:cfg.color}}>{cfg.sign}{m.quantite}</div>
                  <div style={{fontSize:11,color:C.faint}}>{h}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Onglet Stocks ──────────────────────────────────────────────────────────────
function StocksTab({restaurantId}) {
  const [stocks,  setStocks]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre,  setFiltre]  = useState('critique')
  const [search,  setSearch]  = useState('')
  const [editId,  setEditId]  = useState(null)
  const [editVal, setEditVal] = useState('')
  const [busy,    setBusy]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stocks${restaurantId ? '?restaurantId=' + restaurantId : ''}`)
      if (!res.ok) throw new Error('Erreur ' + res.status)
      const d = await res.json()
      setStocks(Array.isArray(d) ? d : [])
    } catch(e) { console.error('[Stocks]', e) }
    finally { setLoading(false) }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function ajusterStock(id) {
    if (!editVal || isNaN(parseFloat(editVal))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/stocks/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({stock: parseFloat(editVal)}),
      })
      if (!res.ok) throw new Error()
      setEditId(null); setEditVal(''); await load()
    } catch(e) { console.error('[ajuster]', e) }
    finally { setBusy(false) }
  }

  const nCrit = stocks.filter(s => s.stock <= s.seuil).length
  const nBas  = stocks.filter(s => s.stock <= s.seuil * 2 && s.stock > s.seuil).length

  const views = {
    critique: stocks.filter(s => s.stock <= s.seuil),
    bas:      stocks.filter(s => s.stock <= s.seuil * 2 && s.stock > s.seuil),
    tous:     stocks,
  }
  const liste = (views[filtre] || stocks)
    .filter(s => !search || s.nom.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.stock / Math.max(a.seuil,1)) - (b.stock / Math.max(b.seuil,1)))

  const FILTRES = [
    {id:'critique', label:`🚨 Rupture`, count:nCrit,  color:C.red},
    {id:'bas',      label:`⚠️ Bas`,      count:nBas,   color:C.amber},
    {id:'tous',     label:`📦 Tout`,     count:stocks.length, color:C.lime},
  ]

  return (
    <div>
      {/* Bannière critique */}
      {nCrit > 0 && (
        <div style={{background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.28)',borderLeft:'3px solid #ef4444',borderRadius:12,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16,animation:'blink 1.5s infinite'}}>🚨</span>
          <span style={{color:C.red,fontWeight:700,fontSize:13}}>
            {nCrit} article{nCrit > 1 ? 's' : ''} en rupture critique — réapprovisionner dès que possible
          </span>
        </div>
      )}

      {/* Barre de filtres + recherche */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un article..."
          style={{...INP,width:190,padding:'7px 11px',fontSize:12}}/>
        {FILTRES.map(f => (
          <button key={f.id} onClick={() => setFiltre(f.id)} className="tab-btn" style={{
            padding:'7px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontFamily:'inherit',
            background: filtre === f.id ? `${f.color}1f` : 'rgba(255,255,255,.05)',
            color: filtre === f.id ? f.color : C.muted,
            fontWeight: filtre === f.id ? 700 : 400,
            boxShadow: filtre === f.id ? `inset 0 0 0 1px ${f.color}40` : 'none',
          }}>
            {f.label} <span style={{opacity:.7}}>({f.count})</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner/> : liste.length === 0 ? (
        <Empty icon="📦" text={filtre === 'critique' ? 'Aucune rupture 🎉' : filtre === 'bas' ? 'Tous les stocks sont bons ✓' : 'Aucun article trouvé'}/>
      ) : liste.map(s => {
        const pct     = s.seuil > 0 ? Math.min((s.stock / s.seuil) * 100, 100) : 100
        const crit    = s.stock <= s.seuil
        const bas     = !crit && s.stock <= s.seuil * 2
        const barCol  = crit ? C.red : bas ? C.amber : C.lime
        const gradBg  = crit
          ? `linear-gradient(90deg,#7f1d1d,${C.red})`
          : bas
          ? `linear-gradient(90deg,#92400e,${C.amber})`
          : `linear-gradient(90deg,${C.limeDk},${C.lime})`

        return (
          <div key={s.id} className="card-h" style={{
            background:'rgba(255,255,255,.025)',
            border:`1px solid ${crit ? 'rgba(239,68,68,.22)' : bas ? 'rgba(245,158,11,.15)' : C.bdr}`,
            borderLeft:`4px solid ${barCol}`,
            borderRadius:12,padding:'14px 16px',marginBottom:9,animation:'fadeUp .2s ease',
          }}>
            {/* En-tête article */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{s.nom}</div>
                <div style={{fontSize:11,color:C.faint,marginTop:2}}>{s.cat} · seuil : {s.seuil} {s.unite}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:900,fontSize:22,color:barCol,lineHeight:1,letterSpacing:'-0.5px'}}>
                  {s.stock} <span style={{fontSize:11,fontWeight:400,color:C.muted}}>{s.unite}</span>
                </div>
                {crit && <div style={{fontSize:10,color:C.red,fontWeight:700,marginTop:2,animation:'blink 1s infinite'}}>RUPTURE</div>}
                {bas  && <div style={{fontSize:10,color:C.amber,fontWeight:700,marginTop:2}}>STOCK BAS</div>}
              </div>
            </div>

            {/* Barre de progression */}
            <div style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:10,color:C.faint}}>Niveau de stock</span>
                <span style={{fontSize:10,fontWeight:700,color:barCol}}>{Math.round(pct)}%</span>
              </div>
              <div style={{height:7,background:'rgba(255,255,255,.06)',borderRadius:4,overflow:'hidden'}}>
                <div style={{width:`${pct}%`,height:'100%',background:gradBg,borderRadius:4,transition:'width .4s ease'}}/>
              </div>
            </div>

            {/* Actions */}
            {editId === s.id ? (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="number" min="0" value={editVal} onChange={e => setEditVal(e.target.value)}
                  style={{...INP,width:100,padding:'6px 10px',fontSize:12}} placeholder="Qté" autoFocus/>
                <span style={{fontSize:12,color:C.muted}}>{s.unite}</span>
                <button onClick={() => ajusterStock(s.id)} disabled={busy}
                  style={{background:'rgba(132,204,22,.15)',border:'1px solid rgba(132,204,22,.4)',color:C.lime,padding:'6px 13px',borderRadius:7,fontSize:12,cursor:'pointer',fontWeight:600}}>
                  ✓ Valider
                </button>
                <button onClick={() => {setEditId(null); setEditVal('')}}
                  style={{background:'transparent',border:'1px solid rgba(255,255,255,.1)',color:C.muted,padding:'6px 10px',borderRadius:7,fontSize:12,cursor:'pointer'}}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => {setEditId(s.id); setEditVal(String(s.stock))}}
                style={{background:'rgba(132,204,22,.08)',border:'1px solid rgba(132,204,22,.22)',color:C.lime,padding:'5px 14px',borderRadius:7,fontSize:11,cursor:'pointer',fontWeight:600}}>
                ✏️ Ajuster le stock
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Onglet Demandes d'achat ────────────────────────────────────────────────────
function DemandesTab({restaurantId, userName}) {
  const [demandes, setDemandes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({article:'',quantite:'',unite:'kg',montantEstime:'',motif:'',urgence:'normale'})
  const [busy,     setBusy]     = useState(false)
  const [msg,      setMsg]      = useState({type:'',text:''})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/achats/demandes${restaurantId ? '?restaurantId=' + restaurantId : ''}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setDemandes(Array.isArray(d) ? d : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function creer() {
    if (!form.article.trim() || !form.quantite) {setMsg({type:'err',text:'Article et quantité requis'}); return}
    setBusy(true)
    const res  = await fetch('/api/achats/demandes', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,restaurantId})})
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {setMsg({type:'err',text:data.error}); return}
    setMsg({type:'ok',text:`✅ Demande envoyée pour "${form.article}"`})
    setForm({article:'',quantite:'',unite:'kg',montantEstime:'',motif:'',urgence:'normale'})
    setShowForm(false); load()
  }

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}))
  const actives  = demandes.filter(d => !['refusee','recue'].includes(d.status))
  const archives = demandes.filter(d => ['refusee','recue'].includes(d.status))

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <button onClick={() => setShowForm(p => !p)} className="lime-btn" style={{background:showForm?'rgba(255,255,255,.07)':`linear-gradient(135deg,${C.lime},${C.limeDk})`,border:showForm?'1px solid rgba(255,255,255,.12)':'none',color:showForm?C.muted:'white',padding:'9px 18px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer'}}>
          {showForm ? '✕ Annuler' : '+ Nouvelle demande'}
        </button>
      </div>

      <FeedbackMsg msg={msg}/>

      {showForm && (
        <div style={{background:'rgba(132,204,22,.04)',border:`1px solid ${C.bdrA}`,borderRadius:14,padding:'18px 16px',marginBottom:18}}>
          <div style={{color:C.lime,fontWeight:700,fontSize:14,marginBottom:16}}>🛒 Nouvelle demande d'achat</div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:10}}>
            <div><label style={LBL}>ARTICLE *</label><input style={INP} value={form.article} onChange={f('article')} placeholder="ex: Huile de palme"/></div>
            <div><label style={LBL}>URGENCE</label>
              <select style={INP} value={form.urgence} onChange={f('urgence')}>
                <option value="normale">Normale</option>
                <option value="urgent">⚡ Urgent</option>
                <option value="critique">🚨 Critique</option>
              </select>
            </div>
          </div>
          <div className="mag-demande-qty-row" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
            <div><label style={LBL}>QUANTITÉ *</label><input style={INP} type="number" min="0" value={form.quantite} onChange={f('quantite')}/></div>
            <div><label style={LBL}>UNITÉ</label>
              <select style={INP} value={form.unite} onChange={f('unite')}>
                {['kg','g','L','cl','unité','carton','sac','bouteille','boîte'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label style={LBL}>MONTANT ESTIMÉ (FCFA)</label><input style={INP} type="number" min="0" value={form.montantEstime} onChange={f('montantEstime')} placeholder="5 000"/></div>
          </div>
          <div style={{marginBottom:16}}>
            <label style={LBL}>MOTIF / JUSTIFICATION</label>
            <input style={INP} value={form.motif} onChange={f('motif')} placeholder="Pourquoi cette demande ?"/>
          </div>
          <button onClick={creer} disabled={busy} className="lime-btn" style={{background:`linear-gradient(135deg,${C.lime},${C.limeDk})`,border:'none',color:'white',padding:'10px 22px',borderRadius:9,fontWeight:700,fontSize:13,cursor:'pointer'}}>
            {busy ? 'Envoi en cours...' : 'Soumettre au manager'}
          </button>
        </div>
      )}

      {loading ? <Spinner/> : (
        <>
          {actives.length === 0 && archives.length === 0 ? (
            <Empty icon="🛒" text='Aucune demande. Cliquez "+ Nouvelle demande" pour commencer.'/>
          ) : (
            <>
              {actives.map(d => {
                const urg = URGENCE[d.urgence] || URGENCE.normale
                const sta = STATUS_DEMANDE[d.status] || {color:'#6b7280',label:d.status}
                return (
                  <div key={d.id} className="card-h" style={{background:'rgba(255,255,255,.025)',border:`1px solid ${C.bdr}`,borderLeft:`4px solid ${urg.color}`,borderRadius:12,padding:'13px 15px',marginBottom:9}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div>
                        <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:5,flexWrap:'wrap'}}>
                          <span style={{fontWeight:700,fontSize:14}}>{d.article}</span>
                          <Badge color={urg.color} label={urg.label}/>
                          <Badge color={sta.color} label={sta.label}/>
                        </div>
                        <div style={{fontSize:12,color:C.muted}}>
                          {d.quantite} {d.unite}
                          {d.montantEstime ? ` · ~${d.montantEstime.toLocaleString()} FCFA` : ''}
                          {d.motif ? ` · ${d.motif}` : ''}
                        </div>
                        <div style={{fontSize:11,color:C.faint,marginTop:4}}>
                          {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    {d.status === 'refusee' && d.motifRefus && (
                      <div style={{marginTop:9,padding:'7px 11px',background:'rgba(239,68,68,.07)',borderRadius:7,fontSize:12,color:C.red}}>
                        Motif refus : {d.motifRefus}
                      </div>
                    )}
                  </div>
                )
              })}
              {archives.length > 0 && (
                <div style={{marginTop:18,paddingTop:14,borderTop:`1px solid rgba(255,255,255,.06)`}}>
                  <div style={{...LBL,marginBottom:10}}>ARCHIVES</div>
                  {archives.slice(0, 5).map(d => {
                    const sta = STATUS_DEMANDE[d.status] || {color:'#6b7280',label:d.status}
                    return (
                      <div key={d.id} className="row-h" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',borderBottom:`1px solid rgba(255,255,255,.04)`,opacity:.6}}>
                        <span style={{fontSize:13}}>{d.article} · {d.quantite} {d.unite}</span>
                        <Badge color={sta.color} label={sta.label}/>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Onglet Réception marchandises ──────────────────────────────────────────────
function ReceptionTab({restaurantId}) {
  const [receptions, setReceptions] = useState([])
  const [bons,       setBons]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [bonId,      setBonId]      = useState('')
  const [items,      setItems]      = useState([{article:'',qteCommandee:'',qteRecue:'',conforme:true}])
  const [observation,setObservation]= useState('')
  const [statusRec,  setStatusRec]  = useState('complete')
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState({type:'',text:''})

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
    } catch(e) { console.error('[Receptions]', e) }
    finally { setLoading(false) }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  function updateItem(i,k,v) { setItems(p => p.map((it,idx) => idx===i ? {...it,[k]:v} : it)) }
  function addItem()          { setItems(p => [...p, {article:'',qteCommandee:'',qteRecue:'',conforme:true}]) }
  function removeItem(i)      { setItems(p => p.filter((_,idx) => idx!==i)) }

  async function soumettre() {
    if (!bonId) {setMsg({type:'err',text:'Sélectionnez un bon de commande'}); return}
    const valid = items.filter(it => it.article.trim() && it.qteRecue)
    if (!valid.length) {setMsg({type:'err',text:'Renseignez au moins un article reçu'}); return}
    setBusy(true)
    const res  = await fetch('/api/achats/receptions', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId,bonCommandeId:bonId,items:valid,observation,status:statusRec})})
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {setMsg({type:'err',text:data.error}); return}
    setMsg({type:'ok',text:'✅ Réception enregistrée — stocks mis à jour'})
    setShowForm(false); setBonId(''); setItems([{article:'',qteCommandee:'',qteRecue:'',conforme:true}]); setObservation(''); load()
  }

  const iStyle = {...INP,padding:'8px 10px',fontSize:12}

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <button onClick={() => setShowForm(p => !p)} className="lime-btn" style={{background:showForm?'rgba(255,255,255,.07)':`linear-gradient(135deg,${C.lime},${C.limeDk})`,border:showForm?`1px solid rgba(255,255,255,.12)`:'none',color:showForm?C.muted:'white',padding:'9px 18px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer'}}>
          {showForm ? '✕ Annuler' : '📦 Enregistrer une réception'}
        </button>
      </div>

      <FeedbackMsg msg={msg}/>

      {showForm && (
        <div style={{background:'rgba(132,204,22,.04)',border:`1px solid ${C.bdrA}`,borderRadius:14,padding:'18px 16px',marginBottom:18}}>
          <div style={{color:C.lime,fontWeight:700,fontSize:14,marginBottom:16}}>📦 Réception marchandises</div>

          <div style={{marginBottom:12}}>
            <label style={LBL}>BON DE COMMANDE</label>
            {bons.length > 0 ? (
              <select style={INP} value={bonId} onChange={e => setBonId(e.target.value)}>
                <option value="">— Sélectionner un bon —</option>
                {bons.map(b => <option key={b.id} value={b.id}>BC #{b.id.slice(-6)} · {b.dateCommande}</option>)}
              </select>
            ) : (
              <input style={INP} value={bonId} onChange={e => setBonId(e.target.value)} placeholder="ID du bon de commande"/>
            )}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{...LBL,marginBottom:8}}>ARTICLES REÇUS</div>
            {items.map((it, i) => (
              <div key={i} className="mag-reception-row" style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto auto',gap:6,marginBottom:6,alignItems:'center'}}>
                <input style={iStyle} value={it.article}       onChange={e => updateItem(i,'article',e.target.value)}       placeholder="Article"/>
                <input style={iStyle} type="number" value={it.qteCommandee} onChange={e => updateItem(i,'qteCommandee',e.target.value)} placeholder="Commandé"/>
                <input style={iStyle} type="number" value={it.qteRecue}     onChange={e => updateItem(i,'qteRecue',e.target.value)}     placeholder="Reçu"/>
                <label style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:C.muted,cursor:'pointer'}}>
                  <input type="checkbox" checked={it.conforme} onChange={e => updateItem(i,'conforme',e.target.checked)} style={{accentColor:C.lime}}/> OK
                </label>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.28)',color:C.red,width:28,height:28,borderRadius:6,cursor:'pointer',fontSize:13}}>✕</button>
                )}
              </div>
            ))}
            <button onClick={addItem} style={{background:'transparent',border:`1px dashed ${C.bdrA}`,color:C.lime,padding:'6px 14px',borderRadius:7,fontSize:12,cursor:'pointer',marginTop:4}}>
              + Ajouter un article
            </button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10,marginBottom:16}}>
            <div>
              <label style={LBL}>STATUT</label>
              <select style={INP} value={statusRec} onChange={e => setStatusRec(e.target.value)}>
                <option value="complete">✅ Complète</option>
                <option value="partielle">⚠️ Partielle</option>
                <option value="litige">🚨 Litige</option>
              </select>
            </div>
            <div>
              <label style={LBL}>OBSERVATION</label>
              <input style={INP} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Produit abîmé, quantité manquante..."/>
            </div>
          </div>

          <button onClick={soumettre} disabled={busy} className="lime-btn" style={{background:`linear-gradient(135deg,${C.lime},${C.limeDk})`,border:'none',color:'white',padding:'10px 22px',borderRadius:9,fontWeight:700,fontSize:13,cursor:'pointer'}}>
            {busy ? 'Enregistrement...' : 'Valider la réception'}
          </button>
        </div>
      )}

      {loading ? <Spinner/> : receptions.length === 0 ? (
        <Empty icon="📦" text="Aucune réception enregistrée"/>
      ) : receptions.map(r => {
        const itms   = Array.isArray(r.items) ? r.items : []
        const stCol  = {complete:C.green,partielle:C.amber,litige:C.red}[r.status] || '#6b7280'
        const stLbl  = {complete:'✅ Complète',partielle:'⚠️ Partielle',litige:'🚨 Litige'}[r.status] || r.status
        return (
          <div key={r.id} className="card-h" style={{background:'rgba(255,255,255,.025)',border:`1px solid ${stCol}22`,borderLeft:`4px solid ${stCol}`,borderRadius:12,padding:'13px 15px',marginBottom:9}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:7}}>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:5}}>BC #{r.bonCommandeId?.slice(-6)} · par {r.receptionnePar}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {itms.slice(0, 3).map((it, i) => (
                    <span key={i} style={{fontSize:11,background:it.conforme===false?'rgba(239,68,68,.1)':'rgba(132,204,22,.1)',color:it.conforme===false?C.red:C.lime,border:`1px solid ${it.conforme===false?'rgba(239,68,68,.2)':'rgba(132,204,22,.2)'}`,padding:'2px 8px',borderRadius:20}}>
                      {it.article} ({it.qteRecue}/{it.qteCommandee || '?'})
                    </span>
                  ))}
                  {itms.length > 3 && <span style={{fontSize:11,color:C.faint}}>+{itms.length - 3}</span>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <Badge color={stCol} label={stLbl}/>
                <div style={{fontSize:10,color:C.faint,marginTop:5}}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</div>
              </div>
            </div>
            {r.observation && (
              <div style={{fontSize:12,color:C.amber,background:'rgba(245,158,11,.07)',borderRadius:7,padding:'6px 11px',marginTop:4}}>⚠️ {r.observation}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Onglet Historique mouvements ───────────────────────────────────────────────
function HistoriqueTab({restaurantId}) {
  const [data,    setData]    = useState({mouvements:[],stats:{}})
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('7j')
  const [filtre,  setFiltre]  = useState('tous')
  const [search,  setSearch]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (restaurantId)    p.set('restaurantId', restaurantId)
      if (filtre !== 'tous') p.set('type', filtre)
      if (periode !== 'tout') {
        const d = new Date(); d.setDate(d.getDate() - (periode === '7j' ? 7 : 30))
        p.set('from', d.toISOString().split('T')[0])
      }
      p.set('limit','200')
      const res = await fetch(`/api/stocks/mouvements?${p}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setData({mouvements:Array.isArray(d.mouvements)?d.mouvements:[], stats:d.stats||{}})
    } catch(e) { console.error('[Historique]',e); setData({mouvements:[],stats:{}}) }
    finally { setLoading(false) }
  }, [restaurantId, filtre, periode])

  useEffect(() => { load() }, [load])

  const filtres = data.mouvements.filter(m => !search || m.stockItem?.nom?.toLowerCase().includes(search.toLowerCase()))
  const parJour = filtres.reduce((acc,m) => {
    const j = new Date(m.createdAt).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})
    if (!acc[j]) acc[j] = []; acc[j].push(m); return acc
  }, {})

  const s = data.stats
  const statCards = [
    {label:'Entrées',    color:C.green, count:s.totalEntrees    ||0, vol:s.volumeEntrees ||0, icon:'↑'},
    {label:'Sorties',    color:C.red,   count:s.totalSorties    ||0, vol:s.volumeSorties ||0, icon:'↓'},
    {label:'Ajustements',color:'#3b82f6',count:s.totalAjustements||0, vol:null,               icon:'↔'},
  ]

  return (
    <div>
      {!loading && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
          {statCards.map(c => (
            <div key={c.label} style={{background:`${c.color}0e`,border:`1px solid ${c.color}22`,borderTop:`2px solid ${c.color}`,borderRadius:12,padding:'12px 14px',textAlign:'center'}}>
              <div style={{fontSize:11,color:c.color,fontWeight:700,marginBottom:2}}>{c.icon} {c.label}</div>
              <div style={{fontWeight:900,fontSize:22,color:c.color,lineHeight:1}}>{c.count}</div>
              {c.vol !== null && <div style={{fontSize:10,color:C.faint,marginTop:2}}>{c.vol.toFixed(1)} u.</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',gap:7,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Article..."
          style={{...INP,width:150,padding:'7px 11px',fontSize:12}}/>
        {[{id:'7j',l:'7 j'},{id:'30j',l:'30 j'},{id:'tout',l:'Tout'}].map(p => (
          <button key={p.id} onClick={() => setPeriode(p.id)} style={{padding:'6px 12px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,background:periode===p.id?`rgba(132,204,22,.18)`:'rgba(255,255,255,.05)',color:periode===p.id?C.lime:C.muted,fontWeight:periode===p.id?700:400}}>
            {p.l}
          </button>
        ))}
        {[{id:'tous',l:'Tous',c:C.txt},{id:'entree',l:'↑ Entrées',c:C.green},{id:'sortie',l:'↓ Sorties',c:C.red},{id:'ajustement',l:'↔ Ajust.',c:'#3b82f6'}].map(f => (
          <button key={f.id} onClick={() => setFiltre(f.id)} style={{padding:'6px 12px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,background:filtre===f.id?`${f.c}18`:'rgba(255,255,255,.05)',color:filtre===f.id?f.c:C.muted,fontWeight:filtre===f.id?700:400}}>
            {f.l}
          </button>
        ))}
      </div>

      {loading ? <Spinner/> : filtres.length === 0 ? (
        <Empty icon="📋" text="Aucun mouvement sur cette période"/>
      ) : Object.entries(parJour).map(([jour, mvts]) => (
        <div key={jour} style={{marginBottom:22}}>
          <div style={{...LBL,marginBottom:9,paddingLeft:28}}>{jour}</div>
          <div style={{position:'relative',paddingLeft:26}}>
            <div style={{position:'absolute',left:9,top:8,bottom:8,width:1,background:'rgba(132,204,22,.14)',borderRadius:1}}/>
            {mvts.map(m => {
              const cfg   = MVT_CFG[m.type] || MVT_CFG.ajustement
              const heure = new Date(m.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
              return (
                <div key={m.id} style={{position:'relative',background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:11,padding:'10px 13px',marginBottom:8,animation:'fadeUp .2s ease'}}>
                  <div style={{position:'absolute',left:-18,top:'50%',transform:'translateY(-50%)',width:8,height:8,borderRadius:'50%',background:cfg.color,boxShadow:`0 0 6px ${cfg.color}80`}}/>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}>
                        <span style={{fontWeight:700,fontSize:13}}>{m.stockItem?.nom || m.stockItemId?.slice(-8)}</span>
                        <Badge color={cfg.color} label={cfg.label}/>
                        {m.source && <span style={{fontSize:10,color:C.faint}}>{SRC_LABEL[m.source]||m.source}</span>}
                      </div>
                      <div style={{fontSize:11,color:C.muted,display:'flex',alignItems:'center',gap:5}}>
                        <span>{m.stockAvant?.toFixed(2)}</span>
                        <span style={{color:C.faint}}>→</span>
                        <span style={{color:cfg.color,fontWeight:600}}>{m.stockApres?.toFixed(2)} {m.stockItem?.unite||''}</span>
                      </div>
                      {(m.note || m.auteur) && <div style={{fontSize:10,color:C.faint,marginTop:3}}>{m.auteur}{m.note?` · ${m.note}`:''}</div>}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontWeight:800,fontSize:15,color:cfg.color}}>{cfg.sign}{m.quantite % 1 === 0 ? m.quantite : m.quantite.toFixed(2)}</div>
                      <div style={{fontSize:10,color:C.faint,marginTop:2}}>{heure}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {!loading && filtres.length >= 200 && (
        <div style={{textAlign:'center',padding:'8px 0',fontSize:11,color:C.faint}}>
          200 mouvements affichés · réduire la période pour plus de précision
        </div>
      )}
    </div>
  )
}

// ── Checklist inline ───────────────────────────────────────────────────────────
function ChecklistInline({role, restaurantId, userName}) {
  const [data,    setData]    = useState({templates:[],completions:[]})
  const [loading, setLoading] = useState(true)
  const [moment,  setMoment]  = useState('ouverture')
  const [checks,  setChecks]  = useState({})
  const [busy,    setBusy]    = useState(false)
  const [msg,     setMsg]     = useState({type:'',text:''})
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    const qs = [`date=${today}`,`moment=${moment}`,`role=${role}`,restaurantId&&`restaurantId=${restaurantId}`].filter(Boolean).join('&')
    const res = await fetch(`/api/rh/checklists?${qs}`)
    const d   = await res.json()
    setData(d)
    const init = {}
    if (Array.isArray(d.completions)) d.completions.forEach(c => {if (Array.isArray(c.itemsCoches)) c.itemsCoches.forEach(i => {init[i.id]=i.coche})})
    setChecks(init); setLoading(false)
  }, [restaurantId, moment, today, role])

  useEffect(() => { load() }, [load])

  async function valider(templateId, items) {
    setBusy(true)
    const itemsCoches = items.map(it => ({id:it.id,label:it.label,coche:!!checks[it.id],obligatoire:it.obligatoire}))
    const manquants   = itemsCoches.filter(i => i.obligatoire && !i.coche)
    if (manquants.length) {setMsg({type:'err',text:`${manquants.length} point(s) obligatoire(s) manquants`}); setBusy(false); return}
    await fetch('/api/rh/checklists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId,date:today,moment,itemsCoches,restaurantId})})
    setMsg({type:'ok',text:`✅ Checklist ${moment} validée !`})
    setBusy(false); load()
  }

  const tmplsMoment = data.templates?.filter(t => t.moment === moment) || []

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['ouverture','fermeture'].map(m => (
          <button key={m} onClick={() => setMoment(m)} className="tab-btn" style={{flex:1,padding:'9px',borderRadius:9,border:'none',cursor:'pointer',fontSize:13,background:moment===m?`linear-gradient(135deg,${C.lime},${C.limeDk})`:'rgba(255,255,255,.05)',color:moment===m?'white':C.muted,fontWeight:moment===m?700:400}}>
            {m === 'ouverture' ? '🌅 Ouverture' : '🌙 Fermeture'}
          </button>
        ))}
      </div>

      <FeedbackMsg msg={msg}/>

      {loading ? <Spinner/> : tmplsMoment.map(tmpl => {
        const done    = data.completions?.find(c => c.templateId === tmpl.id)?.complet
        const checked = tmpl.items.filter(it => checks[it.id]).length
        return (
          <div key={tmpl.id} style={{background:done?'rgba(132,204,22,.04)':'rgba(255,255,255,.025)',border:`1px solid ${done?C.bdrA:C.bdr}`,borderRadius:14,padding:'16px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h4 style={{color:done?C.lime:C.txt,fontSize:14,fontWeight:700,margin:0}}>{done?'✅ ':''}{tmpl.titre}</h4>
              <span style={{fontSize:12,color:C.muted}}>{checked}/{tmpl.items.length}</span>
            </div>
            <div style={{height:5,background:'rgba(255,255,255,.06)',borderRadius:3,marginBottom:14,overflow:'hidden'}}>
              <div style={{width:`${(checked/tmpl.items.length)*100}%`,height:'100%',background:C.lime,borderRadius:3,transition:'width .3s'}}/>
            </div>
            {tmpl.items.map(item => (
              <label key={item.id} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10,cursor:done?'default':'pointer',opacity:done?.65:1}}>
                <input type="checkbox" checked={!!checks[item.id]} onChange={e => !done&&setChecks(p=>({...p,[item.id]:e.target.checked}))} disabled={done} style={{accentColor:C.lime,width:16,height:16,flexShrink:0,marginTop:1}}/>
                <span style={{fontSize:13,color:checks[item.id]?C.muted:C.txt,textDecoration:checks[item.id]?'line-through':'none'}}>
                  {item.label}{item.obligatoire&&<span style={{color:C.red,marginLeft:4,fontSize:10}}>*</span>}
                </span>
              </label>
            ))}
            {!done && (
              <button onClick={() => valider(tmpl.id,tmpl.items)} disabled={busy} className="lime-btn" style={{background:`linear-gradient(135deg,${C.lime},${C.limeDk})`,border:'none',color:'white',padding:'9px 20px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',marginTop:4}}>
                {busy?'…':'✓ Valider la checklist'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function MagasinierClient({user}) {
  const router = useRouter()
  const [tab, setTab] = useState('dashboard')

  async function logout() {
    await fetch('/api/auth/logout', {method:'POST'})
    router.push('/admin/login')
  }

  const {connected: sseConnected} = useSSE({
    onStockAlerte: (alerte) => { /* géré dans StocksTab via load() */ },
  })

  const TABS = [
    {id:'dashboard', icon:'🏠', label:'Accueil'},
    {id:'stocks',    icon:'📦', label:'Stocks'},
    {id:'historique',icon:'📋', label:'Historique'},
    {id:'demandes',  icon:'🛒', label:'Demandes'},
    {id:'reception', icon:'🚚', label:'Réceptions'},
    {id:'checklist', icon:'✅', label:'Checklist'},
    {id:'rh',        icon:'👤', label:'Mon RH'},
  ]

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header style={{
          background:'rgba(8,6,5,.96)',
          borderBottom:`1px solid ${C.bdr}`,
          padding:'0 20px',height:60,
          display:'flex',alignItems:'center',justifyContent:'space-between',
          position:'sticky',top:0,zIndex:100,backdropFilter:'blur(16px)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* Dot vert animé SSE */}
            <div style={{width:10,height:10,borderRadius:'50%',background:sseConnected?C.lime:'#4b5563',boxShadow:sseConnected?`0 0 8px ${C.lime}80`:'none',flexShrink:0}}/>
            <div>
              <div style={{fontWeight:800,fontSize:14,letterSpacing:.3}}>
                Chez Maman <span style={{color:C.lime}}>Biya</span>
              </div>
              <div style={{fontSize:10,color:C.faint,letterSpacing:1.1,textTransform:'uppercase'}}>
                Magasinier
              </div>
            </div>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{background:'rgba(132,204,22,.1)',border:`1px solid ${C.bdrA}`,borderRadius:20,padding:'4px 12px',fontSize:12,color:C.lime,fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {user?.name}
            </div>
            <div className="mag-dev-sig" style={{display:'flex',alignItems:'center',gap:4,fontSize:9,color:'rgba(132,204,22,.18)',letterSpacing:.5}}>
              <span style={{fontFamily:'monospace',fontSize:10,color:'rgba(132,204,22,.22)'}}>&lt;/&gt;</span>
              Jordan – full-Dev
            </div>
            <button onClick={logout} style={{background:'transparent',border:'1px solid rgba(239,68,68,.28)',color:C.red,padding:'5px 12px',borderRadius:7,fontSize:12,cursor:'pointer',transition:'border-color .15s'}}>
              Déco
            </button>
          </div>
        </header>

        {/* ── Barre d'onglets ─────────────────────────────────────────────── */}
        <nav style={{
          display:'flex',gap:4,padding:'10px 16px',
          borderBottom:`1px solid ${C.bdr}`,
          overflowX:'auto',WebkitOverflowScrolling:'touch',scrollbarWidth:'none',
          background:'rgba(8,6,5,.7)',backdropFilter:'blur(8px)',
          position:'sticky',top:60,zIndex:90,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="tab-btn" style={{
              flexShrink:0,display:'flex',alignItems:'center',gap:6,
              padding:'7px 13px',borderRadius:9,border:'none',cursor:'pointer',
              fontSize:12,fontFamily:'inherit',fontWeight:tab===t.id?700:400,
              whiteSpace:'nowrap',
              background: tab === t.id
                ? `linear-gradient(135deg,${C.lime},${C.limeDk})`
                : 'rgba(255,255,255,.045)',
              color: tab === t.id ? 'white' : C.muted,
            }}>
              <span style={{fontSize:14}}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Contenu ─────────────────────────────────────────────────────── */}
        <main style={{flex:1,padding:'16px 20px',overflowY:'auto',maxWidth:720,width:'100%',margin:'0 auto'}}>
          {tab === 'dashboard'  && <DashboardTab   restaurantId={user?.restaurantId} user={user} onNavigate={setTab}/>}
          {tab === 'stocks'     && <StocksTab       restaurantId={user?.restaurantId}/>}
          {tab === 'historique' && <HistoriqueTab   restaurantId={user?.restaurantId}/>}
          {tab === 'demandes'   && <DemandesTab     restaurantId={user?.restaurantId} userName={user?.name}/>}
          {tab === 'reception'  && <ReceptionTab    restaurantId={user?.restaurantId}/>}
          {tab === 'checklist'  && <ChecklistInline role="magasinier" restaurantId={user?.restaurantId} userName={user?.name}/>}
          {tab === 'rh'         && <RHPanel user={user}/>}
        </main>
      </div>
    </>
  )
}
