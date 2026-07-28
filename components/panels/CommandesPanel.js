'use client'
// CommandesPanel.js — v12 LUXURY · Chez Maman Biya

import { useState, useEffect } from 'react'

const STATUS_CONFIG = {
  nouveau        : { label:'Nouveau',        color:'#3B82F6', bg:'rgba(59,130,246,.1)',   icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  en_cours       : { label:'En préparation', color:'#F59E0B', bg:'rgba(245,158,11,.1)',   icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  en_preparation : { label:'En préparation', color:'#F59E0B', bg:'rgba(245,158,11,.1)',   icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  pret           : { label:'Prêt',           color:'#22C55E', bg:'rgba(34,197,94,.1)',    icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  en_livraison   : { label:'En livraison',   color:'#8B5CF6', bg:'rgba(139,92,246,.1)',   icon:'M12 2a7 7 0 107 7h-7V2z' },
  livre          : { label:'Livré',          color:'#6B7280', bg:'rgba(107,114,128,.1)',  icon:'M5 13l4 4L19 7' },
  annule         : { label:'Annulé',         color:'#EF4444', bg:'rgba(239,68,68,.08)',   icon:'M6 18L18 6M6 6l12 12' },
}
const TRANSITIONS = {
  nouveau        : ['en_cours','annule'],
  en_cours       : ['pret','annule'],
  en_preparation : ['pret','annule'],
  pret           : ['en_livraison','livre'],
  en_livraison   : ['livre'],
  livre          : [],
  annule         : [],
}
const PAIE_LABELS = {
  especes:'Espèces', livraison:'Espèces (livraison)',
  mtn:'MTN MoMo', mtn_paye:'MTN MoMo ✓',
  orange:'Orange Money', orange_paye:'Orange Money ✓',
  cinetpay:'MoMo ✓', cinetpay_confirme:'MoMo ✓', cinetpay_pending:'MoMo (en attente)',
  resto:'Sur place',
}

function StatusPill({ status, size = 'sm' }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.nouveau
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding: size === 'sm' ? '3px 10px' : '5px 14px',
      borderRadius:20, fontSize: size === 'sm' ? 10 : 11,
      fontWeight:700, letterSpacing:.5, textTransform:'uppercase',
      background:s.bg, color:s.color, border:`1px solid ${s.color}30`,
    }}>
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {s.icon?.split(' M').map((seg, i) => <path key={i} d={i===0?seg:`M${seg}`} />)}
      </svg>
      {s.label}
    </span>
  )
}

export default function CommandesPanel({ commandes, loading, onUpdateStatus, onRefresh }) {
  const [selected,   setSelected]   = useState(null)
  const [filtre,     setFiltre]     = useState('actives')
  const [search,     setSearch]     = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [bumpId,     setBumpId]     = useState(null)
  const [visibleIds, setVisibleIds] = useState(new Set())

  const filtered = commandes.filter(c => {
    if (filtre === 'actives'  && ['livre','annule'].includes(c.status)) return false
    if (filtre === 'livrees'  && c.status !== 'livre') return false
    if (filtre === 'annulees' && c.status !== 'annule') return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.id?.toLowerCase().includes(q) || c.client?.toLowerCase().includes(q) || c.tel?.includes(q)
    }
    return true
  }).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''))

  useEffect(() => {
    const ids = filtered.map(c => c.id)
    ids.forEach((id, i) => setTimeout(() => setVisibleIds(v => new Set([...v, id])), i * 40))
  }, [filtre, search]) // eslint-disable-line

  async function handleStatus(cmd, newStatus) {
    setUpdatingId(cmd.id)
    await onUpdateStatus(cmd.id, newStatus)
    setBumpId(cmd.id)
    setTimeout(() => setBumpId(null), 400)
    setUpdatingId(null)
    setSelected(prev => prev?.id === cmd.id ? { ...prev, status: newStatus } : prev)
  }

  const sel = selected ? (commandes.find(c => c.id === selected.id) || selected) : null
  const FILTRES = [
    { id:'actives',  label:'Actives',  count: commandes.filter(c => !['livre','annule'].includes(c.status)).length },
    { id:'livrees',  label:'Livrées',  count: commandes.filter(c => c.status==='livre').length },
    { id:'annulees', label:'Annulées', count: commandes.filter(c => c.status==='annule').length },
    { id:'toutes',   label:'Toutes',   count: commandes.length },
  ]

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>

      {/* ── Liste gauche ───────────────────────────────────────────────── */}
      <div style={{ flex:'1 1 0', minWidth:0 }}>

        {/* Filtres */}
        <div style={{ marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {FILTRES.map(f => (
              <button key={f.id}
                onClick={() => { setFiltre(f.id); setVisibleIds(new Set()) }}
                style={{
                  padding:'6px 14px', borderRadius:20, fontSize:11, cursor:'pointer',
                  border:`1px solid ${filtre===f.id ? 'var(--gold)' : 'var(--border-gold)'}`,
                  background: filtre===f.id ? 'rgba(201,151,60,.12)' : 'transparent',
                  color: filtre===f.id ? 'var(--gold)' : 'var(--cream-faint)',
                  fontWeight: filtre===f.id ? 700 : 400,
                  transition:'all .18s', fontFamily:'var(--font-dm)', letterSpacing:.5,
                }}
              >
                {f.label}
                <span style={{ marginLeft:6, fontSize:10, opacity:.6, fontWeight:400 }}>({f.count})</span>
              </button>
            ))}
          </div>
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setVisibleIds(new Set()) }}
            placeholder="Chercher par ID, client, téléphone…"
            className="admin-input"
          />
        </div>

        {/* Skeletons */}
        {loading && Array(4).fill(0).map((_, i) => (
          <div key={i} className="skeleton" style={{ height:82, borderRadius:12, marginBottom:8, animationDelay:`${i*.1}s` }} />
        ))}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'var(--border-subtle)', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--cream-faint)" strokeWidth={1.5} strokeLinecap="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div style={{ fontSize:13, color:'var(--cream-faint)' }}>Aucune commande</div>
          </div>
        )}

        {/* Cards */}
        {!loading && filtered.map(cmd => {
          const s   = STATUS_CONFIG[cmd.status] || STATUS_CONFIG.nouveau
          const vis = visibleIds.has(cmd.id)
          const isSelected = sel?.id === cmd.id
          return (
            <div key={cmd.id} onClick={() => setSelected(cmd)}
              style={{
                background: isSelected ? 'rgba(201,151,60,.07)' : 'var(--ebony-2)',
                border: `1px solid ${isSelected ? 'rgba(201,151,60,.45)' : 'var(--border-gold)'}`,
                borderLeft: `3px solid ${s.color}`,
                borderRadius:12, padding:'14px 16px', marginBottom:8,
                cursor:'pointer',
                opacity: vis ? 1 : 0,
                transform: vis ? 'none' : 'translateY(10px)',
                transition:`opacity .35s, transform .35s cubic-bezier(.22,1,.36,1), background .15s, border-color .15s`,
                animation: bumpId === cmd.id ? 'statusBump .4s ease' : 'none',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(201,151,60,.3)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-gold)' }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <span style={{ fontWeight:700, fontSize:12, color:'var(--gold)', letterSpacing:.5 }}>#{cmd.id}</span>
                <StatusPill status={cmd.status} />
              </div>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>{cmd.client || 'Anonyme'}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--cream-faint)' }}>
                  {cmd.mode || 'Livraison'} · {PAIE_LABELS[cmd.paiement] || cmd.paiement || '—'}
                </span>
                <span style={{ fontWeight:800, fontSize:13, color:'var(--cream)' }}>
                  {(cmd.total||0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Détail droit ────────────────────────────────────────────────── */}
      {sel && (() => {
        const s = STATUS_CONFIG[sel.status] || STATUS_CONFIG.nouveau
        const transitions = TRANSITIONS[sel.status] || []
        return (
          <div style={{
            flex:'0 0 300px', flexShrink:0,
            background:'var(--ebony-2)',
            border:'1px solid var(--border-gold)',
            borderRadius:16, padding:22,
            animation:'scaleIn .22s cubic-bezier(.22,1,.36,1)',
            position:'sticky', top:82,
          }}>
            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, paddingBottom:14, borderBottom:'1px solid var(--border-subtle)' }}>
              <span style={{ fontWeight:700, color:'var(--gold)', fontSize:13, letterSpacing:.5 }}>#{sel.id}</span>
              <StatusPill status={sel.status} size="md" />
            </div>

            {/* Infos */}
            <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:18, fontSize:12 }}>
              {[
                ['Client',   sel.client || '—'],
                ['Téléphone', sel.tel   || '—'],
                ['Mode',     sel.mode   || 'Livraison'],
                ['Paiement', PAIE_LABELS[sel.paiement] || sel.paiement || '—'],
                sel.addr ? ['Adresse', sel.addr] : null,
                ['Date', sel.createdAt ? new Date(sel.createdAt).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'],
              ].filter(Boolean).map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                  <span style={{ color:'var(--cream-faint)', flexShrink:0 }}>{k}</span>
                  <span style={{ textAlign:'right', color:'var(--cream)', fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Articles */}
            <div style={{ borderTop:'1px solid var(--border-subtle)', paddingTop:14, marginBottom:14 }}>
              {(Array.isArray(sel.items) ? sel.items : []).map((it,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                  <span style={{ color:'var(--cream-faint)' }}>{it.qty||1}× {it.name}</span>
                  <span style={{ color:'var(--cream)' }}>{((it.price||0)*(it.qty||1)).toLocaleString('fr-FR')} F</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:14, marginTop:10, paddingTop:8, borderTop:'1px solid var(--border-subtle)', color:'var(--gold)' }}>
                <span>Total</span>
                <span>{(sel.total||0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>

            {/* Transitions */}
            {transitions.length > 0 && (
              <div>
                <div style={{ fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'var(--cream-faint)', marginBottom:8, fontWeight:600 }}>
                  Mettre à jour
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {transitions.map(st => {
                    const sc = STATUS_CONFIG[st]
                    return (
                      <button key={st}
                        onClick={() => handleStatus(sel, st)}
                        disabled={updatingId === sel.id}
                        style={{
                          padding:'10px 14px', borderRadius:8,
                          border:`1px solid ${sc.color}35`,
                          background:`${sc.color}0d`,
                          color:sc.color, fontSize:12, fontWeight:700,
                          cursor: updatingId===sel.id ? 'wait' : 'pointer',
                          opacity: updatingId===sel.id ? .5 : 1,
                          transition:'all .2s',
                          display:'flex', alignItems:'center', gap:8,
                          fontFamily:'var(--font-dm)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${sc.color}18`; e.currentTarget.style.transform='translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.background=`${sc.color}0d`; e.currentTarget.style.transform='none' }}
                      >
                        {updatingId===sel.id
                          ? <><span className="spin" style={{width:12,height:12,border:'2px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',display:'inline-block'}}/>Mise à jour…</>
                          : <>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                                {sc.icon?.split(' M').map((seg, i) => <path key={i} d={i===0?seg:`M${seg}`} />)}
                              </svg>
                              {sc.label}
                            </>
                        }
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
