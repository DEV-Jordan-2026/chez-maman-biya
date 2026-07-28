'use client'
// AnalyticsPanel.js — v12 LUXURY

import { useState, useEffect, useCallback } from 'react'

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:'var(--gold)', marginBottom:16, letterSpacing:.5, display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:14, height:2, background:'var(--gold)', borderRadius:1 }} />
      {children}
    </div>
  )
}

function KPICard({ label, value, sub, color, icon }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), 80); return () => clearTimeout(t) }, [])
  return (
    <div className="admin-card" style={{
      padding:'20px',
      opacity: vis ? 1 : 0,
      transform: vis ? 'none' : 'translateY(14px)',
      transition:'opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1), border-color .2s',
    }}>
      <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, border:`1px solid ${color}28`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          {icon?.split(' M').map((seg, i) => <path key={i} d={i===0?seg:`M${seg}`} />)}
        </svg>
      </div>
      <div key={String(value)} style={{ fontSize:26, fontWeight:800, color, lineHeight:1, letterSpacing:-.5, animation:vis?'countUp .5s cubic-bezier(.22,1,.36,1)':'none' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:10, color, opacity:.7, marginTop:3, fontWeight:600 }}>{sub}</div>}
      <div style={{ fontSize:11, color:'var(--cream-faint)', marginTop:5 }}>{label}</div>
    </div>
  )
}

function BarChart({ data, labelKey, valueKey, color, title, formatValue = v => v }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 200); return () => clearTimeout(t) }, [data])
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d[valueKey]||0), 1)
  return (
    <div className="admin-card" style={{ padding:'20px', marginBottom:16 }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:90, fontSize:11, color:'var(--cream-faint)', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>
              {d[labelKey]}
            </div>
            <div style={{ flex:1, background:'rgba(240,232,216,.05)', borderRadius:4, height:16, overflow:'hidden' }}>
              <div style={{
                width: animated ? `${Math.round((d[valueKey]/max)*100)}%` : '0%',
                background:`linear-gradient(90deg, ${color}, ${color}aa)`,
                height:'100%', borderRadius:4, minWidth:4,
                transition:`width .8s ${i*.05}s cubic-bezier(.22,1,.36,1)`,
              }} />
            </div>
            <div style={{ width:72, fontSize:11, color:'var(--cream)', textAlign:'right', flexShrink:0, fontWeight:600 }}>
              {formatValue(d[valueKey])}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ data, title }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t) }, [data])
  if (!data || data.length < 2) return null
  const vals = data.map(d => d.ca)
  const max  = Math.max(...vals, 1)
  const min  = Math.min(...vals, 0)
  const W = 540, H = 120, padX = 12, padY = 16

  const pts = data.map((d, i) => {
    const x = padX + (i / (data.length-1)) * (W - padX*2)
    const y = H - padY - ((d.ca-min)/(max-min||1)) * (H - padY*2)
    return [x, y]
  })

  const linePath = pts.map((p,i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length-1][0]},${H} L${padX},${H} Z`

  return (
    <div className="admin-card" style={{ padding:'20px', marginBottom:16 }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ overflowX:'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', minWidth:300, height:120 }}>
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity=".25" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {/* Area */}
          <path d={areaPath} fill="url(#lineGrad)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Points */}
          {pts.map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="var(--gold)" />
          ))}
        </svg>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--cream-faint)', marginTop:4 }}>
        <span>{data[0]?.date}</span>
        <span>{data[data.length-1]?.date}</span>
      </div>
    </div>
  )
}

export default function AnalyticsPanel() {
  const [data,    setData]    = useState(null)
  const [periode, setPeriode] = useState('30')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?periode=${periode}`)
      const d   = await res.json()
      setData(d)
    } catch (e) { console.error('[AnalyticsPanel]', e) }
    setLoading(false)
  }, [periode])

  useEffect(() => { fetchData() }, [fetchData])

  const fcfaFull = v => `${v?.toLocaleString('fr-FR')} FCFA`
  const fcfaK    = v => `${Math.round(v/1000)}k`

  if (loading) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:20 }}>
      {Array(4).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
    </div>
  )

  if (!data) return (
    <div style={{ textAlign:'center', padding:'60px 0', color:'var(--cream-faint)', fontSize:13 }}>
      Aucune donnée disponible
    </div>
  )

  const heuresSorted = [...(data.heuresPointe||[])]
    .filter(h => h.nb > 0).sort((a,b) => b.nb - a.nb).slice(0,8)
    .map(h => ({ ...h, label:`${String(h.heure).padStart(2,'0')}h` }))

  return (
    <div>
      {/* Période */}
      <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
        {[['7','7 jours'],['30','30 jours'],['90','3 mois'],['365','1 an']].map(([v,l]) => (
          <button key={v} onClick={() => setPeriode(v)} style={{
            padding:'6px 16px', borderRadius:20, fontSize:11, cursor:'pointer',
            border:`1px solid ${periode===v ? 'var(--gold)' : 'var(--border-gold)'}`,
            background: periode===v ? 'rgba(201,151,60,.12)' : 'transparent',
            color: periode===v ? 'var(--gold)' : 'var(--cream-faint)',
            fontWeight: periode===v ? 700 : 400,
            transition:'all .18s', fontFamily:'var(--font-dm)', letterSpacing:.5,
          }}>{l}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:20 }}>
        <KPICard icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" label="Chiffre d'affaires" value={fcfaFull(data.kpis?.caTotal)} color="var(--success)" />
        <KPICard icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" label="Commandes encaissées" value={data.kpis?.nbCmd} color="var(--gold)" />
        <KPICard icon="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" label="Panier moyen" value={fcfaFull(data.kpis?.panier)} color="var(--warning)" />
        <KPICard icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" label="Clients uniques" value={data.kpis?.clientsUniq} color="#8B5CF6" />
      </div>

      {/* Courbe CA */}
      <LineChart data={data.ventesJour||[]} title="Évolution du chiffre d'affaires" />

      {/* Grille 2 colonnes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:0 }}>
        <BarChart data={(data.topPlats||[]).slice(0,8)} labelKey="nom" valueKey="qte" color="var(--gold)" title="Top plats — quantités vendues" formatValue={v=>`${v} ventes`} />
        <BarChart data={heuresSorted} labelKey="label" valueKey="nb" color="var(--warning)" title="Heures de pointe" formatValue={v=>`${v} cmd`} />
        <BarChart data={data.paiements||[]} labelKey="label" valueKey="montant" color="var(--success)" title="Recettes par mode de paiement" formatValue={fcfaK} />
        <BarChart data={data.modes||[]} labelKey="label" valueKey="nb" color="#8B5CF6" title="Modes de commande" formatValue={v=>`${v} cmd`} />
      </div>

      {/* Top plats par CA */}
      {(data.topPlats||[]).length > 0 && (
        <div className="admin-card" style={{ padding:'20px', marginTop:16 }}>
          <SectionTitle>Top plats — chiffre d'affaires</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10 }}>
            {[...(data.topPlats||[])].sort((a,b)=>b.ca-a.ca).slice(0,8).map((p,i) => (
              <div key={i} style={{ background:'rgba(240,232,216,.03)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'12px 14px', transition:'border-color .2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-gold)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-subtle)'}
              >
                <div style={{ fontSize:12, fontWeight:600, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--cream)' }}>{p.nom}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--success)' }}>{p.ca?.toLocaleString('fr-FR')} F</div>
                <div style={{ fontSize:10, color:'var(--cream-faint)', marginTop:3 }}>{p.qte} vendus</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
