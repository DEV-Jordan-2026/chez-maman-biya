'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LivreurLogin() {
  const router = useRouter()
  const [tel, setTel] = useState('')
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)

  async function connecter(e) {
    e.preventDefault()
    setErreur(''); setLoading(true)
    try {
      const res = await fetch('/api/livreur/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tel, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setErreur(data.error || 'Connexion impossible'); setLoading(false); return }
      router.push('/livraison')
    } catch {
      setErreur('Connexion impossible. Vérifiez votre réseau.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--ebony)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'inherit' }}>
      <form onSubmit={connecter} style={{ width:'100%', maxWidth:340, background:'var(--ebony-2)', border:'1px solid rgba(201,151,60,.2)', borderRadius:16, padding:28 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:34, marginBottom:8 }}>🛵</div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--gold)' }}>Espace Livreur</div>
          <div style={{ fontSize:12, color:'var(--cream-dim)', marginTop:4 }}>Chez Maman Biya</div>
        </div>

        <label style={lbl}>NUMÉRO DE TÉLÉPHONE</label>
        <input value={tel} onChange={e=>setTel(e.target.value)} placeholder="+237 6XX XXX XXX"
          inputMode="tel" autoComplete="tel" style={inp} />

        <label style={{ ...lbl, marginTop:14 }}>CODE (4 chiffres)</label>
        <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••"
          inputMode="numeric" type="password" maxLength={4} style={{ ...inp, letterSpacing:8, textAlign:'center', fontSize:20 }} />

        {erreur && <div style={{ marginTop:12, fontSize:12, color:'#f87171', textAlign:'center' }}>{erreur}</div>}

        <button type="submit" disabled={loading || !tel || pin.length !== 4} style={{
          marginTop:20, width:'100%', padding:13, borderRadius:10, border:'none',
          background: loading ? '#6b7280' : 'linear-gradient(135deg,var(--gold),#a85f28)',
          color:'#fff', fontSize:14, fontWeight:800, cursor: loading ? 'default' : 'pointer',
        }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div style={{ marginTop:16, fontSize:11, color:'var(--cream-dim)', textAlign:'center' }}>
          Votre code vous a été remis par votre manager.
        </div>
      </form>
    </div>
  )
}

const lbl = { fontSize:10, color:'var(--cream-faint)', letterSpacing:1, display:'block', marginBottom:6 }
const inp = { width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,.05)', border:'1px solid rgba(201,151,60,.2)', borderRadius:10, color:'var(--cream)', padding:'12px 14px', fontSize:15, fontFamily:'inherit' }
