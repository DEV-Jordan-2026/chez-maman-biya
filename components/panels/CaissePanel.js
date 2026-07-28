'use client'

import { useState, useEffect, useCallback } from 'react'
import useSSE from '@/hooks/useSSE' // B6 — SSE avec reconnexion automatique

/* ─────────────────────────────────────────
   DESIGN TOKENS  (dark POS · or/ambre)
───────────────────────────────────────── */
const T = {
  bg:         '#0D0D0F',
  surface:    '#141417',
  surfaceHi:  '#1C1C22',
  border:     'rgba(201,151,60,.18)',
  borderHi:   'rgba(201,151,60,.45)',
  gold:       '#C9973C',
  goldSoft:   'rgba(201,151,60,.12)',
  goldGlow:   'rgba(201,151,60,.25)',
  cream:      '#EDE8DC',
  creamFaint: 'rgba(237,232,220,.45)',
  success:    '#22C55E',
  successBg:  'rgba(34,197,94,.08)',
  successBd:  'rgba(34,197,94,.25)',
  danger:     '#EF4444',
  dangerBg:   'rgba(239,68,68,.08)',
  dangerBd:   'rgba(239,68,68,.25)',
  warn:       '#F59E0B',
  warnBg:     'rgba(245,158,11,.08)',
  warnBd:     'rgba(245,158,11,.25)',
  radius:     '14px',
  radiusSm:   '8px',
  font:       "'JetBrains Mono','Fira Code','Courier New',monospace",
  fontUI:     "'Inter',sans-serif",
}

/* ── Style helpers ── */
const card  = (x = {}) => ({ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px', ...x })
const pill  = (a)      => ({ padding: '7px 20px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer', border: `1px solid ${a ? T.gold : T.border}`, background: a ? T.goldSoft : 'transparent', color: a ? T.gold : T.creamFaint, transition: 'all .18s', fontFamily: T.fontUI, textTransform: 'uppercase' })
const lbl   = { fontSize: 9, color: T.creamFaint, letterSpacing: '.1em', display: 'block', marginBottom: 5, fontFamily: T.fontUI, textTransform: 'uppercase', fontWeight: 600 }
const inp   = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.04)', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, color: T.cream, padding: '11px 14px', fontSize: 14, fontFamily: T.font, outline: 'none', transition: 'border-color .15s' }

/* ══════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════ */

function KpiBadge({ label, value, sub, accent, color }) {
  return (
    <div style={{ background: T.surfaceHi, border: `1px solid ${accent ? T.borderHi : T.border}`, borderRadius: T.radiusSm, padding: '14px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: '.1em', color: T.creamFaint, marginBottom: 4, fontFamily: T.fontUI, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: color || (accent ? T.gold : T.cream), fontFamily: T.font, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.creamFaint, marginTop: 3, fontFamily: T.fontUI }}>{sub}</div>}
    </div>
  )
}

function VirtualKeypad({ value, onChange, onConfirm, onCancel, label = 'MONTANT' }) {
  const append = k => {
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (k === 'C')  { onChange(''); return }
    if (value.length >= 9) return
    onChange(value + k)
  }
  const keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫']
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(6px)', animation: 'cpFadeIn .18s ease' }}>
      <div style={{ background: T.surface, border: `1px solid ${T.borderHi}`, borderRadius: 20, padding: 28, width: 320, boxShadow: `0 0 60px ${T.goldGlow}`, animation: 'cpSlideUp .2s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ fontSize: 10, letterSpacing: '.12em', color: T.gold, marginBottom: 10, fontFamily: T.fontUI, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ background: T.bg, border: `1px solid ${T.borderHi}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontFamily: T.font, fontSize: 26, fontWeight: 700, color: T.cream, textAlign: 'right', letterSpacing: '.04em', minHeight: 56 }}>
          {value ? parseInt(value).toLocaleString('fr-FR') : '0'}
          <span style={{ color: T.gold, fontSize: 14, marginLeft: 6 }}>FCFA</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {keys.map(k => (
            <button key={k} onClick={() => append(k)} style={{ background: k === 'C' ? T.dangerBg : k === '⌫' ? 'rgba(255,255,255,.05)' : T.surfaceHi, border: `1px solid ${k === 'C' ? T.dangerBd : T.border}`, color: k === 'C' ? T.danger : T.cream, borderRadius: 10, padding: '14px 0', fontSize: 18, fontWeight: 700, cursor: 'pointer', fontFamily: T.font, transition: 'all .12s' }}>{k}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', background: 'transparent', border: `1px solid ${T.border}`, color: T.creamFaint, borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontFamily: T.fontUI }}>Annuler</button>
          <button onClick={() => value && onConfirm(parseInt(value))} disabled={!value} style={{ flex: 2, padding: '12px 0', background: value ? `linear-gradient(135deg,${T.gold},#A85E28)` : 'rgba(255,255,255,.05)', border: 'none', color: value ? '#fff' : T.creamFaint, borderRadius: 10, cursor: value ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14, fontFamily: T.fontUI, transition: 'all .15s' }}>✓ Confirmer</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,.04)` }}>
      <span style={{ fontSize: 12, color: T.creamFaint, fontFamily: T.fontUI }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: color || T.cream, fontFamily: T.font }}>{value}</span>
    </div>
  )
}

/* ── Modal résumé avant clôture ── */
function ModalResume({ preview, espInput, session, onConfirm, onCancel, busy }) {
  const totalRecettes = (preview?.totalRecettes || 0)
  const totalTheo     = (preview?.totalTheorique || 0)
  const espComptees   = parseInt(espInput) || null
  const ecart         = espComptees !== null ? espComptees - totalTheo : null
  const ecartOk       = ecart === null || ecart === 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 998, backdropFilter: 'blur(5px)', padding: 16, animation: 'cpFadeIn .18s ease' }}>
      <div style={{ background: T.surface, border: `1px solid ${T.dangerBd}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, animation: 'cpSlideUp .2s cubic-bezier(.22,1,.36,1)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Titre */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.cream, fontFamily: T.fontUI }}>Récapitulatif de clôture</div>
          <div style={{ fontSize: 11, color: T.creamFaint, marginTop: 3, fontFamily: T.fontUI }}>{session?.ouvertPar} · {new Date(session?.ouvertureAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>

        {/* Ventilation */}
        <div style={{ ...card({ marginBottom: 14 }) }}>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Recettes de la session</div>
          <Row label="💵 Espèces"           value={`${(preview?.especes||0).toLocaleString('fr-FR')} FCFA`} />
          <Row label="📱 Mobile Money"      value={`${(preview?.momo||0).toLocaleString('fr-FR')} FCFA`} />
          <Row label="🏠 Restaurant"        value={`${(preview?.resto||0).toLocaleString('fr-FR')} FCFA`} />
          <Row label="🛵 Livraison espèces" value={`${(preview?.livraison||0).toLocaleString('fr-FR')} FCFA`} />
          <div style={{ borderTop: `1px solid ${T.borderHi}`, marginTop: 8, paddingTop: 8 }}>
            <Row label="TOTAL RECETTES" value={`${totalRecettes.toLocaleString('fr-FR')} FCFA`} bold color={T.success} />
            <Row label="Nb commandes"   value={preview?.nb || 0} />
          </div>
        </div>

        {/* Contrôle caisse */}
        <div style={{ ...card({ marginBottom: 14, border: `1px solid ${ecartOk ? T.border : T.dangerBd}` }) }}>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Contrôle de caisse</div>
          <Row label="Fond de caisse"      value={`${(session?.fondCaisse||0).toLocaleString('fr-FR')} FCFA`} />
          <Row label="Espèces encaissées"  value={`${(preview?.especes||0).toLocaleString('fr-FR')} FCFA`} />
          <Row label="Total théorique"     value={`${totalTheo.toLocaleString('fr-FR')} FCFA`} bold />
          {espComptees !== null && (
            <>
              <Row label="Espèces comptées" value={`${espComptees.toLocaleString('fr-FR')} FCFA`} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, marginTop: 8, background: ecartOk ? T.successBg : T.dangerBg, border: `1px solid ${ecartOk ? T.successBd : T.dangerBd}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: ecartOk ? T.success : T.danger }}>Écart de caisse</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: ecartOk ? T.success : T.danger, fontFamily: T.font }}>
                  {ecart >= 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </>
          )}
          {espComptees === null && (
            <div style={{ fontSize: 10, color: T.creamFaint, marginTop: 8, fontStyle: 'italic' }}>Aucun comptage physique saisi — écart non calculé.</div>
          )}
        </div>

        {!ecartOk && (
          <div style={{ background: T.warnBg, border: `1px solid ${T.warnBd}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: T.warn }}>
            ⚠️ Un écart de {Math.abs(ecart).toLocaleString('fr-FR')} FCFA a été détecté. La clôture est toujours possible mais sera enregistrée.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.creamFaint, borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontFamily: T.fontUI }}>
            Retour
          </button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 2, padding: '12px', background: busy ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#EF4444,#B91C1C)', border: 'none', color: busy ? T.creamFaint : '#fff', borderRadius: 10, cursor: busy ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: T.fontUI, transition: 'all .15s' }}>
            {busy ? '⏳ Clôture…' : '✓ Confirmer la clôture'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Carte historique ── */
function HistoCard({ s, onPrint }) {
  const [open, setOpen] = useState(false)
  const total   = (s.totalEspeces||0)+(s.totalMoMo||0)+(s.totalResto||0)+(s.totalLivraison||0)
  const ecartOk = (s.ecart||0) >= 0
  // Extraire numéro rapport Z depuis la note
  const match   = (s.note || '').match(/Z-\d+/)
  const numZ    = match ? match[0] : null

  return (
    <div style={{ ...card({ marginBottom: 10, cursor: 'pointer' }), transition: 'border-color .15s' }} onClick={() => setOpen(o => !o)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: T.cream, fontFamily: T.fontUI, display: 'flex', alignItems: 'center', gap: 8 }}>
            {new Date(s.ouvertureAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {numZ && <span style={{ fontSize: 10, color: T.gold, background: T.goldSoft, padding: '2px 8px', borderRadius: 20, fontFamily: T.font }}>{numZ}</span>}
          </div>
          <div style={{ fontSize: 10, color: T.creamFaint, marginTop: 3, fontFamily: T.font }}>
            {s.ouvertPar} · {s.nbCommandes} cmd · {new Date(s.ouvertureAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}–{s.fermetureAt ? new Date(s.fermetureAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '…'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.success, fontFamily: T.font }}>{total.toLocaleString('fr-FR')}<span style={{ fontSize: 9, marginLeft: 3 }}>FCFA</span></div>
          <div style={{ fontSize: 10, color: ecartOk ? T.success : T.danger, fontFamily: T.font }}>Écart {ecartOk?'+':''}{(s.ecart||0).toLocaleString('fr-FR')} FCFA</div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`, animation: 'cpFadeIn .15s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 14 }}>
            {[['💵 Espèces',s.totalEspeces],['📱 MoMo',s.totalMoMo],['🏠 Restaurant',s.totalResto],['🛵 Livraison',s.totalLivraison]].map(([l,v]) => (
              <div key={l} style={{ background: T.surfaceHi, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 9, color: T.creamFaint, fontFamily: T.fontUI, textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.cream, fontFamily: T.font, marginTop: 2 }}>{(v||0).toLocaleString('fr-FR')}</div>
              </div>
            ))}
          </div>
          {s.note && s.note.replace(/Z-\d+/, '').trim() && (
            <div style={{ fontSize: 11, color: T.creamFaint, fontStyle: 'italic', marginBottom: 12 }}>
              Note : {s.note.replace(/Z-\d+\]?\s?/, '').replace(/^\[/, '')}
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); onPrint(s) }} style={{ background: T.goldSoft, border: `1px solid ${T.borderHi}`, color: T.gold, padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.fontUI, letterSpacing: '.04em' }}>
            🖨️ Rapport Z
          </button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function CaissePanel({ user = {} }) {
  const [session,      setSession]    = useState(null)
  const [historique,   setHisto]      = useState([])
  const [loading,      setLoading]    = useState(true)
  const [fondInput,    setFondInput]  = useState('')
  const [espInput,     setEspInput]   = useState('')
  const [noteClot,     setNote]       = useState('')
  const [busy,         setBusy]       = useState(false)
  const [feedback,     setFb]         = useState(null)
  const [vue,          setVue]        = useState('session')
  const [showFondKP,   setFondKP]     = useState(false)
  const [showEspKP,    setEspKP]      = useState(false)
  const [preview,      setPreview]    = useState(null)   // données résumé avant clôture
  const [showResume,   setShowResume] = useState(false)
  const [loadPreview,  setLoadPreview]= useState(false)
  // M2 — Paramètres restaurant pour nom dynamique dans rapport Z
  const [parametres,   setParametres] = useState(null)

  const userName = user?.name  || user?.login || 'Caissier'
  const userRole = user?.role  || 'caissier'
  const isAdmin  = ['super_admin','manager'].includes(userRole)

  const fb = (msg, type = 'success') => { setFb({ msg, type }); setTimeout(() => setFb(null), 5000) }

  const fetchSession = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/caisse').then(r => r.json()),
        fetch('/api/caisse?historique=1').then(r => r.json()),
      ])
      setSession(r1 && typeof r1 === 'object' && r1.id ? r1 : null)
      setHisto(Array.isArray(r2) ? r2 : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSession()
    // M2 — Charger les paramètres restaurant pour le nom dynamique
    fetch('/api/parametres').then(r => r.ok ? r.json() : null).then(d => { if (d) setParametres(d) }).catch(() => {})
  }, [fetchSession])

  // B6 — Synchronisation temps réel via le hook useSSE (reconnexion automatique avec backoff).
  // Remplace le raw EventSource v3 qui n'avait aucune logique de reconnexion.
  // Re-fetch la session dès qu'une commande passe en statut 'livre'
  // (paiement livreur terrain OU encaissement caisse).
  useSSE({
    onCommandeStatus: ({ status }) => {
      if (status === 'livre') fetchSession()
    },
  })

  async function ouvrirSession(fond) {
    setBusy(true)
    const res  = await fetch('/api/caisse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fondCaisse: fond }) })
    const data = await res.json()
    if (res.ok) { setSession(data); setFondInput(''); fb('Caisse ouverte avec succès') }
    else fb(data.error || "Erreur lors de l'ouverture", 'error')
    setBusy(false)
  }

  // Étape 1 : charger la prévisualisation
  async function demanderResume() {
    if (!session) return
    setLoadPreview(true)
    try {
      const r    = await fetch(`/api/caisse?mode=preview&sessionId=${session.id}`)
      const data = await r.json()
      setPreview(data)
      setShowResume(true)
    } catch { fb("Erreur lors du chargement du résumé", 'error') }
    setLoadPreview(false)
  }

  // Étape 2 : confirmer la clôture depuis la modal résumé
  async function fermerSession() {
    if (!session) return
    setBusy(true)
    const res  = await fetch('/api/caisse', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, especes_comptes: espInput ? parseInt(espInput) : undefined, note: noteClot }) })
    const data = await res.json()
    if (res.ok) {
      setSession(null); setEspInput(''); setNote(''); setShowResume(false); setPreview(null)
      await fetchSession()
      fb(`Caisse clôturée · Rapport ${data.numeroRapportZ || 'Z'} généré`)
      // Imprimer le rapport Z automatiquement
      setTimeout(() => imprimerRapport({ ...data }), 400)
    } else fb(data.error || 'Erreur lors de la clôture', 'error')
    setBusy(false)
  }

  function imprimerRapport(s) {
    const win = window.open('', '_blank')
    if (!win) { alert('Impression bloquée par le navigateur. Autorisez les popups pour ce site dans les paramètres de votre navigateur, puis réessayez.'); return }
    const total  = (s.totalEspeces||0)+(s.totalMoMo||0)+(s.totalResto||0)+(s.totalLivraison||0)
    const match  = (s.note||'').match(/Z-\d+/)
    const numZ   = match ? match[0] : 'Z-?????'
    const noteTexte = (s.note||'').replace(/Z-\d+\]?\s?/, '').replace(/^\[/, '').trim()
    const ecartOk   = (s.ecart||0) >= 0
    const dateImp   = new Date().toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})

    win.document.write(`<!DOCTYPE html><html lang="fr"><head><title>Rapport ${numZ}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;max-width:320px;margin:0 auto;padding:24px 16px;font-size:12px;color:#111;background:#fff}
      h1{text-align:center;font-size:15px;letter-spacing:.15em;margin-bottom:2px}
      h2{text-align:center;font-size:11px;letter-spacing:.08em;font-weight:normal;opacity:.5;margin-bottom:14px}
      hr{border:none;border-top:1px dashed #aaa;margin:10px 0}
      .row{display:flex;justify-content:space-between;padding:3px 0}
      .bold{font-weight:bold}.big{font-size:15px}.ok{color:#15803d}.err{color:#dc2626}
      .badge{display:inline-block;padding:2px 10px;border:1px solid #111;border-radius:20px;font-size:10px;letter-spacing:.08em;margin:6px auto 2px;display:block;text-align:center;width:fit-content}
      .section{font-size:9px;letter-spacing:.1em;opacity:.4;text-transform:uppercase;margin:8px 0 3px}
      .footer{text-align:center;font-size:9px;opacity:.35;margin-top:14px;line-height:1.6}
    </style></head><body>
    <h1>★ ${parametres?.nom || session?.restaurantNom || 'CHEZ MAMAN BIYA'} ★</h1>
    <h2>RAPPORT DE CLÔTURE DE CAISSE</h2>
    <span class="badge">${numZ}</span>
    <hr>
    <p class="section">Session</p>
    <div class="row"><span>Caissier</span><span>${s.ouvertPar}</span></div>
    <div class="row"><span>Date</span><span>${new Date(s.ouvertureAt).toLocaleDateString('fr-FR')}</span></div>
    <div class="row"><span>Ouverture</span><span>${new Date(s.ouvertureAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span></div>
    <div class="row"><span>Fermeture</span><span>${s.fermetureAt ? new Date(s.fermetureAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span></div>
    <div class="row"><span>Fond de caisse</span><span>${(s.fondCaisse||0).toLocaleString('fr-FR')} FCFA</span></div>
    <hr>
    <p class="section">Recettes par mode</p>
    <div class="row"><span>💵 Espèces</span><span>${(s.totalEspeces||0).toLocaleString('fr-FR')} FCFA</span></div>
    <div class="row"><span>📱 Mobile Money</span><span>${(s.totalMoMo||0).toLocaleString('fr-FR')} FCFA</span></div>
    <div class="row"><span>🏠 Restaurant</span><span>${(s.totalResto||0).toLocaleString('fr-FR')} FCFA</span></div>
    <div class="row"><span>🛵 Livraison</span><span>${(s.totalLivraison||0).toLocaleString('fr-FR')} FCFA</span></div>
    <hr>
    <div class="row bold big"><span>TOTAL RECETTES</span><span>${total.toLocaleString('fr-FR')} FCFA</span></div>
    <div class="row"><span>Nb commandes</span><span>${s.nbCommandes}</span></div>
    <hr>
    <p class="section">Contrôle de caisse</p>
    <div class="row"><span>Total théorique espèces</span><span>${((s.fondCaisse||0)+(s.totalEspeces||0)).toLocaleString('fr-FR')} FCFA</span></div>
    <div class="row ${ecartOk?'ok':'err'} bold"><span>Écart de caisse</span><span>${ecartOk?'+':''}${(s.ecart||0).toLocaleString('fr-FR')} FCFA</span></div>
    ${noteTexte ? `<hr><div class="row"><span style="font-style:italic;opacity:.6">Note : ${noteTexte}</span></div>` : ''}
    <hr>
    <div class="footer">
      Imprimé le ${dateImp}<br>
      Ce document est un justificatif fiscal interne.<br>
      Conservation obligatoire — Chez Maman Biya<br>
      ────────── Fin du ${numZ} ──────────
    </div>
    </body></html>`)
    win.document.close(); win.print()
  }

  /* ── CSS injecté une fois ── */
  useEffect(() => {
    if (document.getElementById('cp-css')) return
    const s = document.createElement('style')
    s.id = 'cp-css'
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
      @keyframes cpSpin    { to { transform:rotate(360deg) } }
      @keyframes cpPulse   { 0%,100%{opacity:1}50%{opacity:.4} }
      @keyframes cpFadeIn  { from{opacity:0}to{opacity:1} }
      @keyframes cpScaleIn { from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)} }
      @keyframes cpSlideUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
      .cp-input:focus  { border-color:${T.gold} !important; }
      .cp-btn-p:hover:not(:disabled) { filter:brightness(1.12);transform:translateY(-1px) }
      .cp-btn-d:hover:not(:disabled) { filter:brightness(1.1);transform:translateY(-1px) }
    `
    document.head.appendChild(s)
  }, [])

  /* ─── LOADING ─── */
  if (loading) return (
    <div style={{ padding: '80px 0', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${T.goldSoft}`, borderTop: `3px solid ${T.gold}`, borderRadius: '50%', animation: 'cpSpin 1s linear infinite' }} />
      <span style={{ fontSize: 11, color: T.creamFaint, fontFamily: T.fontUI, letterSpacing: '.06em', textTransform: 'uppercase' }}>Initialisation de la caisse…</span>
    </div>
  )

  /* ─── RENDER ─── */
  return (
    <div style={{ fontFamily: T.fontUI, maxWidth: 640 }}>

      {/* Keypads virtuels */}
      {showFondKP && <VirtualKeypad value={fondInput} onChange={setFondInput} label="Fond de caisse (FCFA)" onConfirm={v => { setFondInput(String(v)); setFondKP(false) }} onCancel={() => setFondKP(false)} />}
      {showEspKP  && <VirtualKeypad value={espInput}  onChange={setEspInput}  label="Espèces comptées (FCFA)" onConfirm={v => { setEspInput(String(v)); setEspKP(false) }}  onCancel={() => setEspKP(false)} />}

      {/* Modal résumé avant clôture */}
      {showResume && (
        <ModalResume
          preview={preview}
          espInput={espInput}
          session={session}
          onConfirm={fermerSession}
          onCancel={() => setShowResume(false)}
          busy={busy}
        />
      )}

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.gold, margin: 0 }}>💳 Gestion de caisse</h2>
          <span style={{ fontSize: 11, color: T.creamFaint }}>{isAdmin ? 'vue manager' : `session de ${userName}`}</span>
        </div>
        {!isAdmin && <div style={{ fontSize: 11, color: T.creamFaint, marginTop: 3 }}>Seules vos sessions personnelles sont visibles.</div>}
      </div>

      {/* ── Barre de statut ── */}
      <div style={{ background: session ? T.successBg : T.dangerBg, border: `1px solid ${session ? T.successBd : T.dangerBd}`, borderRadius: T.radius, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, animation: 'cpScaleIn .22s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: session ? T.success : T.danger, boxShadow: `0 0 8px ${session ? T.success : T.danger}`, animation: session ? 'cpPulse 2s infinite' : 'none' }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: session ? T.success : T.danger }}>{session ? 'CAISSE OUVERTE' : 'CAISSE FERMÉE'}</div>
            {session && (() => { const mins = Math.floor((Date.now() - new Date(session.ouvertureAt)) / 60000); const h = Math.floor(mins/60), m = mins%60; return <div style={{ fontSize: 10, color: T.creamFaint, marginTop: 1, fontFamily: T.font }}>{session.ouvertPar} · {h>0?`${h}h `:''}  {m}min</div> })()}
          </div>
        </div>
        {session && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: T.creamFaint, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fond de caisse</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.gold, fontFamily: T.font }}>{session.fondCaisse?.toLocaleString('fr-FR')} <span style={{ fontSize: 10 }}>FCFA</span></div>
          </div>
        )}
      </div>

      {/* Toast */}
      {feedback && (
        <div style={{ background: feedback.type === 'error' ? T.dangerBg : T.successBg, border: `1px solid ${feedback.type === 'error' ? T.dangerBd : T.successBd}`, borderRadius: T.radiusSm, padding: '10px 16px', marginBottom: 16, fontSize: 12, fontWeight: 600, color: feedback.type === 'error' ? T.danger : T.success, animation: 'cpScaleIn .22s cubic-bezier(.22,1,.36,1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {feedback.type === 'error' ? '⚠' : '✓'} {feedback.msg}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['session','💳 Session courante'],['historique','📋 Historique']].map(([id,label]) => (
          <button key={id} onClick={() => setVue(id)} style={pill(vue===id)}>{label}</button>
        ))}
      </div>

      {/* ══ VUE SESSION ══ */}
      {vue === 'session' && (
        <div style={{ animation: 'cpFadeIn .2s ease' }}>
          {session ? (
            <>
              {/* KPIs en grille 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                <KpiBadge label="Total recettes" value={((session.totalEspeces||0)+(session.totalMoMo||0)+(session.totalResto||0)+(session.totalLivraison||0)).toLocaleString('fr-FR')} sub="FCFA en cours" accent />
                <KpiBadge label="Commandes"       value={session.nbCommandes ?? '—'} sub="cette session" />
                <KpiBadge label="Espèces"         value={(session.totalEspeces||0).toLocaleString('fr-FR')} sub="FCFA" color={T.warn} />
                <KpiBadge label="Mobile Money"    value={(session.totalMoMo||0).toLocaleString('fr-FR')} sub="FCFA" />
              </div>

              {/* Ventilation avec barres */}
              <div style={{ ...card({ marginBottom: 16 }) }}>
                <div style={{ fontSize: 10, color: T.gold, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>Ventilation par mode de paiement</div>
                {[['💵','Espèces',session.totalEspeces],['📱','Mobile Money',session.totalMoMo],['🏠','Restaurant',session.totalResto],['🛵','Livraison',session.totalLivraison]].map(([ico,lbl,val]) => {
                  const tot = (session.totalEspeces||0)+(session.totalMoMo||0)+(session.totalResto||0)+(session.totalLivraison||0)
                  const pct = tot > 0 ? Math.round(((val||0)/tot)*100) : 0
                  return (
                    <div key={lbl} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: T.creamFaint }}>{ico} {lbl}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.cream, fontFamily: T.font }}>{(val||0).toLocaleString('fr-FR')} FCFA <span style={{ fontSize: 10, color: T.gold }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${T.gold},#A85E28)`, borderRadius: 3, transition: 'width .6s cubic-bezier(.22,1,.36,1)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Formulaire clôture */}
              <div style={{ ...card({ border: `1px solid ${T.dangerBd}` }) }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.danger, marginBottom: 18, letterSpacing: '.04em' }}>🔒 CLÔTURER LA CAISSE</div>

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Espèces comptées physiquement <span style={{ color: T.creamFaint }}>(optionnel)</span></label>
                  <button onClick={() => setEspKP(true)} style={{ width: '100%', textAlign: 'left', ...inp, cursor: 'pointer', color: espInput ? T.cream : T.creamFaint, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: T.font, fontWeight: espInput ? 700 : 400 }}>{espInput ? `${parseInt(espInput).toLocaleString('fr-FR')} FCFA` : 'Appuyer pour saisir…'}</span>
                    <span style={{ fontSize: 16 }}>🔢</span>
                  </button>
                  <div style={{ fontSize: 10, color: T.creamFaint, marginTop: 4 }}>Permet de calculer l'écart de caisse dans le rapport Z.</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Note de clôture <span style={{ color: T.creamFaint }}>(optionnel)</span></label>
                  <input value={noteClot} onChange={e => setNote(e.target.value)} placeholder="Remarques, incidents, anomalies…" className="cp-input" style={{ ...inp }} />
                </div>

                <button onClick={demanderResume} disabled={busy || loadPreview} className="cp-btn-d" style={{ width: '100%', background: (busy||loadPreview) ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#EF4444,#B91C1C)', border: 'none', color: (busy||loadPreview) ? T.creamFaint : '#fff', padding: '14px 0', borderRadius: T.radiusSm, fontSize: 14, fontWeight: 700, cursor: (busy||loadPreview) ? 'wait' : 'pointer', transition: 'all .15s', letterSpacing: '.04em' }}>
                  {loadPreview ? '⏳ Calcul du résumé…' : '🔒 Voir le récapitulatif & clôturer'}
                </button>
              </div>
            </>
          ) : (
            /* ── Ouvrir la caisse ── */
            <div style={{ ...card({ maxWidth: 420, border: `1px solid ${T.goldGlow}`, margin: '0 auto' }) }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>💰</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.gold }}>Ouvrir la caisse</div>
                <div style={{ fontSize: 12, color: T.creamFaint, marginTop: 6 }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Fond de caisse de départ (FCFA)</label>
                <button onClick={() => setFondKP(true)} style={{ width: '100%', textAlign: 'left', ...inp, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: fondInput ? T.cream : T.creamFaint, borderColor: fondInput ? T.gold : T.border }}>
                  <span style={{ fontFamily: T.font, fontSize: 16, fontWeight: 700 }}>{fondInput ? `${parseInt(fondInput).toLocaleString('fr-FR')} FCFA` : 'Appuyer pour saisir…'}</span>
                  <span style={{ fontSize: 20 }}>🔢</span>
                </button>
                <div style={{ fontSize: 10, color: T.creamFaint, marginTop: 6 }}>Espèces présentes en caisse au démarrage de la session.</div>
              </div>

              <button onClick={() => fondInput && ouvrirSession(parseInt(fondInput))} disabled={busy || !fondInput} className="cp-btn-p" style={{ width: '100%', background: fondInput ? `linear-gradient(135deg,${T.gold},#A85E28)` : 'rgba(255,255,255,.05)', border: 'none', color: fondInput ? '#fff' : T.creamFaint, padding: '15px 0', borderRadius: T.radiusSm, fontSize: 15, fontWeight: 700, cursor: !fondInput||busy ? 'not-allowed' : 'pointer', opacity: !fondInput ? .5 : 1, transition: 'all .15s', letterSpacing: '.04em' }}>
                {busy ? '⏳ Ouverture…' : '✓ Ouvrir la caisse'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ VUE HISTORIQUE ══ */}
      {vue === 'historique' && (
        <div style={{ animation: 'cpFadeIn .2s ease' }}>
          {!isAdmin && (
            <div style={{ background: T.warnBg, border: `1px solid ${T.warnBd}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 11, color: T.warn }}>
              🔒 Vous consultez uniquement vos propres sessions. L'accès à l'historique complet est réservé aux managers.
            </div>
          )}
          {historique.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.creamFaint }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 13 }}>Aucune session enregistrée</div>
            </div>
          ) : (
            <>
              {/* Récap global */}
              <div style={{ ...card({ marginBottom: 16, background: T.surfaceHi, border: `1px solid ${T.borderHi}` }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.gold, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Récapitulatif — {historique.length} session{historique.length>1?'s':''}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.cream, fontFamily: T.font }}>
                      {historique.reduce((a,s)=>a+(s.totalEspeces||0)+(s.totalMoMo||0)+(s.totalResto||0)+(s.totalLivraison||0),0).toLocaleString('fr-FR')}
                      <span style={{ fontSize: 11, color: T.gold, marginLeft: 6 }}>FCFA</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: T.creamFaint }}>Commandes totales</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.cream }}>{historique.reduce((a,s)=>a+(s.nbCommandes||0),0)}</div>
                  </div>
                </div>
              </div>
              {historique.map(s => <HistoCard key={s.id} s={s} onPrint={imprimerRapport} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
