'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const METHODES = [
  { id: 'especes',      label: '💵 Espèces' },
  { id: 'mtn_momo',     label: '📱 MTN MoMo' },
  { id: 'orange_money', label: '🟠 Orange Money' },
  { id: 'deja_paye',    label: '✅ Déjà payée' },
]

export default function LivraisonApp() {
  const router = useRouter()
  const [livreur, setLiv]     = useState(null)
  const [commandes, setCmds]  = useState([])
  const [stats, setStats]     = useState({ nbLivraisons: 0, especes: 0 })
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur]   = useState('')
  const [confirm, setConfirm] = useState(null) // { commande, methode }
  const [envoi, setEnvoi]     = useState(false)
  const [fb, setFb]           = useState('')

  const flash = msg => { setFb(msg); setTimeout(() => setFb(''), 3000) }

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/livreur/me')
      if (res.status === 401) { router.push('/livraison/login'); return }
      if (!res.ok) throw new Error(await res.text())
      const d = await res.json()
      setLiv(d.livreur); setCmds(d.commandes); setStats(d.stats || { nbLivraisons: 0, especes: 0 })
      setErreur('')
    } catch (e) {
      setErreur('Impossible de charger vos livraisons. Vérifiez votre connexion.')
      console.error('[LivraisonApp]', e)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { charger(); const iv = setInterval(charger, 20_000); return () => clearInterval(iv) }, [charger])

  async function deconnecter() {
    await fetch('/api/livreur/logout', { method: 'POST' })
    router.push('/livraison/login')
  }

  async function confirmerLivraison() {
    if (!confirm) return
    setEnvoi(true)
    try {
      const res = await fetch(`/api/livreur/commandes/${confirm.commande.id}/livrer`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encaisseMethode: confirm.methode }),
      })
      if (!res.ok) throw new Error(await res.text())
      flash(`✅ ${confirm.commande.id} livrée`)
      setConfirm(null)
      charger()
    } catch (e) {
      flash('❌ Impossible de confirmer la livraison.')
      console.error('[LivraisonApp confirmer]', e)
    } finally {
      setEnvoi(false)
    }
  }

  if (loading) return <Shell><div style={{ textAlign:'center', padding:'60px 0', opacity:.4 }}>Chargement…</div></Shell>
  if (erreur)  return <Shell><div style={{ textAlign:'center', padding:'40px 0', color:'#f87171' }}>{erreur}</div></Shell>

  return (
    <Shell>
      {/* En-tête */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--gold)' }}>🛵 {livreur?.nom}</div>
          <div style={{ fontSize:12, color:'var(--cream-dim)', marginTop:2 }}>
            {commandes.length === 0 ? 'Aucune livraison en cours' : `${commandes.length} livraison${commandes.length>1?'s':''} en cours`}
          </div>
        </div>
        <button onClick={deconnecter} style={{ background:'none', border:'1px solid rgba(239,68,68,.3)', color:'#f87171', borderRadius:8, padding:'6px 12px', fontSize:11, cursor:'pointer' }}>
          Déconnexion
        </button>
      </div>

      {fb && <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.3)', borderRadius:8, padding:'8px 16px', marginBottom:16, fontSize:12, color:'var(--success)', textAlign:'center' }}>{fb}</div>}

      {/* Récap du jour */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <div style={{ flex:1, background:'var(--ebony-2)', border:'1px solid rgba(201,151,60,.15)', borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--gold)' }}>{stats.nbLivraisons}</div>
          <div style={{ fontSize:10, opacity:.55, marginTop:2, letterSpacing:.4, textTransform:'uppercase' }}>Livrées aujourd'hui</div>
        </div>
        <div style={{ flex:1, background:'var(--ebony-2)', border:'1px solid rgba(16,185,129,.15)', borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--success)' }}>{stats.especes.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize:10, opacity:.55, marginTop:2, letterSpacing:.4, textTransform:'uppercase' }}>Espèces collectées (XAF)</div>
        </div>
      </div>

      {/* Aucune commande */}
      {commandes.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', opacity:.4 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>☕</div>
          <div style={{ fontSize:13 }}>Pas de livraison pour le moment.<br/>Vous serez notifié sur WhatsApp dès qu'une commande vous sera assignée.</div>
        </div>
      )}

      {/* Liste des livraisons */}
      {commandes.map(c => {
        const aEncaisser = (c.acompte > 0 && c.acompteStatut === 'paye') ? c.resteARegler : (c.paiement === 'livraison' ? c.total : 0)
        return (
          <div key={c.id} style={{ background:'var(--ebony-2)', border:'1px solid rgba(201,151,60,.2)', borderRadius:14, padding:16, marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ fontWeight:800, fontSize:14 }}>{c.id}</div>
              {aEncaisser > 0 ? (
                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'rgba(245,158,11,.12)', color:'#f59e0b', fontWeight:700 }}>
                  💵 {aEncaisser.toLocaleString('fr-FR')} XAF
                </span>
              ) : (
                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'rgba(16,185,129,.12)', color:'#10b981', fontWeight:700 }}>
                  ✅ Payée
                </span>
              )}
            </div>

            <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{c.client}</div>
            <div style={{ fontSize:12, opacity:.6, marginBottom:10 }}>{c.addr || 'Adresse non précisée'}</div>

            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <a href={`tel:${c.tel}`} style={btnLink('var(--gold)')}>📞 Appeler</a>
              <a href={waLink(c.tel)} target="_blank" rel="noreferrer" style={btnLink('#10b981')}>💬 WhatsApp</a>
              {c.addr && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.addr)}`} target="_blank" rel="noreferrer" style={btnLink('var(--gold)')}>
                  🗺️ Itinéraire
                </a>
              )}
            </div>

            <button onClick={() => setConfirm({ commande: c, methode: aEncaisser > 0 ? null : 'deja_paye' })} style={{
              width:'100%', padding:12, borderRadius:10, border:'none',
              background:'linear-gradient(135deg,var(--success),#0d9668)', color:'#fff',
              fontSize:14, fontWeight:800, cursor:'pointer',
            }}>
              ✅ Marquer comme livrée
            </button>
          </div>
        )
      })}

      {/* Modal de confirmation paiement */}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:50 }}>
          <div style={{ width:'100%', maxWidth:420, background:'var(--ebony-2)', borderTop:'1px solid rgba(201,151,60,.3)', borderRadius:'16px 16px 0 0', padding:20 }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>Confirmer la livraison {confirm.commande.id}</div>
            <div style={{ fontSize:12, opacity:.6, marginBottom:14 }}>Comment le client a-t-il payé ?</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
              {METHODES.map(m => (
                <button key={m.id} onClick={() => setConfirm(c => ({ ...c, methode: m.id }))} style={{
                  padding:'12px 8px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
                  border: confirm.methode === m.id ? '2px solid var(--gold)' : '1px solid rgba(201,151,60,.2)',
                  background: confirm.methode === m.id ? 'rgba(201,151,60,.12)' : 'transparent',
                  color: confirm.methode === m.id ? 'var(--gold)' : 'var(--cream)',
                }}>
                  {m.label}
                </button>
              ))}
            </div>

            <button onClick={confirmerLivraison} disabled={!confirm.methode || envoi} style={{
              width:'100%', padding:13, borderRadius:10, border:'none',
              background: (!confirm.methode || envoi) ? '#6b7280' : 'linear-gradient(135deg,var(--success),#0d9668)',
              color:'#fff', fontSize:14, fontWeight:800, cursor: (!confirm.methode || envoi) ? 'default' : 'pointer', marginBottom:8,
            }}>
              {envoi ? 'Envoi…' : 'Confirmer'}
            </button>
            <button onClick={() => setConfirm(null)} style={{ width:'100%', padding:10, borderRadius:10, border:'none', background:'none', color:'var(--cream-dim)', fontSize:12, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'var(--ebony)', color:'var(--cream)', padding:'20px 16px 40px', fontFamily:'inherit', maxWidth:480, margin:'0 auto' }}>
      {children}
    </div>
  )
}

const btnLink = c => ({
  flex:1, textAlign:'center', padding:'10px 8px', borderRadius:10, fontSize:12, fontWeight:700,
  border:`1px solid ${c}40`, background:`${c}10`, color:c, textDecoration:'none',
})

// v29 — Construit un lien wa.me à partir d'un numéro local camerounais (ex: "6XX XXX XXX" → 2376XXXXXXXX)
function waLink(tel) {
  const digits = (tel || '').replace(/\D/g, '')
  const intl = digits.startsWith('237') ? digits : `237${digits.replace(/^0/, '')}`
  return `https://wa.me/${intl}`
}
