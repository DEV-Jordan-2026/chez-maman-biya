'use client'

import { useState, useEffect, useCallback } from 'react'

const CATS_FOURN = ['Légumes', 'Protéines', 'Boissons', 'Huiles', 'Épices', 'Féculents', 'Emballage', 'Autre']
const STATUS_BON = {
  brouillon: { label: 'Brouillon', color: '#6b7280' },
  envoye:    { label: 'Envoyé',   color: 'var(--warning)' },
  recu:      { label: 'Reçu ✓',   color: 'var(--success)' },
  annule:    { label: 'Annulé',   color: 'var(--danger)' },
}

// ── Modale nouveau bon de commande ────────────────────────────────────────────
function ModaleBon({ fournisseurs, onClose, onCreated }) {
  const [fourn, setFourn]      = useState(fournisseurs[0]?.id || '')
  const [lignes, setLignes]    = useState([{ nom: '', qte: '', unite: 'kg', prixUnit: '' }])
  const [dateLiv, setDateLiv]  = useState('')
  const [note, setNote]        = useState('')
  const [busy, setBusy]        = useState(false)
  const [err, setErr]          = useState('')

  const total = lignes.reduce((s, l) => s + (parseFloat(l.prixUnit) || 0) * (parseFloat(l.qte) || 0), 0)

  function setLigne(i, k, v) {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }
  function addLigne() { setLignes(p => [...p, { nom: '', qte: '', unite: 'kg', prixUnit: '' }]) }
  function delLigne(i) { setLignes(p => p.filter((_, idx) => idx !== i)) }

  async function soumettre() {
    if (!fourn) { setErr('Choisissez un fournisseur'); return }
    const valid = lignes.filter(l => l.nom && l.qte)
    if (valid.length === 0) { setErr('Ajoutez au moins un article'); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/bons-commande', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fournisseurId: fourn, items: valid, dateLivraison: dateLiv || null, note: note || null }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error || 'Erreur'); setBusy(false); return }
      onCreated(d)
    } catch { setErr('Erreur réseau. Veuillez réessayer.') }
    setBusy(false)
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#141008',border:'1px solid rgba(201,151,60,.3)',borderRadius:16,width:'100%',maxWidth:580,maxHeight:'90vh',overflow:'auto',padding:24 }}>
        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:18 }}>
          <div style={{ fontWeight:800,fontSize:16,color:'var(--gold)' }}>📋 Nouveau bon de commande</div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'var(--cream-faint)',fontSize:22,cursor:'pointer' }}>×</button>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>FOURNISSEUR</label>
          <select value={fourn} onChange={e=>setFourn(e.target.value)} style={sel}>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom} — {f.categorie}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>DATE DE LIVRAISON SOUHAITÉE</label>
          <input type="date" value={dateLiv} onChange={e=>setDateLiv(e.target.value)} style={{ ...inp }} />
        </div>

        <div style={{ marginBottom:4 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <label style={lbl}>ARTICLES À COMMANDER</label>
            <button onClick={addLigne} style={{ fontSize:11,color:'var(--gold)',background:'none',border:'none',cursor:'pointer' }}>+ Ajouter une ligne</button>
          </div>
          {lignes.map((l, i) => (
            <div key={i} style={{ display:'grid',gridTemplateColumns:'3fr 1fr 60px 2fr 28px',gap:6,marginBottom:8,alignItems:'center' }}>
              <input placeholder="Article" value={l.nom} onChange={e=>setLigne(i,'nom',e.target.value)} style={{ ...inp,padding:'6px 10px' }} />
              <input type="number" placeholder="Qté" value={l.qte} onChange={e=>setLigne(i,'qte',e.target.value)} style={{ ...inp,padding:'6px 8px' }} />
              <select value={l.unite} onChange={e=>setLigne(i,'unite',e.target.value)} style={{ ...sel,padding:'6px 4px',fontSize:11 }}>
                {['kg','g','L','pcs','régimes','bottes','sacs'].map(u => <option key={u}>{u}</option>)}
              </select>
              <input type="number" placeholder="Prix unit." value={l.prixUnit} onChange={e=>setLigne(i,'prixUnit',e.target.value)} style={{ ...inp,padding:'6px 10px' }} />
              <button onClick={() => delLigne(i)} style={{ background:'none',border:'none',color:'rgba(239,68,68,.6)',fontSize:18,cursor:'pointer' }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>NOTE</label>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Instructions particulières…" style={{ ...inp }} />
        </div>

        {total > 0 && <div style={{ marginBottom:14,padding:'10px 14px',background:'rgba(201,151,60,.06)',borderRadius:8,fontSize:13,fontWeight:700,color:'var(--gold)' }}>
          Total estimé : {total.toLocaleString('fr-FR')} FCFA
        </div>}

        {err && <div style={{ color:'var(--danger)',fontSize:12,marginBottom:10 }}>⚠️ {err}</div>}

        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onClose} style={{ flex:1,background:'transparent',border:'1px solid rgba(201,151,60,.2)',color:'var(--cream-faint)',padding:10,borderRadius:8,cursor:'pointer',fontSize:13 }}>Annuler</button>
          <button onClick={soumettre} disabled={busy} style={{ flex:2,background:'linear-gradient(135deg,var(--gold),#a85f28)',border:'none',color:'#fff',padding:10,borderRadius:8,fontSize:13,fontWeight:700,cursor:busy?'default':'pointer' }}>
            {busy ? '⏳…' : '✅ Créer le bon de commande'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel principal ────────────────────────────────────────────────────────────
export default function FournisseursPanel() {
  const [fournisseurs, setFourn] = useState([])
  const [bons, setBons]          = useState([])
  const [vue, setVue]            = useState('bons')    // bons | fournisseurs
  const [modalBon, setModalBon]  = useState(false)
  const [newFourn, setNF]        = useState({ nom:'', tel:'', categorie:'Légumes', note:'' })
  const [ajoutFourn, setAF]      = useState(false)
  const [feedback, setFb]        = useState('')
  const [loading, setLoading]    = useState(true)
  const [erreur, setErreur]      = useState('')

  const fb = msg => { setFb(msg); setTimeout(() => setFb(''), 3000) }

  const fetchAll = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/fournisseurs').then(r => { if (!r.ok) throw new Error('fournisseurs'); return r.json() }),
        fetch('/api/bons-commande').then(r => { if (!r.ok) throw new Error('bons-commande'); return r.json() }),
      ])
      setFourn(Array.isArray(r1) ? r1 : [])
      setBons(Array.isArray(r2) ? r2 : [])
    } catch (e) {
      setErreur('Impossible de charger les données. Vérifiez votre connexion.')
      console.error('[FournisseursPanel]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function ajouterFourn() {
    if (!newFourn.nom) return
    try {
      const res = await fetch('/api/fournisseurs', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(newFourn),
      })
      if (!res.ok) throw new Error(await res.text())
      fetchAll(); setNF({ nom:'', tel:'', categorie:'Légumes', note:'' }); setAF(false); fb('✅ Fournisseur ajouté')
    } catch (e) {
      fb('❌ Impossible d\'ajouter le fournisseur.'); console.error(e)
    }
  }

  async function suppFourn(id) {
    if (!confirm('Supprimer ce fournisseur ?')) return
    try {
      await fetch(`/api/fournisseurs/${id}`, { method:'DELETE' })
      fetchAll(); fb('🗑️ Fournisseur supprimé')
    } catch (e) {
      fb('❌ Impossible de supprimer.'); console.error(e)
    }
  }

  async function changerStatutBon(id, status) {
    try {
      const res = await fetch(`/api/bons-commande/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(await res.text())
      fetchAll(); fb(status === 'recu' ? '✅ Livraison reçue → stocks mis à jour automatiquement' : '✅ Statut mis à jour')
    } catch (e) {
      fb('❌ Impossible de mettre à jour le statut.'); console.error(e)
    }
  }

  async function suppBon(id) {
    if (!confirm('Supprimer ce bon de commande ?')) return
    try {
      await fetch(`/api/bons-commande/${id}`, { method:'DELETE' })
      fetchAll(); fb('🗑️ Bon supprimé')
    } catch (e) {
      fb('❌ Impossible de supprimer le bon.'); console.error(e)
    }
  }

  if (loading) return <div style={{ textAlign:'center',padding:'60px 0',opacity:.3 }}>Chargement…</div>
  if (erreur)  return <div style={{ padding: 40, color: '#f87171', textAlign: 'center' }}>{erreur}</div>

  return (
    <div>
      <div style={{ display:'flex',gap:8,marginBottom:20 }}>
        {[['bons','📋 Bons de commande'],['fournisseurs','🏪 Fournisseurs']].map(([id,label]) => (
          <button key={id} onClick={() => setVue(id)} style={{
            padding:'6px 16px',borderRadius:20,fontSize:12,cursor:'pointer',
            border:`1px solid ${vue===id?'var(--gold)':'rgba(201,151,60,.2)'}`,
            background:vue===id?'rgba(201,151,60,.1)':'transparent',
            color:vue===id?'var(--gold)':'var(--cream-faint)',
          }}>{label} ({vue===id||(id==='bons'?bons:fournisseurs).length})</button>
        ))}
      </div>

      {feedback && <div style={{ background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,color:'var(--success)' }}>{feedback}</div>}

      {vue === 'bons' && (<>
        <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:16 }}>
          <button onClick={() => setModalBon(true)} disabled={fournisseurs.length===0} style={{ background:'linear-gradient(135deg,var(--gold),#a85f28)',border:'none',color:'#fff',padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer' }}>
            + Nouveau bon de commande
          </button>
        </div>
        {bons.length === 0 ? (
          <div style={{ textAlign:'center',padding:'40px 0',opacity:.3 }}>Aucun bon de commande</div>
        ) : bons.map(bon => {
          const fourn = fournisseurs.find(f => f.id === bon.fournisseurId)
          const st = STATUS_BON[bon.status] || STATUS_BON.brouillon
          const items = Array.isArray(bon.items) ? bon.items : []
          return (
            <div key={bon.id} style={{ background:'var(--ebony-2)',border:'1px solid rgba(201,151,60,.1)',borderRadius:12,padding:18,marginBottom:12 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700,fontSize:14 }}>{fourn?.nom || bon.fournisseurId}</div>
                  <div style={{ fontSize:11,opacity:.4 }}>{bon.dateCommande} · {items.length} article{items.length>1?'s':''}</div>
                  {bon.dateLivraison && <div style={{ fontSize:11,color:'var(--warning)' }}>📦 Livraison prévue : {bon.dateLivraison}</div>}
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ padding:'3px 10px',borderRadius:4,fontSize:11,fontWeight:600,background:`${st.color}18`,color:st.color }}>{st.label}</span>
                  <span style={{ fontWeight:800,color:'var(--gold)' }}>{bon.total?.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
              <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:10 }}>
                {items.map((it, i) => (
                  <span key={i} style={{ background:'rgba(255,255,255,.04)',borderRadius:6,padding:'3px 10px',fontSize:11 }}>
                    {it.qte} {it.unite} {it.nom} {it.prixUnit ? `· ${parseFloat(it.prixUnit).toLocaleString('fr-FR')} FCFA` : ''}
                  </span>
                ))}
              </div>
              <div style={{ display:'flex',gap:8 }}>
                {bon.status === 'brouillon' && <>
                  <button onClick={() => changerStatutBon(bon.id,'envoye')} style={btnSm('var(--warning)')}>📤 Marquer envoyé</button>
                  <button onClick={() => suppBon(bon.id)} style={btnSm('var(--danger)')}>× Supprimer</button>
                </>}
                {bon.status === 'envoye' && <>
                  <button onClick={() => changerStatutBon(bon.id,'recu')} style={btnSm('var(--success)')}>✅ Livraison reçue → MAJ stocks</button>
                  <button onClick={() => changerStatutBon(bon.id,'annule')} style={btnSm('var(--danger)')}>Annuler</button>
                </>}
                {bon.status === 'recu' && <div style={{ fontSize:11,color:'var(--success)',opacity:.6 }}>✓ Stocks mis à jour le {bon.dateLivraison || bon.dateCommande}</div>}
              </div>
            </div>
          )
        })}
      </>)}

      {vue === 'fournisseurs' && (<>
        <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:16 }}>
          <button onClick={() => setAF(a => !a)} style={{ background:'rgba(201,151,60,.08)',border:'1px solid rgba(201,151,60,.3)',color:'var(--gold)',padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer' }}>
            {ajoutFourn ? '✕ Annuler' : '+ Ajouter un fournisseur'}
          </button>
        </div>

        {ajoutFourn && (
          <div style={{ background:'rgba(201,151,60,.04)',border:'1px solid rgba(201,151,60,.2)',borderRadius:12,padding:16,marginBottom:20 }}>
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10 }}>
              <div>
                <label style={lbl}>NOM</label>
                <input value={newFourn.nom} onChange={e=>setNF(p=>({...p,nom:e.target.value}))} placeholder="Ex: Marché Mokolo" style={inp} />
              </div>
              <div>
                <label style={lbl}>TÉLÉPHONE</label>
                <input value={newFourn.tel} onChange={e=>setNF(p=>({...p,tel:e.target.value}))} placeholder="+237…" style={inp} />
              </div>
              <div>
                <label style={lbl}>CATÉGORIE</label>
                <select value={newFourn.categorie} onChange={e=>setNF(p=>({...p,categorie:e.target.value}))} style={sel}>
                  {CATS_FOURN.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={lbl}>NOTE</label>
              <input value={newFourn.note} onChange={e=>setNF(p=>({...p,note:e.target.value}))} placeholder="Remarques…" style={inp} />
            </div>
            <button onClick={ajouterFourn} style={{ background:'linear-gradient(135deg,var(--gold),#a85f28)',border:'none',color:'#fff',padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer' }}>
              Ajouter
            </button>
          </div>
        )}

        {fournisseurs.length === 0 ? (
          <div style={{ textAlign:'center',padding:'40px 0',opacity:.3 }}>Aucun fournisseur enregistré</div>
        ) : (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12 }}>
            {fournisseurs.map(f => (
              <div key={f.id} style={{ background:'var(--ebony-2)',border:'1px solid rgba(201,151,60,.1)',borderRadius:12,padding:16 }}>
                <div style={{ fontWeight:700,fontSize:14,marginBottom:4 }}>{f.nom}</div>
                <div style={{ fontSize:12,opacity:.5 }}>{f.categorie}</div>
                {f.tel && <div style={{ fontSize:12,color:'var(--gold)',marginTop:4 }}>📞 {f.tel}</div>}
                {f.note && <div style={{ fontSize:11,opacity:.4,marginTop:4,fontStyle:'italic' }}>{f.note}</div>}
                <button onClick={() => suppFourn(f.id)} style={{ marginTop:10,background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.2)',color:'rgba(239,68,68,.6)',padding:'4px 12px',borderRadius:6,fontSize:11,cursor:'pointer' }}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </>)}

      {modalBon && (
        <ModaleBon
          fournisseurs={fournisseurs}
          onClose={() => setModalBon(false)}
          onCreated={() => { setModalBon(false); fetchAll(); fb('✅ Bon de commande créé') }}
        />
      )}
    </div>
  )
}

const lbl = { fontSize:10,color:'var(--cream-faint)',letterSpacing:1,display:'block',marginBottom:4 }
const inp = { width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,.05)',border:'1px solid rgba(201,151,60,.2)',borderRadius:8,color:'var(--cream)',padding:'8px 12px',fontSize:13,fontFamily:'inherit' }
const sel = { width:'100%',boxSizing:'border-box',background:'rgba(30,20,10,.95)',border:'1px solid rgba(201,151,60,.2)',borderRadius:8,color:'var(--cream)',padding:'8px 12px',fontSize:13 }
const btnSm = color => ({ padding:'5px 12px',borderRadius:6,border:`1px solid ${color}44`,background:`${color}10`,color,fontSize:11,cursor:'pointer',fontWeight:600 })
