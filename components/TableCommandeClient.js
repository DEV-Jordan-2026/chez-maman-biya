'use client'
// components/TableCommandeClient.js
// Interface de commande publique via QR code — mobile-first, luxury CMB aesthetic

import { useState, useCallback, useMemo } from 'react'

const CAT_ORDER = ['Entrées','Soupes','Plats','Grillades','Accompagnements','Desserts','Boissons']
const CAT_EMOJI = { Entrées:'🥗', Soupes:'🍲', Plats:'🍽️', Grillades:'🔥', Accompagnements:'🌿', Desserts:'🍮', Boissons:'🥤' }

function groupByCategory(menu) {
  const map = {}
  for (const item of menu) {
    if (!map[item.cat]) map[item.cat] = []
    map[item.cat].push(item)
  }
  return Object.entries(map).sort(([a],[b]) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b)
    return (ia===-1?99:ia) - (ib===-1?99:ib)
  })
}

const btnGold = {
  border:'none', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontWeight:800,
  background:'linear-gradient(135deg,#C9973C,#A87328)', color:'#fff',
  boxShadow:'0 4px 20px rgba(201,151,60,.3)', WebkitTapHighlightColor:'transparent',
  transition:'all .15s',
}
const btnOutline = {
  border:'1px solid rgba(201,151,60,.3)', borderRadius:14, cursor:'pointer',
  fontFamily:'inherit', fontWeight:700, background:'rgba(201,151,60,.08)',
  color:'#C9973C', WebkitTapHighlightColor:'transparent',
}
const btnGhost = {
  border:'1px solid rgba(240,232,216,.12)', borderRadius:14, cursor:'pointer',
  fontFamily:'inherit', fontWeight:600, background:'rgba(240,232,216,.05)',
  color:'rgba(240,232,216,.65)', WebkitTapHighlightColor:'transparent',
}
const page = {
  minHeight:'100dvh', background:'#080605', color:'#F0E8D8',
  fontFamily:"'DM Sans',system-ui,sans-serif", WebkitFontSmoothing:'antialiased',
}

// ── Gestion d'erreur image (évite les broken img si URL invalide) ─────────────
function ImgAvecFallback({ src, alt, style, emoji }) {
  const [erreur, setErreur] = useState(false)
  if (!src || erreur) {
    return <div style={{ ...style, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(201,151,60,.06)', fontSize: style?.height ? Math.floor(style.height * 0.45) : 28 }}>{emoji || '🍽️'}</div>
  }
  return <img src={src} alt={alt} style={style} onError={() => setErreur(true)} />
}

function ArticleCard({ item, qty, onAdd, onRemove }) {
  const hasPhoto = Boolean(item.image)
  return (
    <div style={{ borderBottom:'1px solid rgba(240,232,216,.06)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', gap:12 }}>
        {/* Miniature photo si disponible */}
        {hasPhoto && (
          <div style={{ flexShrink:0, width:64, height:64, borderRadius:10, overflow:'hidden' }}>
            <ImgAvecFallback
              src={item.image}
              alt={item.name}
              emoji={item.emoji}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
          </div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          {item.popular && (
            <span style={{ fontSize:9, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase', color:'#C9973C', background:'rgba(201,151,60,.12)', border:'1px solid rgba(201,151,60,.25)', borderRadius:4, padding:'2px 6px', display:'inline-block', marginBottom:4 }}>
              Populaire
            </span>
          )}
          <div style={{ fontSize:14, fontWeight:600, color:'#F0E8D8', marginBottom:3 }}>
            {!hasPhoto && <span style={{ marginRight:4 }}>{item.emoji}</span>}{item.name}
          </div>
          {item.desc && <div style={{ fontSize:12, color:'rgba(240,232,216,.45)', lineHeight:1.5, marginBottom:4 }}>{item.desc}</div>}
          <div style={{ fontSize:14, fontWeight:800, color:'#C9973C' }}>{item.price.toLocaleString('fr-FR')} FCFA</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          {qty > 0 && (
            <>
              <button onClick={()=>onRemove(item)} style={{ width:34, height:34, borderRadius:'50%', border:'1px solid rgba(201,151,60,.3)', background:'rgba(201,151,60,.08)', color:'#C9973C', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>−</button>
              <span style={{ width:28, textAlign:'center', fontSize:15, fontWeight:800 }}>{qty}</span>
            </>
          )}
          <button onClick={()=>onAdd(item)} style={{ width:34, height:34, borderRadius:'50%', border:qty>0?'1px solid rgba(201,151,60,.3)':'none', background:qty>0?'rgba(201,151,60,.08)':'linear-gradient(135deg,#C9973C,#A87328)', color:qty>0?'#C9973C':'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, boxShadow:qty>0?'none':'0 2px 12px rgba(201,151,60,.35)' }}>+</button>
        </div>
      </div>
    </div>
  )
}

export default function TableCommandeClient({ tableId, initial }) {
  const { table, restaurant, menu=[], commandeOuverte } = initial
  const [panier,   setPanier]   = useState({})
  const [etape,    setEtape]    = useState('menu')
  const [note,     setNote]     = useState('')
  const [catActif, setCatActif] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [erreur,   setErreur]   = useState(null)
  const [cmdId,    setCmdId]    = useState(commandeOuverte?.id||null)

  const categories = useMemo(()=>groupByCategory(menu),[menu])
  const firstCat   = categories[0]?.[0]
  const catSel     = catActif || firstCat

  const ajouter  = useCallback((item)=>setPanier(p=>({...p,[item.id]:(p[item.id]||0)+1})),[])
  const retirer  = useCallback((item)=>setPanier(p=>{
    const n=(p[item.id]||1)-1; if(n<=0){const{[item.id]:_,...r}=p;return r} return{...p,[item.id]:n}
  }),[])

  const lignes     = useMemo(()=>menu.filter(it=>panier[it.id]).map(it=>({...it,qty:panier[it.id]})),[menu,panier])
  const total      = lignes.reduce((s,it)=>s+it.price*it.qty,0)
  const nbArticles = Object.values(panier).reduce((s,q)=>s+q,0)

  async function soumettre() {
    if(!lignes.length) return
    setLoading(true); setErreur(null)
    try {
      const res = await fetch(`/api/table/${tableId}/commander`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ items:lignes.map(it=>({id:it.id,name:it.name,price:it.price,qty:it.qty,emoji:it.emoji})), note:note.trim()||null }),
      })
      const data = await res.json()
      if(!res.ok){setErreur(data.error||'Erreur');return}
      setCmdId(data.commandeId); setPanier({}); setNote(''); setEtape('succes')
    } catch { setErreur('Erreur réseau. Veuillez réessayer.') }
    finally { setLoading(false) }
  }

  const Header = ()=>(
    <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(8,6,5,.95)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(201,151,60,.12)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <div>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'rgba(201,151,60,.7)', marginBottom:2 }}>{restaurant?.nom||'Chez Maman Biya'}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>🪑</span>
          <span style={{ fontSize:18, fontWeight:900, letterSpacing:-.3 }}>Table {table?.numero}</span>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', background:'rgba(201,151,60,.1)', color:'#C9973C', border:'1px solid rgba(201,151,60,.25)', borderRadius:4, padding:'2px 7px' }}>{table?.zone}</span>
        </div>
      </div>
      {etape==='menu' && nbArticles>0 && (
        <button onClick={()=>setEtape('panier')} style={{ ...btnGold, padding:'10px 16px', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
          <span>🛒</span><span>{nbArticles} art.</span><span style={{opacity:.6}}>·</span><span>{total.toLocaleString('fr-FR')} F</span>
        </button>
      )}
    </div>
  )

  // ── Menu ────────────────────────────────────────────────────────────────────
  if(etape==='menu') return (
    <div style={page}>
      <style>{`*{touch-action:manipulation;-webkit-tap-highlight-color:transparent} .hscroll::-webkit-scrollbar{display:none}`}</style>
      <Header/>
      <div className="hscroll" style={{ display:'flex', gap:8, padding:'12px 20px', overflowX:'auto', background:'#0e0c09', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
        {categories.map(([cat])=>(
          <button key={cat} onClick={()=>setCatActif(cat)} style={{ flexShrink:0, padding:'7px 14px', borderRadius:20, border:'none', background:catSel===cat?'rgba(201,151,60,.15)':'rgba(255,255,255,.04)', color:catSel===cat?'#C9973C':'rgba(240,232,216,.4)', fontSize:12, fontWeight:catSel===cat?700:400, cursor:'pointer', outline:catSel===cat?'1px solid rgba(201,151,60,.3)':'none', fontFamily:'inherit' }}>
            {CAT_EMOJI[cat]||'🍽️'} {cat}
          </button>
        ))}
      </div>
      {commandeOuverte && (
        <div style={{ margin:'16px 20px 0', padding:'12px 16px', background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.25)', borderRadius:12, fontSize:13, color:'#22C55E' }}>
          ✅ Commande #{commandeOuverte.id} en cours — vous pouvez ajouter des articles.
        </div>
      )}
      <div style={{ padding:'0 20px 120px' }}>
        {categories.filter(([c])=>catSel?c===catSel:true).map(([cat,items])=>(
          <div key={cat}>
            <div style={{ padding:'20px 0 8px', fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'rgba(201,151,60,.6)', fontWeight:700 }}>{CAT_EMOJI[cat]||'🍽️'} {cat}</div>
            {items.map(item=><ArticleCard key={item.id} item={item} qty={panier[item.id]||0} onAdd={ajouter} onRemove={retirer}/>)}
          </div>
        ))}
      </div>
      {nbArticles>0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px 20px', background:'linear-gradient(to top,#080605 70%,transparent)', zIndex:40 }}>
          <button onClick={()=>setEtape('panier')} style={{ ...btnGold, width:'100%', padding:'16px', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <span>🛒</span><span>Voir mon panier</span>
            <span style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'2px 10px', fontSize:13 }}>{total.toLocaleString('fr-FR')} FCFA</span>
          </button>
        </div>
      )}
    </div>
  )

  // ── Panier ──────────────────────────────────────────────────────────────────
  if(etape==='panier') return (
    <div style={page}>
      <Header/>
      <div style={{ padding:'20px 20px 60px' }}>
        <button onClick={()=>setEtape('menu')} style={{ ...btnGhost, padding:'8px 14px', fontSize:13, marginBottom:20 }}>← Retour</button>
        <div style={{ fontSize:18, fontWeight:900, marginBottom:20 }}>Mon panier</div>
        {lignes.map(it=>(
          <div key={it.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid rgba(240,232,216,.06)' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>{it.emoji} {it.name}</div>
              <div style={{ fontSize:12, color:'rgba(240,232,216,.45)', marginTop:2 }}>{it.price.toLocaleString('fr-FR')} × {it.qty}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14, fontWeight:800, color:'#C9973C' }}>{(it.price*it.qty).toLocaleString('fr-FR')} F</span>
              <button onClick={()=>retirer(it)} style={{ width:28,height:28,borderRadius:'50%',border:'1px solid rgba(201,151,60,.3)',background:'rgba(201,151,60,.08)',color:'#C9973C',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
              <span style={{ width:24,textAlign:'center',fontWeight:800 }}>{it.qty}</span>
              <button onClick={()=>ajouter(it)} style={{ width:28,height:28,borderRadius:'50%',border:'1px solid rgba(201,151,60,.3)',background:'rgba(201,151,60,.08)',color:'#C9973C',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
            </div>
          </div>
        ))}
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Instructions spéciales (allergies, sans piment…)" rows={3}
          style={{ width:'100%', marginTop:20, background:'rgba(255,255,255,.04)', border:'1px solid rgba(201,151,60,.2)', color:'#F0E8D8', borderRadius:12, padding:'12px 14px', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none', boxSizing:'border-box' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 0', borderTop:'1px solid rgba(201,151,60,.15)', marginTop:8 }}>
          <span style={{ fontSize:14, color:'rgba(240,232,216,.6)' }}>Total</span>
          <span style={{ fontSize:22, fontWeight:900, color:'#C9973C' }}>{total.toLocaleString('fr-FR')} FCFA</span>
        </div>
        <div style={{ fontSize:12, color:'rgba(240,232,216,.35)', marginBottom:20, lineHeight:1.6 }}>ℹ️ Paiement en fin de repas auprès du serveur (espèces ou Mobile Money).</div>
        {erreur && <div style={{ padding:'10px 14px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, fontSize:13, color:'#EF4444', marginBottom:16 }}>⚠️ {erreur}</div>}
        <button onClick={soumettre} disabled={loading||!lignes.length} style={{ ...btnGold, width:'100%', padding:'16px', fontSize:15, opacity:loading?.6:1 }}>
          {loading ? '⏳ Envoi en cuisine…' : '🍽️ Envoyer la commande'}
        </button>
      </div>
    </div>
  )

  // ── Succès ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...page, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', textAlign:'center', gap:24 }}>
      <style>{`@keyframes popIn{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      <div style={{ fontSize:72, animation:'popIn .5s cubic-bezier(.34,1.56,.64,1)' }}>✅</div>
      <div>
        <div style={{ fontSize:22, fontWeight:900, marginBottom:8 }}>Commande envoyée !</div>
        <div style={{ fontSize:14, color:'rgba(240,232,216,.55)', lineHeight:1.7, maxWidth:300 }}>Votre commande a été transmise en cuisine. Notre équipe vous servira sous peu.</div>
      </div>
      {cmdId && (
        <div style={{ background:'rgba(201,151,60,.08)', border:'1px solid rgba(201,151,60,.25)', borderRadius:12, padding:'12px 24px' }}>
          <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(201,151,60,.6)', marginBottom:4 }}>Référence</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#C9973C', letterSpacing:1 }}>{cmdId}</div>
        </div>
      )}
      <div style={{ fontSize:13, color:'rgba(240,232,216,.4)', lineHeight:1.7 }}>💳 Paiement en fin de repas auprès de votre serveur.</div>
      <button onClick={()=>setEtape('menu')} style={{ ...btnOutline, padding:'12px 28px', fontSize:14 }}>＋ Ajouter d'autres articles</button>
    </div>
  )
}
