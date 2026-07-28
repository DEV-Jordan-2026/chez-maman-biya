'use client'
// ManagerDashboard.js — v12 LUXURY · Chez Maman Biya

import { useState, useEffect, useCallback } from 'react'

// ── SVG Icon helper ────────────────────────────────────────────────────────────
function Ico({ d, size = 15, stroke = 'currentColor', sw = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', flexShrink:0 }}>
      {(Array.isArray(d) ? d : [d]).map((seg, i) => <path key={i} d={seg} />)}
    </svg>
  )
}

// ── Pill statut ────────────────────────────────────────────────────────────────
const CMD_STATUS = {
  nouveau:        { label:'À valider',    color:'#3B82F6', next:null },
  en_cours:       { label:'En cuisine',   color:'#F59E0B', next:'en_preparation' },
  en_preparation: { label:'En prépa',     color:'#8B5CF6', next:'pret' },
  pret:           { label:'Prêt',         color:'#22C55E', next:null },
  en_livraison:   { label:'En livraison', color:'#22C55E', next:'livre' },
  livre:          { label:'Livré',        color:'#6B7280', next:null },
  annule:         { label:'Annulé',       color:'#EF4444', next:null },
}

function StatusPill({ status }) {
  const s = CMD_STATUS[status] || CMD_STATUS.nouveau
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 9px', borderRadius:20,
      background:`${s.color}15`, color:s.color,
      border:`1px solid ${s.color}30`,
      fontSize:10, fontWeight:700, letterSpacing:.4, textTransform:'uppercase',
      whiteSpace:'nowrap',
    }}>{s.label}</span>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, color = 'var(--gold)', alert = false, index = 0 }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), index * 75); return () => clearTimeout(t) }, [index])
  return (
    <div style={{
      background: alert ? `${color}0d` : 'var(--ebony-2)',
      border: `1px solid ${alert ? `${color}50` : 'var(--border-gold)'}`,
      borderRadius: 14, padding: '18px 20px',
      opacity: vis ? 1 : 0,
      transform: vis ? 'none' : 'translateY(16px)',
      transition: `opacity .5s ${index*.08}s ease, transform .5s ${index*.08}s cubic-bezier(.22,1,.36,1), border-color .2s`,
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}45`; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.3)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = alert ? `${color}50` : 'var(--border-gold)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {alert && (
        <div style={{ position:'absolute', top:10, right:10, width:7, height:7, borderRadius:'50%', background:color, animation:'alertPulse 1.5s ease infinite' }} />
      )}
      <div style={{ width:34, height:34, borderRadius:9, background:`${color}18`, border:`1px solid ${color}28`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, color }}>
        <Ico d={icon} size={15} stroke={color} />
      </div>
      <div key={String(value)} style={{ fontSize:24, fontWeight:800, color, lineHeight:1, letterSpacing:-.5, animation:vis?'countUp .45s cubic-bezier(.22,1,.36,1)':'none' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:10, color, opacity:.65, marginTop:3, fontWeight:600 }}>{sub}</div>}
      <div style={{ fontSize:11, color:'var(--cream-faint)', marginTop:5 }}>{label}</div>
    </div>
  )
}

// ── Ligne commande ─────────────────────────────────────────────────────────────
function LigneCommande({ cmd, onUpdate, onValidate }) {
  const [showRefus, setShowRefus] = useState(false)
  const [motif,     setMotif]     = useState('')
  const [busy,      setBusy]      = useState(false)
  const s    = CMD_STATUS[cmd.status] || CMD_STATUS.nouveau
  const heure = cmd.createdAt ? new Date(cmd.createdAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '–'
  const isPaieEnLigne = ['cinetpay_confirme','cinetpay'].includes(cmd.paiement)

  async function accepter() { setBusy(true); await onValidate(cmd.id,'accepter',null); setBusy(false) }
  async function refuser()  {
    if (!motif.trim()) return
    setBusy(true); await onValidate(cmd.id,'refuser',motif); setShowRefus(false); setBusy(false)
  }

  return (
    <div style={{ padding:'11px 0', borderBottom:'1px solid var(--border-subtle)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <StatusPill status={cmd.status} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cmd.client}</div>
          <div style={{ fontSize:10, color:'var(--cream-faint)', marginTop:1 }}>
            #{cmd.id} · {heure} · {cmd.mode || 'Livraison'}
          </div>
        </div>
        <span style={{ fontWeight:800, color:'var(--success)', fontSize:13, flexShrink:0 }}>
          {(cmd.total||0).toLocaleString('fr-FR')} F
        </span>

        {/* Boutons action */}
        {cmd.status === 'nouveau' && !isPaieEnLigne && (
          <div style={{ display:'flex', gap:5, flexShrink:0 }}>
            <button onClick={accepter} disabled={busy} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(34,197,94,.35)', background:'rgba(34,197,94,.1)', color:'var(--success)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(34,197,94,.2)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(34,197,94,.1)'}
            >
              {busy ? <span style={{width:10,height:10,border:'1.5px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',display:'inline-block',animation:'spin 1s linear infinite'}}/> : <Ico d="M5 13l4 4L19 7" size={12} sw={2.5} />}
            </button>
            <button onClick={() => setShowRefus(v=>!v)} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(239,68,68,.3)', background:'rgba(239,68,68,.07)', color:'var(--danger)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,.15)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,.07)'}
            >
              <Ico d="M6 18L18 6M6 6l12 12" size={12} sw={2.5} />
            </button>
          </div>
        )}
        {cmd.status === 'nouveau' && isPaieEnLigne && (
          <span style={{ fontSize:10, color:'var(--success)', fontWeight:700, background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.2)', borderRadius:4, padding:'2px 7px' }}>Payé</span>
        )}
        {s.next && (
          <button onClick={() => { setBusy(true); onUpdate(cmd.id, s.next).finally(()=>setBusy(false)) }} disabled={busy}
            style={{ width:28, height:28, borderRadius:7, border:`1px solid ${s.color}35`, background:`${s.color}10`, color:s.color, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .15s' }}
            onMouseEnter={e=>e.currentTarget.style.background=`${s.color}22`}
            onMouseLeave={e=>e.currentTarget.style.background=`${s.color}10`}
          >
            {busy ? <span style={{width:10,height:10,border:'1.5px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',display:'inline-block',animation:'spin 1s linear infinite'}}/> : <Ico d="M5 12h14M12 5l7 7-7 7" size={12} sw={2.5} />}
          </button>
        )}
      </div>

      {/* Modale refus inline */}
      {showRefus && (
        <div style={{ marginTop:8, padding:'10px 12px', background:'rgba(239,68,68,.05)', border:'1px solid rgba(239,68,68,.15)', borderRadius:8, animation:'fadeIn .2s ease' }}>
          <div style={{ fontSize:10, color:'var(--cream-faint)', marginBottom:7, letterSpacing:.5 }}>Motif du refus</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
            {['Rupture stock','Hors rayon','Fermé','Doublon'].map(m => (
              <button key={m} onClick={()=>setMotif(m)} style={{
                padding:'3px 9px', borderRadius:6, fontSize:10, cursor:'pointer',
                border:`1px solid ${motif===m?'var(--danger)':'rgba(239,68,68,.2)'}`,
                background:motif===m?'rgba(239,68,68,.12)':'transparent',
                color:motif===m?'var(--danger)':'var(--cream-faint)',
                transition:'all .15s', fontFamily:'var(--font-dm)',
              }}>{m}</button>
            ))}
          </div>
          <button onClick={refuser} disabled={!motif||busy} style={{
            padding:'5px 16px', borderRadius:6, fontSize:11, fontWeight:700,
            background:motif?'rgba(239,68,68,.75)':'rgba(239,68,68,.2)',
            border:'none', color:'#fff', cursor:motif?'pointer':'not-allowed',
            fontFamily:'var(--font-dm)', transition:'background .15s',
          }}>
            Confirmer le refus
          </button>
        </div>
      )}
    </div>
  )
}

// ── Dashboard principal ────────────────────────────────────────────────────────
export default function ManagerDashboard({ commandes, reservations, onUpdateStatus, onLocalUpdate }) {
  const [livreurs,  setLivreurs]  = useState([])
  const [session,   setSession]   = useState(null)
  const [tables,    setTables]    = useState([])
  const [alertes,   setAlertes]   = useState([])
  const [feedback,  setFeedback]  = useState('')

  const showFeedback = (msg, ok=true) => { setFeedback({ msg, ok }); setTimeout(()=>setFeedback(''), 3500) }

  useEffect(() => {
    const load = () => {
      fetch('/api/livreurs').then(r=>r.json()).then(d=>setLivreurs(Array.isArray(d)?d:[])).catch(()=>{})
      fetch('/api/caisse').then(r=>r.json()).then(d=>setSession(d||null)).catch(()=>{})
      fetch('/api/tables').then(r=>r.json()).then(d=>setTables(Array.isArray(d)?d:[])).catch(()=>{})
    }
    load()
    const iv = setInterval(load, 20_000)
    return () => clearInterval(iv)
  }, [])

  async function validerCommande(id, action, motif) {
    const res = await fetch(`/api/commandes/${id}/valider`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action, motif }),
    })
    if (res.ok) {
      showFeedback(action==='accepter' ? 'Commande acceptée' : 'Commande refusée', action==='accepter')
      // onLocalUpdate : mise à jour React uniquement, sans appel API (l'API /valider a déjà été appelée)
      const updateFn = onLocalUpdate || onUpdateStatus
      updateFn(id, action==='accepter' ? 'en_cours' : 'annule')
    }
  }

  const today    = new Date().toLocaleDateString('fr-CA')
  const cmdJour  = commandes.filter(c => c.createdAt && new Date(c.createdAt).toLocaleDateString('fr-CA')===today)
  const encaisses = cmdJour.filter(c => c.status==='livre')
  const caJour   = encaisses.reduce((s,c) => s+(c.total||0), 0)
  const aValider = commandes.filter(c => c.status==='nouveau' && !['cinetpay_confirme','cinetpay'].includes(c.paiement))
  const enCours  = commandes.filter(c => ['en_cours','en_preparation'].includes(c.status))
  const prets    = commandes.filter(c => c.status==='pret')
  const resaJour = reservations.filter(r => r.date===today)
  const resaOK   = resaJour.filter(r => ['confirmee','arrivee'].includes(r.status))
  const livDispos = livreurs.filter(l => l.status==='disponible').length
  const livCourse = livreurs.filter(l => l.status==='en_course').length
  const tablesOcc = tables.filter(t => t.status==='occupee').length
  const tablesNett= tables.filter(t => t.status==='nettoyage').length
  const panierMoyen = encaisses.length > 0 ? Math.round(caJour/encaisses.length) : 0

  const cmdActives = commandes.filter(c => !['livre','annule'].includes(c.status))
    .sort((a,b) => (a.createdAt||'').localeCompare(b.createdAt||''))

  // Alertes
  useEffect(() => {
    const a = []
    if (!session)            a.push({ level:'error', msg:'Caisse non ouverte — veuillez l\'ouvrir avant de commencer le service', icon:'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' })
    if (aValider.length>0)   a.push({ level:'warn',  msg:`${aValider.length} commande${aValider.length>1?'s':''} en attente de validation`, icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' })
    if (prets.length>2)      a.push({ level:'warn',  msg:`${prets.length} commandes prêtes non récupérées`, icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' })
    if (livDispos===0 && cmdActives.some(c=>c.mode?.toLowerCase().includes('livr')))
      a.push({ level:'error', msg:'Aucun livreur disponible — des commandes sont en attente de livraison', icon:'M12 2a7 7 0 107 7h-7V2z' })
    setAlertes(a)
  }, [commandes, session, livreurs, aValider.length, prets.length, livDispos, cmdActives])

  const SectionCard = ({ children, title, icon, badge, badgeColor }) => (
    <div style={{ background:'var(--ebony-2)', border:'1px solid var(--border-gold)', borderRadius:16, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:700, color:'var(--cream)' }}>
          <Ico d={icon} size={14} stroke="var(--gold)" />
          {title}
        </div>
        {badge != null && (
          <span style={{ background:`${badgeColor||'var(--gold)'}18`, color:badgeColor||'var(--gold)', border:`1px solid ${badgeColor||'var(--gold)'}30`, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding:'16px 20px' }}>
        {children}
      </div>
    </div>
  )

  return (
    <div>
      <style>{`
        @keyframes countUp { from{opacity:0;transform:translateY(10px) scale(.9)} to{opacity:1;transform:none} }
        @keyframes alertPulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
      `}</style>

      {/* ── Alertes ─────────────────────────────────────────────────────── */}
      {alertes.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {alertes.map((a, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
              background: a.level==='error' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)',
              border:`1px solid ${a.level==='error' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}`,
              borderRadius:10, fontSize:13, fontWeight:600,
              color: a.level==='error' ? 'var(--danger)' : 'var(--warning)',
              animation:'fadeIn .3s ease',
            }}>
              <Ico d={a.icon} size={14} stroke="currentColor" sw={2} />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div style={{ marginBottom:16, background:feedback.ok?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)', border:`1px solid ${feedback.ok?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`, borderRadius:8, padding:'9px 16px', fontSize:12, fontWeight:600, color:feedback.ok?'var(--success)':'var(--danger)', animation:'fadeIn .2s ease' }}>
          {feedback.msg}
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:12, marginBottom:24 }}>
        <KPICard index={0} icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" label="Chiffre d'affaires du jour" value={`${caJour.toLocaleString('fr-FR')} F`} sub={panierMoyen>0?`Panier moyen : ${panierMoyen.toLocaleString('fr-FR')} F`:null} color="var(--success)" />
        <KPICard index={1} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" label="Commandes ce jour" value={cmdJour.length} sub={`${encaisses.length} encaissées`} color="var(--gold)" />
        <KPICard index={2} icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" label="À valider" value={aValider.length} color={aValider.length>0?'var(--warning)':'#6B7280'} alert={aValider.length>0} />
        <KPICard index={3} icon="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" label="En cuisine" value={enCours.length} color="#8B5CF6" />
        <KPICard index={4} icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" label="Prêts" value={prets.length} color={prets.length>2?'var(--warning)':'var(--success)'} alert={prets.length>2} />
        <KPICard index={5} icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" label="Réservations" value={resaJour.length} sub={`${resaOK.length} confirmées`} color="var(--gold)" />
        <KPICard index={6} icon="M12 2a7 7 0 107 7h-7V2z" label="Livreurs" value={`${livDispos} / ${livreurs.length}`} sub={livCourse>0?`${livCourse} en livraison`:null} color={livDispos===0?'var(--danger)':'var(--success)'} alert={livDispos===0&&livCourse>0} />
        <KPICard index={7} icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" label="Caisse" value={session?'Ouverte':'Fermée'} sub={session?`Fond de caisse : ${session.fondCaisse?.toLocaleString('fr-FR')} FCFA`:'À ouvrir'} color={session?'var(--success)':'var(--danger)'} alert={!session} />
      </div>

      {/* ── Flux commandes + colonne droite ──────────────────────────── */}
      <div className="dash-split" style={{ marginBottom:18 }}>

        {/* Commandes actives */}
        <SectionCard
          title="Commandes actives"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
          badge={cmdActives.length}
          badgeColor={cmdActives.length>8?'var(--warning)':'var(--gold)'}
        >
          {cmdActives.length === 0
            ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--cream-faint)', fontSize:13 }}>Aucune commande active</div>
            : <>
                {cmdActives.slice(0,12).map(cmd => (
                  <LigneCommande key={cmd.id} cmd={cmd} onUpdate={onUpdateStatus} onValidate={validerCommande} />
                ))}
                {cmdActives.length > 12 && (
                  <div style={{ textAlign:'center', padding:'10px 0 2px', fontSize:11, color:'var(--cream-faint)' }}>
                    +{cmdActives.length-12} autres · voir onglet Commandes
                  </div>
                )}
              </>
          }
        </SectionCard>

        {/* Colonne droite */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Réservations du jour */}
          <SectionCard title="Réservations aujourd'hui" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" badge={resaJour.length}>
            {resaJour.length === 0
              ? <div style={{ textAlign:'center', padding:'16px 0', color:'var(--cream-faint)', fontSize:12 }}>Aucune réservation</div>
              : resaJour.sort((a,b)=>a.heure.localeCompare(b.heure)).map(r => {
                  const statusColors = { confirmee:'var(--success)', arrivee:'var(--info)', en_attente:'var(--warning)' }
                  const sc = statusColors[r.status] || 'var(--cream-faint)'
                  return (
                    <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                      <div>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--cream)' }}>{r.heure}</span>
                        <span style={{ marginLeft:7, fontSize:12, color:'var(--cream-faint)' }}>{r.nom}</span>
                        <div style={{ fontSize:10, color:'var(--cream-faint)', opacity:.6, marginTop:1 }}>
                          {r.personnes} pers. {r.zone==='vip'?'· VIP':r.zone==='terrasse'?'· Terrasse':''}
                        </div>
                      </div>
                      <span style={{ fontSize:9, fontWeight:700, letterSpacing:.5, textTransform:'uppercase', color:sc, background:`${sc}15`, border:`1px solid ${sc}25`, borderRadius:4, padding:'2px 7px' }}>
                        {r.status==='confirmee'?'Conf.':r.status==='arrivee'?'Arrivé':'Attente'}
                      </span>
                    </div>
                  )
                })
            }
          </SectionCard>

          {/* Livreurs */}
          <SectionCard title="Équipe livraison" icon="M12 2a7 7 0 107 7h-7V2z" badge={`${livDispos} dispo`} badgeColor={livDispos>0?'var(--success)':'var(--danger)'}>
            {livreurs.length === 0
              ? <div style={{ textAlign:'center', padding:'12px 0', color:'var(--cream-faint)', fontSize:12 }}>Non configurés</div>
              : livreurs.map(l => {
                  const lc = { disponible:'var(--success)', en_course:'var(--warning)', indisponible:'#6B7280' }[l.status] || '#6B7280'
                  return (
                    <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:lc, display:'inline-block', animation:l.status==='disponible'?'alertPulse 2.5s ease infinite':'none' }} />
                        <span style={{ fontSize:12, fontWeight:600 }}>{l.nom}</span>
                      </div>
                      <span style={{ fontSize:10, color:lc, fontWeight:600, background:`${lc}15`, border:`1px solid ${lc}25`, borderRadius:4, padding:'2px 7px' }}>
                        {l.status==='disponible'?'Disponible':l.status==='en_course'?'En livraison':'Indisponible'}
                      </span>
                    </div>
                  )
                })
            }
          </SectionCard>
        </div>
      </div>

      {/* ── Bilan shift ───────────────────────────────────────────────── */}
      <div style={{ background:'var(--ebony-2)', border:'1px solid var(--border-gold)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:8 }}>
          <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" size={14} stroke="var(--gold)" />
          <span style={{ fontSize:13, fontWeight:700, color:'var(--cream)' }}>Bilan du shift en cours</span>
        </div>
        <div style={{ padding:'16px 20px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
          {[
            { label:'Commandes traitées', value:cmdJour.filter(c=>c.status!=='annule').length, color:'var(--success)', icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label:'Annulations',        value:cmdJour.filter(c=>c.status==='annule').length,  color:cmdJour.filter(c=>c.status==='annule').length>0?'var(--danger)':'var(--cream-faint)', icon:'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label:'CA encaissé',        value:caJour.toLocaleString('fr-FR')+' FCFA',          color:'var(--success)', icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2' },
            { label:'Panier moyen',       value:panierMoyen>0?panierMoyen.toLocaleString('fr-FR')+' F':'–', color:'var(--gold)', icon:'M3 3h2l.4 2M7 13h10l4-8H5.4' },
            { label:'Tables occupées',    value:`${tablesOcc} / ${tables.length}`, color:tables.length>0&&tablesOcc/tables.length>.8?'var(--warning)':'var(--cream)', icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', sub:tablesNett>0?`${tablesNett} en nettoyage`:null },
            { label:'Livreurs en course', value:`${livCourse} / ${livreurs.length}`, color:'var(--cream)', icon:'M12 2a7 7 0 107 7h-7V2z' },
          ].map(k => (
            <div key={k.label} style={{ background:'rgba(240,232,216,.03)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'12px 14px', transition:'border-color .2s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-gold)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-subtle)'}
            >
              <div style={{ color:'var(--gold)', marginBottom:8 }}>
                <Ico d={k.icon} size={14} stroke="var(--gold)" />
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
              {k.sub && <div style={{ fontSize:10, color:'var(--cream-faint)', marginTop:2 }}>{k.sub}</div>}
              <div style={{ fontSize:11, color:'var(--cream-faint)', marginTop:5 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
