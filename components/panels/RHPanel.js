'use client'
// RHPanel.js — Design Pro v2
// Matrice de visibilité hiérarchique :
//   super_admin → tout voir, tout modifier
//   manager     → son restaurant, son équipe (signalements exclus)
//   employé     → uniquement ses propres données

import { useState, useEffect, useCallback } from 'react'

// ── Droits ────────────────────────────────────────────────────────────────────
const DROITS = {
  super_admin: {
    scores:       { voir: 'tous',      modifier: true  },
    planning:     { voir: 'tous',      modifier: true  },
    signalements: { voir: 'tous',      modifier: true  },
    checklists:   { voir: 'tous',      modifier: false },
    heures_sup:   { voir: 'tous',      modifier: true  },
    evaluations:  { voir: 'tous',      modifier: true  },
    badges:       { voir: 'tous',      modifier: true  },
  },
  manager: {
    scores:       { voir: 'equipe',    modifier: true  },
    planning:     { voir: 'equipe',    modifier: true  },
    signalements: { voir: 'jamais',    modifier: false },
    checklists:   { voir: 'equipe',    modifier: false },
    heures_sup:   { voir: 'equipe',    modifier: true  },
    evaluations:  { voir: 'agrege',    modifier: true  },
    badges:       { voir: 'equipe',    modifier: true  },
  },
  default: {
    scores:       { voir: 'soi',       modifier: false },
    planning:     { voir: 'soi',       modifier: false },
    signalements: { voir: 'soumettre', modifier: false },
    checklists:   { voir: 'soi',       modifier: false },
    heures_sup:   { voir: 'soi',       modifier: false },
    evaluations:  { voir: 'soumettre', modifier: false },
    badges:       { voir: 'soi',       modifier: false },
  },
}
function getDroits(role) { return DROITS[role] || DROITS.default }

const TABS_CONFIG = [
  { id: 'scores',       label: 'Scores',        icon: '📊', roles: ['super_admin','manager'], rolesEmploye: true  },
  { id: 'planning',     label: 'Planning',       icon: '📅', roles: ['super_admin','manager'], rolesEmploye: true  },
  { id: 'checklists',   label: 'Checklist',      icon: '✅', roles: null,                     rolesEmploye: true  },
  { id: 'heures_sup',   label: 'Heures sup',     icon: '⏱', roles: ['super_admin','manager'], rolesEmploye: true  },
  { id: 'evaluations',  label: 'Évaluations',    icon: '⭐', roles: null,                     rolesEmploye: true  },
  { id: 'signalements', label: 'Signalements',   icon: '🔒', roles: ['super_admin'],          rolesEmploye: true  },
  { id: 'badges',       label: 'Badges',         icon: '🏅', roles: null,                     rolesEmploye: true  },
]
function tabsVisibles(role) {
  const estAdmin = ['super_admin','manager'].includes(role)
  return TABS_CONFIG.filter(t => {
    if (t.roles === null) return true
    if (t.roles && t.roles.includes(role)) return true
    if (t.rolesEmploye && !estAdmin) return true
    return false
  })
}

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:          '#0D0D0F',
  surface:     '#141417',
  surfaceHi:   '#1C1C22',
  surfaceHov:  '#22222A',
  border:      'rgba(201,151,60,.15)',
  borderHi:    'rgba(201,151,60,.4)',
  gold:        '#C9973C',
  goldSoft:    'rgba(201,151,60,.1)',
  goldGlow:    'rgba(201,151,60,.22)',
  cream:       '#EDE8DC',
  muted:       'rgba(237,232,220,.45)',
  faint:       'rgba(237,232,220,.25)',
  success:     '#22C55E',
  successBg:   'rgba(34,197,94,.08)',
  successBd:   'rgba(34,197,94,.22)',
  danger:      '#EF4444',
  dangerBg:    'rgba(239,68,68,.08)',
  dangerBd:    'rgba(239,68,68,.22)',
  warn:        '#F59E0B',
  warnBg:      'rgba(245,158,11,.08)',
  warnBd:      'rgba(245,158,11,.22)',
  info:        '#38BDF8',
  infoBg:      'rgba(56,189,248,.08)',
  infoBd:      'rgba(56,189,248,.22)',
  purple:      '#A78BFA',
  purpleBg:    'rgba(167,139,250,.08)',
  purpleBd:    'rgba(167,139,250,.22)',
  r:           '12px',
  rSm:         '8px',
  font:        "'JetBrains Mono','Fira Code','Courier New',monospace",
  ui:          "'Inter',system-ui,sans-serif",
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const card = (o={}) => ({ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.r, padding: '18px 20px', ...o })
const inp  = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: C.rSm, color: C.cream, padding: '10px 14px', fontSize: 13, fontFamily: C.ui, outline: 'none', transition: 'border-color .15s' }
const lbl  = { fontSize: 9, color: C.muted, letterSpacing: '.1em', display: 'block', marginBottom: 5, fontFamily: C.ui, textTransform: 'uppercase', fontWeight: 600 }
const btnPrimary = { background: `linear-gradient(135deg,${C.gold},#A85E28)`, border: 'none', color: '#fff', padding: '9px 20px', borderRadius: C.rSm, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: C.ui, transition: 'all .15s', letterSpacing: '.02em' }
const badge = (color) => ({ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}35`, fontFamily: C.ui, letterSpacing: '.04em', textTransform: 'uppercase' })
const toast = (t) => ({ background: t==='err' ? C.dangerBg : C.successBg, border: `1px solid ${t==='err' ? C.dangerBd : C.successBd}`, borderRadius: C.rSm, padding: '10px 14px', color: t==='err' ? C.danger : C.success, fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: C.ui, animation: 'rhFadeIn .2s ease' })

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.goldSoft}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'rhSpin 1s linear infinite' }} />
      <span style={{ fontSize: 10, color: C.faint, fontFamily: C.ui, letterSpacing: '.08em', textTransform: 'uppercase' }}>Chargement…</span>
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.faint, fontFamily: C.ui }}>{text}</div>
    </div>
  )
}

function StatusBand({ icon, text, color, bg, bd }) {
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: C.rSm, padding: '9px 14px', marginBottom: 16, fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 8, fontFamily: C.ui, fontWeight: 500 }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  )
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: C.gold, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, fontFamily: C.ui }}>{children}</div>
      {action}
    </div>
  )
}

function Stat({ label, value, color, sub }) {
  return (
    <div style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: C.rSm, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: C.ui, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || C.cream, fontFamily: C.font, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.faint, marginTop: 3, fontFamily: C.ui }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || C.gold, borderRadius: 2, transition: 'width .5s ease' }} />
    </div>
  )
}

// ── CSS global ────────────────────────────────────────────────────────────────
function useRHStyles() {
  useEffect(() => {
    if (document.getElementById('rh-styles')) return
    const s = document.createElement('style')
    s.id = 'rh-styles'
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
      @keyframes rhSpin    { to { transform: rotate(360deg) } }
      @keyframes rhFadeIn  { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
      @keyframes rhSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      .rh-inp:focus { border-color: ${C.gold} !important; }
      .rh-row:hover { background: ${C.surfaceHov} !important; }
      .rh-tab-btn:hover { border-color: ${C.borderHi} !important; color: ${C.cream} !important; }
      .rh-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
      .rh-ghost-btn:hover { background: rgba(255,255,255,.07) !important; }
    `
    document.head.appendChild(s)
  }, [])
}

// ═══════════════════════════════════════════════════════
// 1. SCORES
// ═══════════════════════════════════════════════════════
function ScoresTab({ droits, restaurantId, userId, userName, userRole }) {
  const [data,    setData]    = useState({ semaine: '', scores: [] })
  const [loading, setLoading] = useState(true)
  const [calcul,  setCalcul]  = useState(false)
  const [semaine, setSemaine] = useState('')
  const [msg,     setMsg]     = useState({ type: '', text: '' })
  const voirTous  = droits.scores.voir === 'tous' || droits.scores.voir === 'equipe'
  const peutCalc  = droits.scores.modifier

  const load = useCallback(async (sem) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (restaurantId) p.set('restaurantId', restaurantId)
      if (sem)          p.set('semaine', sem)
      if (!voirTous)    p.set('userId', userId)
      const res = await fetch(`/api/rh/scores?${p}`)
      const d   = await res.json()
      setData(d)
      if (!semaine && d.semaine) setSemaine(d.semaine)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [restaurantId, userId, voirTous, semaine])

  useEffect(() => { load() }, [restaurantId])

  async function recalculer() {
    if (!semaine) return
    setCalcul(true)
    try {
      const res = await fetch('/api/rh/scores', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ restaurantId, semaine }) })
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error)
      setMsg({ type:'ok', text:`${d.nb} score(s) recalculé(s) avec succès` })
      await load(semaine)
    } catch(e) {
      setMsg({ type:'err', text: e.message || 'Erreur réseau' })
    } finally { setCalcul(false) }
  }

  const scoreColor = s => s >= 80 ? C.success : s >= 60 ? C.warn : s >= 40 ? C.danger : C.faint
  const scoreLabel = s => s >= 80 ? 'Excellent' : s >= 60 ? 'Correct' : s >= 40 ? 'À améliorer' : 'Insuffisant'

  return (
    <div>
      {!voirTous
        ? <StatusBand icon="👤" text={`Vous consultez votre tableau de bord personnel, ${userName}.`} color={C.info} bg={C.infoBg} bd={C.infoBd} />
        : <StatusBand icon="🏪" text="Vue équipe — performance collective" color={C.purple} bg={C.purpleBg} bd={C.purpleBd} />
      }

      {/* Controls */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, gap:10, flexWrap:'wrap' }}>
        <input type="week" value={semaine} onChange={e=>{ setSemaine(e.target.value); load(e.target.value) }} className="rh-inp" style={{ ...inp, width:200 }} />
        {peutCalc && (
          <button onClick={recalculer} disabled={calcul} className="rh-btn" style={btnPrimary}>
            {calcul ? '⟳ Calcul…' : '⟳ Recalculer'}
          </button>
        )}
      </div>

      {msg.text && <div style={toast(msg.type)}>{msg.type==='ok' ? '✓ ' : '⚠ '}{msg.text}</div>}

      {loading ? <Spinner /> : data.scores.length === 0 ? (
        <Empty icon="📊" text={peutCalc ? 'Aucun score. Sélectionnez une semaine et recalculez.' : 'Aucun score pour cette semaine.'} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {data.scores.map((s, i) => {
            const sc = scoreColor(s.scoreGlobal)
            return (
              <div key={s.id} style={{ ...card(), borderLeft:`3px solid ${sc}`, transition:'background .15s' }} className="rh-row">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    {voirTous && (
                      <div style={{ width:28, height:28, borderRadius:'50%', background:`${sc}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:sc, fontFamily:C.font, flexShrink:0 }}>
                        #{i+1}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.cream, fontFamily:C.ui }}>{voirTous ? s.userName : 'Mon score'}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2, fontFamily:C.ui }}>
                        {s.nbHeuresTravail}h · {s.nbRetards} retard{s.nbRetards>1?'s':''} · {s.nbErreurs} erreur{s.nbErreurs>1?'s':''}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:28, fontWeight:900, color:sc, fontFamily:C.font, lineHeight:1 }}>{s.scoreGlobal}</div>
                    <div style={{ fontSize:9, color:C.faint, fontFamily:C.ui, textTransform:'uppercase', letterSpacing:'.08em' }}>/ 100 — {scoreLabel(s.scoreGlobal)}</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[
                    { label:'Présence',     val:s.scorePresence,     max:40, color:'#38BDF8' },
                    { label:'Qualité',      val:s.scoreQualite,      max:30, color:C.purple   },
                    { label:'Productivité', val:s.scoreProductivite, max:30, color:C.warn      },
                  ].map(c => (
                    <div key={c.label}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:10, color:C.faint, fontFamily:C.ui }}>{c.label}</span>
                        <span style={{ fontSize:10, color:c.color, fontWeight:700, fontFamily:C.font }}>{c.val}/{c.max}</span>
                      </div>
                      <ProgressBar value={c.val} max={c.max} color={c.color} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 2. PLANNING
// ═══════════════════════════════════════════════════════
const JOURS  = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const POSTES = ['Caisse','Cuisine','Salle','Livraison','Stocks','Accueil']
const CPOSTE = { Caisse:'#22C55E', Cuisine:'#F59E0B', Salle:'#A78BFA', Livraison:'#38BDF8', Stocks:'#84CC16', Accueil:'#C9973C' }

function getLundi(offset=0) {
  const d = new Date(), day = d.getDay()
  d.setDate(d.getDate() + (day===0 ? -6 : 1-day) + offset*7)
  return d.toISOString().split('T')[0]
}

function PlanningTab({ droits, restaurantId, userId, userName }) {
  const [semaine, setSemaine] = useState(getLundi())
  const [shifts,  setShifts]  = useState([])
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm,setShowForm]= useState(false)
  const [form,    setForm]    = useState({ userId:'', date:'', heureDebut:'08:00', heureFin:'16:00', poste:'Salle', note:'' })
  const [msg,     setMsg]     = useState({ type:'', text:'' })
  const peutModif  = droits.planning.modifier
  const voirEquipe = droits.planning.voir === 'tous' || droits.planning.voir === 'equipe'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ semaine })
      if (restaurantId) p.set('restaurantId', restaurantId)
      const res = await fetch(`/api/rh/planning?${p}`)
      const d   = await res.json()
      const all = Array.isArray(d.shifts) ? d.shifts : []
      setShifts(voirEquipe ? all : all.filter(s => s.userId===userId))
      setUsers(Array.isArray(d.users) ? d.users : [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [semaine, restaurantId, userId, voirEquipe])

  useEffect(() => { load() }, [load])

  const dates = Array.from({ length:7 }, (_,i) => {
    const d = new Date(semaine); d.setDate(d.getDate()+i)
    return d.toISOString().split('T')[0]
  })

  async function ajouterShift() {
    if (!form.userId || !form.date) { setMsg({ type:'err', text:'Employé et date requis' }); return }
    const usr = users.find(u => u.id===form.userId)
    try {
      const res = await fetch('/api/rh/planning', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ restaurantId, ...form, userName:usr?.name||'', userRole:usr?.role||'staff' }) })
      if (!res.ok) { const d=await res.json(); setMsg({ type:'err', text:d.error||'Erreur' }); return }
      setMsg({ type:'ok', text:'Shift ajouté' }); setShowForm(false); load()
    } catch(e) { setMsg({ type:'err', text:'Erreur réseau' }) }
  }

  async function supprimerShift(id) {
    try { await fetch('/api/rh/planning', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }) }); load() }
    catch(e) { console.error(e) }
  }

  const NavSemaine = () => (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={() => setSemaine(getLundi(-1))} className="rh-ghost-btn" style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, color:C.gold, padding:'6px 10px', borderRadius:C.rSm, cursor:'pointer', fontFamily:C.ui, fontSize:14, transition:'all .15s' }}>‹</button>
      <span style={{ fontSize:13, color:C.cream, fontWeight:600, fontFamily:C.ui, minWidth:200, textAlign:'center' }}>
        Semaine du {new Date(semaine).toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' })}
      </span>
      <button onClick={() => setSemaine(getLundi(1))} className="rh-ghost-btn" style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, color:C.gold, padding:'6px 10px', borderRadius:C.rSm, cursor:'pointer', fontFamily:C.ui, fontSize:14, transition:'all .15s' }}>›</button>
    </div>
  )

  // Vue employé : liste simple
  if (!voirEquipe) {
    return (
      <div>
        <StatusBand icon="👤" text={`Planning personnel de ${userName}`} color={C.info} bg={C.infoBg} bd={C.infoBd} />
        <div style={{ marginBottom:16 }}><NavSemaine /></div>
        {loading ? <Spinner /> : dates.map((d,i) => {
          const shift = shifts.find(s => s.date===d)
          const pc = shift ? CPOSTE[shift.poste]||'#6b7280' : null
          return (
            <div key={d} style={{ ...card({ marginBottom:6, borderLeft:`3px solid ${pc||C.border}`, opacity: shift ? 1 : .5 }) }} className="rh-row">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontWeight:700, fontSize:13, color:C.cream, fontFamily:C.ui }}>{JOURS[i]} </span>
                  <span style={{ fontSize:12, color:C.muted, fontFamily:C.ui }}>{new Date(d).toLocaleDateString('fr-FR',{ day:'numeric', month:'short' })}</span>
                  {shift
                    ? <div style={{ fontSize:12, color:C.muted, marginTop:3, fontFamily:C.ui }}>{shift.heureDebut} – {shift.heureFin}</div>
                    : <div style={{ fontSize:11, color:C.faint, marginTop:3, fontFamily:C.ui }}>Repos</div>
                  }
                </div>
                {shift && <span style={badge(pc)}>{shift.poste}</span>}
              </div>
              {shift?.note && <div style={{ fontSize:11, color:C.warn, marginTop:6, fontFamily:C.ui }}>📝 {shift.note}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  // Vue manager : grille
  return (
    <div>
      <StatusBand icon="🏪" text="Planning équipe — vue hebdomadaire" color={C.purple} bg={C.purpleBg} bd={C.purpleBd} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <NavSemaine />
        {peutModif && (
          <button onClick={() => setShowForm(p=>!p)} className="rh-btn" style={btnPrimary}>
            {showForm ? '✕ Fermer' : '+ Ajouter un shift'}
          </button>
        )}
      </div>

      {msg.text && <div style={toast(msg.type)}>{msg.type==='ok'?'✓ ':''}{msg.text}</div>}

      {showForm && peutModif && (
        <div style={{ ...card({ border:`1px solid ${C.borderHi}`, marginBottom:16 }), animation:'rhSlideUp .2s ease' }}>
          <SectionTitle>Nouveau shift</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:12 }}>
            <div>
              <label style={lbl}>Employé *</label>
              <select style={inp} className="rh-inp" value={form.userId} onChange={e=>setForm(p=>({...p,userId:e.target.value}))}>
                <option value="">— Sélectionner —</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input type="date" style={inp} className="rh-inp" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
            </div>
            <div>
              <label style={lbl}>Début</label>
              <input type="time" style={inp} className="rh-inp" value={form.heureDebut} onChange={e=>setForm(p=>({...p,heureDebut:e.target.value}))} />
            </div>
            <div>
              <label style={lbl}>Fin</label>
              <input type="time" style={inp} className="rh-inp" value={form.heureFin} onChange={e=>setForm(p=>({...p,heureFin:e.target.value}))} />
            </div>
            <div>
              <label style={lbl}>Poste</label>
              <select style={inp} className="rh-inp" value={form.poste} onChange={e=>setForm(p=>({...p,poste:e.target.value}))}>
                {POSTES.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Note</label>
              <input style={inp} className="rh-inp" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} placeholder="Optionnel" />
            </div>
          </div>
          <button onClick={ajouterShift} className="rh-btn" style={btnPrimary}>Ajouter le shift</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div style={{ overflowX:'auto', borderRadius:C.r, border:`1px solid ${C.border}` }}>
          <div style={{ display:'grid', gridTemplateColumns:`120px repeat(7,1fr)`, gap:2, minWidth:640, background:C.surfaceHi, padding:2 }}>
            {/* Header */}
            <div style={{ background:C.surface, borderRadius:'8px 0 0 0' }} />
            {dates.map((d,i) => {
              const isToday = d === new Date().toISOString().split('T')[0]
              return (
                <div key={d} style={{ background: isToday ? C.goldSoft : C.surface, borderRadius: i===6 ? '0 8px 0 0' : 0, padding:'8px 4px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color: isToday ? C.gold : C.muted, fontWeight:700, fontFamily:C.ui, textTransform:'uppercase', letterSpacing:'.08em' }}>{JOURS[i]}</div>
                  <div style={{ fontSize:12, color: isToday ? C.gold : C.cream, fontWeight: isToday ? 800 : 400, fontFamily:C.font }}>{new Date(d).getDate()}</div>
                </div>
              )
            })}
            {/* Rows */}
            {users.map((u, uIdx) => {
              const shiftsU = shifts.filter(s=>s.userId===u.id)
              if (shiftsU.length===0 && !peutModif) return null
              const isLast = uIdx === users.length-1
              return [
                <div key={`${u.id}-n`} style={{ background:C.surface, padding:'8px 12px', display:'flex', alignItems:'center', borderRadius: isLast ? '0 0 0 8px' : 0 }}>
                  <span style={{ fontSize:11, color:C.cream, fontWeight:600, fontFamily:C.ui, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name.split(' ')[0]}</span>
                </div>,
                ...dates.map((d, dIdx) => {
                  const shift = shiftsU.find(s=>s.date===d)
                  const pc    = CPOSTE[shift?.poste]||'#6b7280'
                  const isLastCell = isLast && dIdx===6
                  return (
                    <div key={`${u.id}-${d}`}
                      style={{ background: shift ? `${pc}14` : C.surface, border: shift ? `1px solid ${pc}30` : 'none', borderRadius: isLastCell ? '0 0 8px 0' : 0, padding:4, minHeight:54, position:'relative', cursor:peutModif&&!shift?'pointer':'default' }}
                      onClick={() => peutModif && !shift && (setForm(p=>({...p,userId:u.id,date:d})), setShowForm(true))}>
                      {shift ? (
                        <>
                          <div style={{ fontSize:9, color:pc, fontWeight:800, fontFamily:C.ui, textTransform:'uppercase', letterSpacing:'.04em' }}>{shift.poste}</div>
                          <div style={{ fontSize:8, color:C.muted, fontFamily:C.font }}>{shift.heureDebut}–{shift.heureFin}</div>
                          {peutModif && (
                            <button onClick={e=>{e.stopPropagation();supprimerShift(shift.id)}}
                              style={{ position:'absolute', top:3, right:3, background:'rgba(239,68,68,.2)', border:'none', color:C.danger, width:14, height:14, borderRadius:3, cursor:'pointer', fontSize:8, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                          )}
                        </>
                      ) : peutModif ? (
                        <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:`${C.gold}30`, fontSize:18 }}>+</div>
                      ) : null}
                    </div>
                  )
                })
              ]
            })}
          </div>
        </div>
      )}

      {/* Légende postes */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
        {POSTES.map(p => (
          <div key={p} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:CPOSTE[p] }} />
            <span style={{ fontSize:10, color:C.muted, fontFamily:C.ui }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 3. CHECKLIST
// ═══════════════════════════════════════════════════════
function ChecklistTab({ droits, restaurantId, userId, userRole, userName }) {
  const [data,    setData]    = useState({ templates:[], completions:[] })
  const [loading, setLoading] = useState(true)
  const [moment,  setMoment]  = useState('ouverture')
  const [checks,  setChecks]  = useState({})
  const [busy,    setBusy]    = useState(false)
  const [msg,     setMsg]     = useState({ type:'', text:'' })
  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ date:today, moment, role:userRole })
      if (restaurantId) p.set('restaurantId', restaurantId)
      const res = await fetch(`/api/rh/checklists?${p}`)
      const d   = await res.json()
      setData(d)
      const init = {}
      d.completions?.forEach(c => c.itemsCoches?.forEach(i => { init[i.id] = i.coche }))
      setChecks(init)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [restaurantId, moment, today, userRole])

  useEffect(() => { load() }, [load])

  async function valider(templateId, items) {
    setBusy(true)
    const itemsCoches = items.map(it => ({ id:it.id, label:it.label, coche:!!checks[it.id], obligatoire:it.obligatoire }))
    if (itemsCoches.some(i => i.obligatoire && !i.coche)) {
      setMsg({ type:'err', text:'Tous les points obligatoires (*) doivent être cochés avant de valider.' })
      setBusy(false); return
    }
    await fetch('/api/rh/checklists', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ templateId, date:today, moment, itemsCoches, restaurantId }) })
    setMsg({ type:'ok', text:`Checklist ${moment} validée et enregistrée` })
    setBusy(false); load()
  }

  const templatesDuMoment = data.templates?.filter(t => t.moment===moment) || []

  return (
    <div>
      {/* Explication contextuelle */}
      <div style={{ ...card({ background:C.infoBg, border:`1px solid ${C.infoBd}`, marginBottom:18 }) }}>
        <div style={{ fontSize:12, color:C.info, fontWeight:700, marginBottom:4, fontFamily:C.ui }}>
          {moment==='ouverture' ? '🌅 Checklist d\'ouverture' : '🌙 Checklist de fermeture'}
        </div>
        <div style={{ fontSize:11, color:C.muted, fontFamily:C.ui, lineHeight:1.6 }}>
          Vérifiez et cochez chaque point avant de valider. Les points marqués <span style={{ color:C.danger }}>*</span> sont obligatoires.
          Cette liste est enregistrée et horodatée pour assurer la traçabilité des procédures.
        </div>
      </div>

      {/* Tabs ouverture/fermeture */}
      <div style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center' }}>
        {['ouverture','fermeture'].map(m => (
          <button key={m} onClick={() => setMoment(m)} className="rh-tab-btn" style={{
            padding:'9px 18px', borderRadius:C.rSm, border:`1px solid ${moment===m ? C.gold : C.border}`,
            background: moment===m ? C.goldSoft : 'transparent',
            color: moment===m ? C.gold : C.muted,
            fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:C.ui,
            transition:'all .15s', letterSpacing:'.04em',
          }}>
            {m==='ouverture' ? '🌅 Ouverture' : '🌙 Fermeture'}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:11, color:C.faint, fontFamily:C.ui }}>
          {new Date().toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
        </span>
      </div>

      {msg.text && <div style={toast(msg.type)}>{msg.type==='ok'?'✓ ':'⚠ '}{msg.text}</div>}

      {loading ? <Spinner /> : templatesDuMoment.length===0 ? (
        <Empty icon="✅" text="Aucune checklist configurée pour votre rôle." />
      ) : templatesDuMoment.map(tmpl => {
        const done   = data.completions?.find(c => c.templateId===tmpl.id)?.complet
        const nbOk   = tmpl.items.filter(it => checks[it.id]).length
        const nbTotal = tmpl.items.length
        const pct    = nbTotal > 0 ? Math.round((nbOk/nbTotal)*100) : 0

        return (
          <div key={tmpl.id} style={{ ...card({ border: done ? `1px solid ${C.successBd}` : `1px solid ${C.borderHi}`, marginBottom:12 }) }}>
            {/* Header checklist */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color: done ? C.success : C.gold, fontFamily:C.ui }}>
                  {done ? '✓ ' : ''}{tmpl.titre}
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:2, fontFamily:C.ui }}>
                  {done ? 'Checklist complétée et enregistrée' : `${nbOk} / ${nbTotal} points validés`}
                </div>
              </div>
              <div style={{ fontSize:20, fontWeight:900, color: done ? C.success : (pct===100 ? C.gold : C.muted), fontFamily:C.font }}>
                {pct}%
              </div>
            </div>

            {/* Barre de progression */}
            <div style={{ marginBottom:16 }}>
              <ProgressBar value={nbOk} max={nbTotal} color={done ? C.success : C.gold} />
            </div>

            {/* Items */}
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {tmpl.items.map((item, idx) => {
                const isChecked = !!checks[item.id]
                return (
                  <label key={item.id} style={{
                    display:'flex', alignItems:'flex-start', gap:12, padding:'9px 12px',
                    borderRadius:C.rSm, cursor: done ? 'default' : 'pointer',
                    background: isChecked ? 'rgba(34,197,94,.04)' : 'transparent',
                    border: `1px solid ${isChecked ? C.successBd : 'transparent'}`,
                    transition:'all .15s',
                  }}>
                    <div style={{ position:'relative', flexShrink:0, marginTop:1 }}>
                      <input type="checkbox"
                        checked={isChecked}
                        onChange={e => !done && setChecks(p=>({...p,[item.id]:e.target.checked}))}
                        disabled={done}
                        style={{ width:16, height:16, accentColor:C.gold, cursor: done ? 'default' : 'pointer' }}
                      />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:13, color: isChecked ? C.muted : C.cream, textDecoration: isChecked ? 'line-through' : 'none', fontFamily:C.ui, transition:'all .2s' }}>
                        {item.label}
                      </span>
                      {item.obligatoire && <span style={{ color:C.danger, marginLeft:5, fontSize:10, fontWeight:700 }}>*</span>}
                    </div>
                    {isChecked && <div style={{ fontSize:14, flexShrink:0 }}>✓</div>}
                  </label>
                )
              })}
            </div>

            {!done && (
              <button onClick={() => valider(tmpl.id, tmpl.items)} disabled={busy}
                className="rh-btn"
                style={{ ...btnPrimary, marginTop:14, width:'100%', background: pct===100 ? `linear-gradient(135deg,${C.success},#16A34A)` : `linear-gradient(135deg,${C.gold},#A85E28)` }}>
                {busy ? '⏳ Enregistrement…' : pct===100 ? '✓ Valider la checklist' : `Valider (${nbOk}/${nbTotal} cochés)`}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 4. HEURES SUPPLÉMENTAIRES
// ═══════════════════════════════════════════════════════
function HeuresSupTab({ droits, restaurantId, userId, userName }) {
  const [hs,       setHs]      = useState([])
  const [loading,  setLoading] = useState(true)
  const [calcul,   setCalcul]  = useState(false)
  const [semaine,  setSemaine] = useState('')
  const [msg,      setMsg]     = useState({ type:'', text:'' })
  const voirEquipe  = droits.heures_sup.voir === 'tous' || droits.heures_sup.voir === 'equipe'
  const peutValider = droits.heures_sup.modifier

  const load = useCallback(async (sem) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (restaurantId) p.set('restaurantId', restaurantId)
      if (sem)          p.set('semaine', sem)
      if (!voirEquipe)  p.set('userId', userId)
      const res = await fetch(`/api/rh/heures-sup?${p}`)
      const d   = await res.json()
      setHs(Array.isArray(d) ? d : [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [restaurantId, userId, voirEquipe])

  useEffect(() => { load() }, [restaurantId])

  async function calculer() {
    if (!semaine) { setMsg({ type:'err', text:'Sélectionnez une semaine' }); return }
    setCalcul(true)
    try {
      const res = await fetch('/api/rh/heures-sup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ restaurantId, semaine }) })
      const d   = await res.json()
      setMsg({ type:'ok', text:`${d.nb} employé(s) avec heures supplémentaires` })
      load(semaine)
    } catch(e) { setMsg({ type:'err', text:'Erreur réseau' }) }
    finally { setCalcul(false) }
  }

  async function approuver(id) {
    try {
      await fetch('/api/rh/heures-sup', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut:'approuvee' }) })
      load(semaine)
    } catch(e) { setMsg({ type:'err', text:'Erreur réseau' }) }
  }

  const STATUT = { calculee:{ label:'Calculée', color:'#6B7280' }, approuvee:{ label:'Approuvée', color:C.success }, payee:{ label:'Payée', color:C.purple }, contestee:{ label:'Contestée', color:C.danger } }
  const totalApprouves = hs.filter(h=>h.statut==='approuvee').reduce((s,h)=>s+h.montantBrut,0)

  return (
    <div>
      {!voirEquipe
        ? <StatusBand icon="👤" text={`Vos heures supplémentaires — ${userName}`} color={C.info} bg={C.infoBg} bd={C.infoBd} />
        : <StatusBand icon="🏪" text="Heures supplémentaires de l'équipe" color={C.purple} bg={C.purpleBg} bd={C.purpleBd} />
      }

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <input type="week" value={semaine} onChange={e=>{ setSemaine(e.target.value); load(e.target.value) }} className="rh-inp" style={{ ...inp, width:200 }} />
        {peutValider && (
          <button onClick={calculer} disabled={calcul} className="rh-btn" style={btnPrimary}>
            {calcul ? '⟳ Calcul…' : '⟳ Calculer'}
          </button>
        )}
      </div>

      {msg.text && <div style={toast(msg.type)}>{msg.type==='ok'?'✓ ':'⚠ '}{msg.text}</div>}

      {voirEquipe && totalApprouves > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, marginBottom:16 }}>
          <Stat label="Total approuvé" value={`${totalApprouves.toLocaleString('fr-FR')} F`} color={C.warn} sub="à payer cette semaine" />
          <Stat label="Employés concernés" value={hs.length} color={C.cream} sub="avec heures sup" />
        </div>
      )}

      {loading ? <Spinner /> : hs.length===0 ? (
        <Empty icon="⏱" text={!semaine ? 'Sélectionnez une semaine pour calculer.' : 'Aucune heure supplémentaire détectée.'} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {hs.map(h => {
            const st = STATUT[h.statut] || STATUT.calculee
            return (
              <div key={h.id} style={{ ...card({ borderLeft:`3px solid ${st.color}` }) }} className="rh-row">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.cream, fontFamily:C.ui, marginBottom:4 }}>
                      {voirEquipe ? h.userName : 'Mes heures supplémentaires'}
                    </div>
                    <div style={{ fontSize:12, color:C.muted, fontFamily:C.ui }}>
                      <span>{h.heuresNormales}h normales</span>
                      <span style={{ color:C.warn, fontWeight:700 }}> + {h.heuresSup}h supplémentaires</span>
                      <span style={{ color:C.faint }}> · majoration ×{h.tauxMajoration===2?'2,0':'1,5'}</span>
                    </div>
                    <div style={{ fontSize:10, color:C.faint, marginTop:3, fontFamily:C.ui }}>Semaine {h.semaine}</div>
                  </div>
                  <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                    <div style={{ fontSize:20, fontWeight:900, color:C.warn, fontFamily:C.font }}>{h.montantBrut.toLocaleString('fr-FR')} F</div>
                    <span style={badge(st.color)}>{st.label}</span>
                    {peutValider && h.statut==='calculee' && (
                      <button onClick={() => approuver(h.id)} className="rh-btn"
                        style={{ background:C.successBg, border:`1px solid ${C.successBd}`, color:C.success, padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:C.ui, transition:'all .15s' }}>
                        ✓ Approuver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 5. ÉVALUATIONS 360°
// ═══════════════════════════════════════════════════════
const CRIT_MvS = [
  { id:'ponctualite', label:'Ponctualité'            },
  { id:'qualite',     label:'Qualité du travail'     },
  { id:'attitude',    label:'Attitude & relationnel' },
  { id:'initiative',  label:'Initiative & autonomie' },
  { id:'hygiene',     label:'Hygiène & propreté'     },
]
const CRIT_SvC = [
  { id:'ambiance',       label:'Ambiance de travail'           },
  { id:'management',     label:'Management & communication'    },
  { id:'materiel',       label:'Qualité du matériel'           },
  { id:'charge',         label:'Charge de travail'             },
  { id:'reconnaissance', label:'Reconnaissance & valorisation' },
]

function Etoiles({ note, onChange, readonly }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => !readonly && onChange?.(n)}
          style={{ background:'none', border:'none', fontSize:18, cursor:readonly?'default':'pointer', color: n<=note ? C.gold : 'rgba(255,255,255,.1)', transition:'color .12s', padding:'0 1px', lineHeight:1 }}>★</button>
      ))}
    </div>
  )
}

function EvaluationsTab({ droits, restaurantId, userId, userRole }) {
  const [evals,    setEvals]    = useState([])
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [type,     setType]     = useState('staff_vers_conditions')
  const [showForm, setShowForm] = useState(false)
  const [evalueId, setEvalueId] = useState('')
  const [notes,    setNotes]    = useState({})
  const [pointsForts, setPF]   = useState('')
  const [axes,     setAxes]    = useState('')
  const [msg,      setMsg]      = useState({ type:'', text:'' })
  const [periode,  setPeriode]  = useState(() => { const d=new Date(); return `${d.getFullYear()}-T${Math.ceil((d.getMonth()+1)/3)}` })

  const peutEvaluerStaff = ['super_admin','manager'].includes(userRole)
  const voirResultats    = droits.evaluations.voir === 'tous' || droits.evaluations.voir === 'agrege'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ periode })
      if (restaurantId) p.set('restaurantId', restaurantId)
      const [rE, rU] = await Promise.all([
        fetch(`/api/rh/evaluations?${p}`),
        peutEvaluerStaff ? fetch('/api/users') : Promise.resolve({ ok:true, json:async()=>[] }),
      ])
      const dE = await rE.json(), dU = await rU.json()
      setEvals(Array.isArray(dE.evaluations) ? dE.evaluations : [])
      setUsers(Array.isArray(dU) ? dU.filter(u=>!['super_admin'].includes(u.role)) : [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [restaurantId, periode, peutEvaluerStaff])

  useEffect(() => { load() }, [load])

  async function soumettre() {
    const criteres = (type==='manager_vers_staff' ? CRIT_MvS : CRIT_SvC).map(c=>({ ...c, note:notes[c.id]||0 }))
    if (!criteres.some(c=>c.note>0)) { setMsg({ type:'err', text:'Notez au moins un critère' }); return }
    if (type==='manager_vers_staff' && !evalueId) { setMsg({ type:'err', text:'Sélectionnez un employé' }); return }
    const usr = users.find(u=>u.id===evalueId)
    await fetch('/api/rh/evaluations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ restaurantId, type, evalueId:evalueId||null, evalueNom:usr?.name||null, periode, criteres, pointsForts, axesAmelioration:axes }) })
    setMsg({ type:'ok', text: type==='staff_vers_conditions' ? 'Évaluation soumise anonymement.' : 'Évaluation enregistrée.' })
    setNotes({}); setPF(''); setAxes(''); setEvalueId(''); setShowForm(false); load()
  }

  const moyGlobale = (() => {
    const v = Object.values(notes).filter(n=>n>0)
    return v.length ? (v.reduce((s,n)=>s+n,0)/v.length).toFixed(1) : '—'
  })()

  const condEvals = evals.filter(e=>e.type==='staff_vers_conditions')
  const moyConditions = (() => {
    if (!condEvals.length) return null
    const all = condEvals.flatMap(e=>(Array.isArray(e.criteres)?e.criteres:[]).filter(c=>c.note>0).map(c=>c.note))
    return all.length ? (all.reduce((s,n)=>s+n,0)/all.length).toFixed(1) : null
  })()

  return (
    <div>
      {/* Actions */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {peutEvaluerStaff && (
          <button onClick={() => { setType('manager_vers_staff'); setShowForm(p=>!p) }} className="rh-tab-btn"
            style={{ padding:'9px 16px', borderRadius:C.rSm, border:`1px solid ${showForm&&type==='manager_vers_staff' ? C.gold : C.border}`, background: showForm&&type==='manager_vers_staff' ? C.goldSoft : 'transparent', color: showForm&&type==='manager_vers_staff' ? C.gold : C.muted, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:C.ui, transition:'all .15s' }}>
            📋 Évaluer un employé
          </button>
        )}
        <button onClick={() => { setType('staff_vers_conditions'); setShowForm(p=>!p) }} className="rh-tab-btn"
          style={{ padding:'9px 16px', borderRadius:C.rSm, border:`1px solid ${showForm&&type==='staff_vers_conditions' ? C.gold : C.border}`, background: showForm&&type==='staff_vers_conditions' ? C.goldSoft : 'transparent', color: showForm&&type==='staff_vers_conditions' ? C.gold : C.muted, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:C.ui, transition:'all .15s' }}>
          🔒 Évaluer mes conditions (anonyme)
        </button>
        <input value={periode} onChange={e=>setPeriode(e.target.value)} className="rh-inp" placeholder="ex: 2026-T2" style={{ ...inp, width:120, marginLeft:'auto' }} />
      </div>

      {msg.text && <div style={toast(msg.type)}>{msg.type==='ok'?'✓ ':'⚠ '}{msg.text}</div>}

      {showForm && (
        <div style={{ ...card({ border:`1px solid ${C.borderHi}`, marginBottom:16 }), animation:'rhSlideUp .2s ease' }}>
          <SectionTitle>{type==='manager_vers_staff' ? '📋 Évaluation employé' : '🔒 Conditions de travail (anonyme)'}</SectionTitle>
          {type==='manager_vers_staff' && (
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Employé évalué</label>
              <select style={inp} className="rh-inp" value={evalueId} onChange={e=>setEvalueId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          )}
          {(type==='manager_vers_staff' ? CRIT_MvS : CRIT_SvC).map(c => (
            <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid rgba(255,255,255,.04)` }}>
              <span style={{ fontSize:13, color:C.cream, fontFamily:C.ui }}>{c.label}</span>
              <Etoiles note={notes[c.id]||0} onChange={n=>setNotes(p=>({...p,[c.id]:n}))} />
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', margin:'12px 0', gap:8 }}>
            <span style={{ fontSize:11, color:C.muted, fontFamily:C.ui }}>Moyenne</span>
            <span style={{ fontSize:24, fontWeight:900, color:C.gold, fontFamily:C.font }}>{moyGlobale}{moyGlobale!=='—'?'/5':''}</span>
          </div>
          {type==='manager_vers_staff' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10, marginBottom:12 }}>
              <div>
                <label style={lbl}>Points forts</label>
                <textarea style={{ ...inp, minHeight:64, resize:'vertical' }} className="rh-inp" value={pointsForts} onChange={e=>setPF(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Axes d'amélioration</label>
                <textarea style={{ ...inp, minHeight:64, resize:'vertical' }} className="rh-inp" value={axes} onChange={e=>setAxes(e.target.value)} />
              </div>
            </div>
          )}
          <button onClick={soumettre} className="rh-btn" style={btnPrimary}>Soumettre l'évaluation</button>
        </div>
      )}

      {/* Résumé conditions de travail */}
      {voirResultats && moyConditions && (
        <div style={{ ...card({ background:C.infoBg, border:`1px solid ${C.infoBd}`, marginBottom:14 }) }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.info, marginBottom:8, fontFamily:C.ui }}>
            📊 Conditions de travail — avis anonymes
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Etoiles note={Math.round(parseFloat(moyConditions))} readonly />
            <span style={{ fontSize:22, fontWeight:900, color:C.info, fontFamily:C.font }}>{moyConditions}/5</span>
            <span style={{ fontSize:11, color:C.faint, fontFamily:C.ui }}>({condEvals.length} évaluation{condEvals.length>1?'s':''})</span>
          </div>
          <p style={{ fontSize:10, color:C.faint, marginTop:6, fontFamily:C.ui }}>Les réponses individuelles sont anonymisées.</p>
        </div>
      )}

      {/* Liste évaluations manager→staff */}
      {voirResultats && (
        loading ? <Spinner /> : evals.filter(e=>e.type==='manager_vers_staff').length===0 ? (
          <Empty icon="⭐" text={`Aucune évaluation enregistrée pour ${periode}`} />
        ) : evals.filter(e=>e.type==='manager_vers_staff').map(e => {
          const crit = Array.isArray(e.criteres) ? e.criteres.filter(c=>c.note>0) : []
          const moy  = crit.length ? (crit.reduce((s,c)=>s+c.note,0)/crit.length) : 0
          return (
            <div key={e.id} style={card({ marginBottom:8 })} className="rh-row">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:C.cream, fontFamily:C.ui }}>📋 {e.evalueNom}</div>
                  <div style={{ fontSize:10, color:C.faint, marginTop:2, fontFamily:C.ui }}>{e.periode}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <Etoiles note={Math.round(moy)} readonly />
                  <div style={{ fontSize:10, color:C.muted, marginTop:2, fontFamily:C.font }}>{moy.toFixed(1)}/5</div>
                </div>
              </div>
              {e.pointsForts     && <p style={{ fontSize:12, color:C.success, marginBottom:3, fontFamily:C.ui }}>✅ {e.pointsForts}</p>}
              {e.axesAmelioration && <p style={{ fontSize:12, color:C.warn, fontFamily:C.ui }}>→ {e.axesAmelioration}</p>}
            </div>
          )
        })
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 6. SIGNALEMENTS
// ═══════════════════════════════════════════════════════
const CATS_SIG = [
  { id:'hygiene',  label:'Hygiène',          emoji:'🧹', color:C.success },
  { id:'conflit',  label:'Conflit',           emoji:'⚡', color:C.warn    },
  { id:'vol',      label:'Vol / détournement',emoji:'🚨', color:C.danger  },
  { id:'securite', label:'Sécurité',          emoji:'🔒', color:C.purple  },
  { id:'autre',    label:'Autre',             emoji:'💬', color:'#6B7280' },
]
const GRAV_COLOR = { normale:'#6B7280', grave:C.warn, critique:C.danger }
const STATUT_SIG = { ouvert:{ label:'Ouvert', color:C.danger }, en_traitement:{ label:'En traitement', color:C.warn }, resolu:{ label:'Résolu', color:C.success }, classe:{ label:'Classé', color:'#6B7280' } }

function SignalementsTab({ droits, restaurantId }) {
  const peutLire = droits.signalements.voir === 'tous'
  const [sigs,     setSigs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState({ categorie:'hygiene', description:'', gravite:'normale' })
  const [msg,      setMsg]      = useState({ type:'', text:'' })
  const [selected, setSelected] = useState(null)
  const [comm,     setComm]     = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!peutLire) { setLoading(false); return }
    const qs = restaurantId ? `?restaurantId=${restaurantId}` : ''
    fetch(`/api/rh/signalements${qs}`).then(r=>r.json()).then(d=>{ setSigs(Array.isArray(d)?d:[]); setLoading(false) }).catch(()=>setLoading(false))
  }, [restaurantId, peutLire])

  async function soumettre() {
    if (!form.description.trim()) { setMsg({ type:'err', text:'Description requise' }); return }
    await fetch('/api/rh/signalements', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, restaurantId }) })
    setMsg({ type:'ok', text:'Signalement envoyé. Votre identité n\'est pas enregistrée.' })
    setForm({ categorie:'hygiene', description:'', gravite:'normale' }); setShowForm(false)
  }

  async function traiter(id, statut) {
    await fetch('/api/rh/signalements', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, statut, commentaireTraitement:comm }) })
    setSelected(null); setComm('')
    setSigs(p=>p.map(s=>s.id===id ? {...s, statut, commentaireTraitement:comm} : s))
  }

  return (
    <div>
      {/* Zone soumission */}
      <div style={{ ...card({ background:C.dangerBg, border:`1px solid ${C.dangerBd}`, marginBottom:20 }) }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.danger, marginBottom:4, fontFamily:C.ui }}>🔒 Signalement anonyme</div>
            <div style={{ fontSize:11, color:C.muted, fontFamily:C.ui, lineHeight:1.6 }}>
              Votre identité n'est jamais enregistrée.{!peutLire && ' Le signalement va directement au propriétaire, pas à votre supérieur direct.'}
            </div>
          </div>
          <button onClick={() => setShowForm(p=>!p)} className="rh-btn"
            style={{ ...btnPrimary, background:'linear-gradient(135deg,#EF4444,#B91C1C)', flexShrink:0 }}>
            {showForm ? '✕ Fermer' : '⚠️ Signaler'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${C.dangerBd}`, animation:'rhSlideUp .2s ease' }}>
            {msg.text && <div style={toast(msg.type)}>{msg.type==='ok'?'✓ ':'⚠ '}{msg.text}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:12 }}>
              <div>
                <label style={lbl}>Catégorie</label>
                <select style={inp} className="rh-inp" value={form.categorie} onChange={e=>setForm(p=>({...p,categorie:e.target.value}))}>
                  {CATS_SIG.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Gravité</label>
                <select style={inp} className="rh-inp" value={form.gravite} onChange={e=>setForm(p=>({...p,gravite:e.target.value}))}>
                  <option value="normale">Normale</option>
                  <option value="grave">Grave</option>
                  <option value="critique">🚨 Critique</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Description *</label>
              <textarea style={{ ...inp, minHeight:80, resize:'vertical' }} className="rh-inp" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Décrivez la situation précisément…" />
            </div>
            <button onClick={soumettre} className="rh-btn" style={{ ...btnPrimary, background:'linear-gradient(135deg,#EF4444,#B91C1C)' }}>
              Envoyer anonymement
            </button>
          </div>
        )}
      </div>

      {/* Liste admin */}
      {peutLire && (
        loading ? <Spinner /> : sigs.length===0 ? (
          <Empty icon="✅" text="Aucun signalement ouvert" />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sigs.map(sig => {
              const cat = CATS_SIG.find(c=>c.id===sig.categorie) || CATS_SIG[4]
              const sta = STATUT_SIG[sig.statut] || STATUT_SIG.ouvert
              return (
                <div key={sig.id} style={{ ...card({ borderLeft:`3px solid ${GRAV_COLOR[sig.gravite]||'#6B7280'}` }) }} className="rh-row">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:16 }}>{cat.emoji}</span>
                        <span style={{ fontWeight:700, fontSize:13, color:C.cream, fontFamily:C.ui }}>{cat.label}</span>
                        <span style={badge(GRAV_COLOR[sig.gravite]||'#6B7280')}>{sig.gravite}</span>
                        <span style={badge(sta.color)}>{sta.label}</span>
                      </div>
                      <p style={{ fontSize:12, color:C.muted, marginBottom:4, fontFamily:C.ui }}>{sig.description}</p>
                      <div style={{ fontSize:10, color:C.faint, fontFamily:C.ui }}>
                        {new Date(sig.createdAt).toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                        {sig.traitePar && ` · Traité par ${sig.traitePar}`}
                      </div>
                      {sig.commentaireTraitement && <p style={{ fontSize:11, color:C.success, marginTop:6, fontFamily:C.ui }}>→ {sig.commentaireTraitement}</p>}
                    </div>
                    {['ouvert','en_traitement'].includes(sig.statut) && (
                      <div style={{ flexShrink:0 }}>
                        {selected===sig.id ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            <input style={{ ...inp, width:200 }} className="rh-inp" value={comm} onChange={e=>setComm(e.target.value)} placeholder="Commentaire de clôture" />
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={()=>traiter(sig.id,'en_traitement')} className="rh-btn" style={{ background:C.warnBg, border:`1px solid ${C.warnBd}`, color:C.warn, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:C.ui, transition:'all .15s' }}>En traitement</button>
                              <button onClick={()=>traiter(sig.id,'resolu')} className="rh-btn" style={{ background:C.successBg, border:`1px solid ${C.successBd}`, color:C.success, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:C.ui, transition:'all .15s' }}>✓ Résolu</button>
                            </div>
                            <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', color:C.faint, fontSize:11, cursor:'pointer', textAlign:'left', fontFamily:C.ui }}>Annuler</button>
                          </div>
                        ) : (
                          <button onClick={()=>setSelected(sig.id)} className="rh-btn"
                            style={{ background:C.goldSoft, border:`1px solid ${C.borderHi}`, color:C.gold, padding:'7px 14px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:C.ui, transition:'all .15s' }}>
                            Traiter →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 7. BADGES
// ═══════════════════════════════════════════════════════
function BadgesTab({ droits, restaurantId, userId, userName, userRole }) {
  const [data,     setData]     = useState({ badges:[], userBadges:[] })
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ userId:'', badgeCode:'', contexte:'' })
  const [msg,      setMsg]      = useState({ type:'', text:'' })
  const peutAttrib = droits.badges.modifier
  const voirEquipe = droits.badges.voir === 'tous' || droits.badges.voir === 'equipe'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (restaurantId) p.set('restaurantId', restaurantId)
      if (!voirEquipe)  p.set('userId', userId)
      const [rB, rU] = await Promise.all([
        fetch(`/api/rh/badges?${p}`),
        peutAttrib ? fetch('/api/users') : Promise.resolve({ ok:true, json:async()=>[] }),
      ])
      const dB=await rB.json(), dU=await rU.json()
      setData(dB)
      setUsers(Array.isArray(dU) ? dU.filter(u=>u.role!=='super_admin') : [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [restaurantId, userId, voirEquipe, peutAttrib])

  useEffect(() => { load() }, [load])

  async function attribuer() {
    if (!form.userId || !form.badgeCode) { setMsg({ type:'err', text:'Sélectionnez un employé et un badge' }); return }
    if (!form.contexte?.trim()) { setMsg({ type:'err', text:'Le motif est obligatoire' }); return }
    const usr = users.find(u=>u.id===form.userId)
    await fetch('/api/rh/badges', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, contexte:form.contexte.trim(), userName:usr?.name, restaurantId }) })
    setMsg({ type:'ok', text:'Badge attribué avec succès !' })
    setShowForm(false); setForm({ userId:'', badgeCode:'', contexte:'' }); load()
  }

  const parUser = {}
  data.userBadges?.forEach(ub => {
    if (!parUser[ub.userId]) parUser[ub.userId] = { nom:ub.userName, badges:[] }
    parUser[ub.userId].badges.push(ub)
  })

  return (
    <div>
      {!voirEquipe && <StatusBand icon="👤" text={`Vos badges — ${userName}`} color={C.info} bg={C.infoBg} bd={C.infoBd} />}

      {/* Catalogue */}
      <div style={{ marginBottom:20 }}>
        <SectionTitle>Catalogue des badges</SectionTitle>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {(data.badges||[]).map(b => (
            <div key={b.code} title={b.description} style={{ background:`${b.couleur}10`, border:`1px solid ${b.couleur}28`, borderRadius:10, padding:'8px 14px', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>{b.emoji}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:b.couleur, fontFamily:C.ui }}>{b.label}</div>
                <div style={{ fontSize:9, color:C.faint, maxWidth:120, fontFamily:C.ui }}>{b.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {peutAttrib && (
        <div style={{ marginBottom:16 }}>
          <button onClick={() => setShowForm(p=>!p)} className="rh-btn" style={btnPrimary}>{showForm ? '✕ Fermer' : '🏅 Attribuer un badge'}</button>
          {showForm && (
            <div style={{ ...card({ border:`1px solid ${C.borderHi}`, marginTop:12 }), animation:'rhSlideUp .2s ease' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:10 }}>
                <div>
                  <label style={lbl}>Employé</label>
                  <select style={inp} className="rh-inp" value={form.userId} onChange={e=>setForm(p=>({...p,userId:e.target.value}))}>
                    <option value="">— Sélectionner —</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Badge</label>
                  <select style={inp} className="rh-inp" value={form.badgeCode} onChange={e=>setForm(p=>({...p,badgeCode:e.target.value}))}>
                    <option value="">— Sélectionner —</option>
                    {(data.badges||[]).map(b=><option key={b.code} value={b.code}>{b.emoji} {b.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lbl}>Motif <span style={{ color:C.danger }}>*</span></label>
                <input style={inp} className="rh-inp" value={form.contexte} onChange={e=>setForm(p=>({...p,contexte:e.target.value}))} placeholder="Ex: Meilleur vendeur mai 2026" />
              </div>
              <button onClick={attribuer} className="rh-btn" style={btnPrimary}>Attribuer le badge</button>
            </div>
          )}
        </div>
      )}

      {msg.text && <div style={toast(msg.type)}>{msg.type==='ok'?'✓ ':'⚠ '}{msg.text}</div>}

      {loading ? <Spinner /> : Object.keys(parUser).length===0 ? (
        <Empty icon="🏅" text={voirEquipe ? 'Aucun badge attribué dans l\'équipe.' : 'Vous n\'avez pas encore de badge.'} />
      ) : Object.entries(parUser).map(([uid, { nom, badges }]) => (
        <div key={uid} style={card({ marginBottom:8 })} className="rh-row">
          {voirEquipe && <div style={{ fontWeight:700, fontSize:13, color:C.cream, marginBottom:10, fontFamily:C.ui }}>{nom}</div>}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {badges.map(ub => (
              <div key={ub.id} title={ub.badge?.description} style={{ background:`${ub.badge?.couleur||C.gold}14`, border:`1px solid ${ub.badge?.couleur||C.gold}30`, borderRadius:8, padding:'7px 12px', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>{ub.badge?.emoji}</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:ub.badge?.couleur||C.gold, fontFamily:C.ui }}>{ub.badge?.label}</div>
                  {ub.contexte && <div style={{ fontSize:9, color:C.faint, fontFamily:C.ui }}>{ub.contexte}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// RHPanel — COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════
export default function RHPanel({ user }) {
  useRHStyles()

  const userRole     = user?.role || 'staff'
  const userId       = user?.userId || user?.login || ''
  const userName     = user?.name  || ''
  const restaurantId = user?.restaurantId || null
  const droits       = getDroits(userRole)
  const isAdmin      = ['super_admin','manager'].includes(userRole)

  const [subTab, setSubTab] = useState(() => isAdmin ? 'scores' : 'checklists')
  const tabs = tabsVisibles(userRole)

  return (
    <div style={{ fontFamily:C.ui, maxWidth:680, padding:'0 0 40px' }}>
      {/* En-tête */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
          <h2 style={{ fontSize:20, fontWeight:800, color:C.gold, margin:0, fontFamily:C.ui }}>Ressources Humaines</h2>
          <span style={{ fontSize:11, color:C.faint, fontFamily:C.ui }}>
            {isAdmin ? 'gestion & performance' : `espace de ${userName}`}
          </span>
        </div>

        {/* Navigation onglets */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:14, borderBottom:`1px solid ${C.border}`, paddingBottom:0 }}>
          {tabs.map(t => {
            const active = subTab === t.id
            return (
              <button key={t.id} onClick={() => setSubTab(t.id)} className="rh-tab-btn"
                style={{
                  padding:'9px 14px', border:'none', cursor:'pointer', fontFamily:C.ui,
                  fontSize:12, fontWeight: active ? 700 : 500,
                  color: active ? C.gold : C.muted,
                  background:'transparent',
                  borderBottom: active ? `2px solid ${C.gold}` : '2px solid transparent',
                  marginBottom:-1, borderRadius:0,
                  transition:'all .15s', letterSpacing:'.02em',
                  display:'flex', alignItems:'center', gap:5,
                }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ animation:'rhFadeIn .2s ease' }} key={subTab}>
        {subTab==='scores'       && <ScoresTab       droits={droits} restaurantId={restaurantId} userId={userId} userName={userName} userRole={userRole} />}
        {subTab==='planning'     && <PlanningTab     droits={droits} restaurantId={restaurantId} userId={userId} userName={userName} />}
        {subTab==='checklists'   && <ChecklistTab    droits={droits} restaurantId={restaurantId} userId={userId} userRole={userRole} userName={userName} />}
        {subTab==='heures_sup'   && <HeuresSupTab    droits={droits} restaurantId={restaurantId} userId={userId} userName={userName} />}
        {subTab==='evaluations'  && <EvaluationsTab  droits={droits} restaurantId={restaurantId} userId={userId} userRole={userRole} />}
        {subTab==='signalements' && <SignalementsTab droits={droits} restaurantId={restaurantId} />}
        {subTab==='badges'       && <BadgesTab       droits={droits} restaurantId={restaurantId} userId={userId} userName={userName} userRole={userRole} />}
      </div>
    </div>
  )
}
