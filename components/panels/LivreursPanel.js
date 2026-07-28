'use client'

import { useState, useEffect, useCallback } from 'react'

const STATUS_LIV = {
  disponible:   { label: 'Disponible',  color: 'var(--success)' },
  en_course:    { label: 'En livraison',   color: 'var(--warning)' },
  indisponible: { label: 'Indisponible',     color: '#6b7280' },
}
const ZONES_YAOUND = ['Bastos', 'Nlongkak', 'Tsinga', 'Centre-ville', 'Melen', 'Omnisport', 'Ngousso', 'Nkol-Eton', 'Messa', 'Biyem-Assi', 'Mvog-Ada']

export default function LivreursPanel({ commandes = [] }) {
  const [livreurs, setLiv]  = useState([])
  const [loading, setLoad]  = useState(true)
  const [ajout, setAjout]   = useState(false)
  const [form, setForm]     = useState({ nom:'', tel:'', zones:[], pin:'' })
  const [feedback, setFb]   = useState('')
  const [assig, setAssig]   = useState(null) // { commande, livreurId }
  const [erreur, setErreur] = useState('')
  const [pinEdit, setPinEdit] = useState(null) // { id, value }

  const fb = msg => { setFb(msg); setTimeout(() => setFb(''), 3000) }

  const fetchLiv = useCallback(async () => {
    try {
      const res = await fetch('/api/livreurs')
      if (!res.ok) throw new Error(await res.text())
      const d = await res.json()
      setLiv(Array.isArray(d) ? d : [])
      setErreur('')
    } catch (e) {
      setErreur('Impossible de charger les livreurs. Vérifiez votre connexion.')
      console.error('[LivreursPanel]', e)
    } finally {
      setLoad(false)
    }
  }, [])

  useEffect(() => { fetchLiv(); const iv = setInterval(fetchLiv, 30_000); return () => clearInterval(iv) }, [fetchLiv])

  async function ajouter() {
    if (!form.nom || !form.tel) return
    try {
      const res = await fetch('/api/livreurs', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      fetchLiv(); setForm({ nom:'', tel:'', zones:[], pin:'' }); setAjout(false); fb('✅ Livreur ajouté')
    } catch (e) {
      fb('❌ Impossible d\'ajouter le livreur. Vérifiez votre connexion.')
      console.error('[LivreursPanel ajouter]', e)
    }
  }

  async function definirPin(id, pin) {
    if (!/^\d{4}$/.test(pin)) { fb('❌ Le code doit avoir 4 chiffres'); return }
    try {
      const res = await fetch(`/api/livreurs/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) throw new Error(await res.text())
      setPinEdit(null); fetchLiv(); fb('✅ Code livreur mis à jour')
    } catch (e) {
      fb('❌ Impossible de définir le code.')
      console.error('[LivreursPanel definirPin]', e)
    }
  }

  async function changerStatus(id, status) {
    try {
      await fetch(`/api/livreurs/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status }),
      })
      fetchLiv()
    } catch (e) {
      fb('❌ Impossible de mettre à jour le statut.')
      console.error('[LivreursPanel changerStatus]', e)
    }
  }

  async function desactiver(id) {
    if (!confirm('Désactiver ce livreur ?')) return
    try {
      await fetch(`/api/livreurs/${id}`, { method:'DELETE' })
      fetchLiv(); fb('✅ Livreur désactivé')
    } catch (e) {
      fb('❌ Impossible de désactiver ce livreur.')
      console.error('[LivreursPanel desactiver]', e)
    }
  }

  async function assignerLivreur() {
    if (!assig) return
    try {
      const res = await fetch(`/api/commandes/${assig.commande.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'en_livraison', livreurId: assig.livreurId }),
      })
      if (!res.ok) throw new Error(await res.text())
      fb(`✅ ${assig.commande.id} assignée`); setAssig(null); fetchLiv()
    } catch (e) {
      fb('❌ Impossible d\'assigner le livreur.')
      console.error('[LivreursPanel assignerLivreur]', e)
    }
  }

  async function desassignerLivreur(commande) {
    if (!confirm(`Désassigner le livreur de la commande ${commande.id} ?`)) return
    try {
      const res = await fetch(`/api/commandes/${commande.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'pret', livreurId: null }),
      })
      if (!res.ok) throw new Error(await res.text())
      fb(`✅ ${commande.id} désassignée`); fetchLiv()
    } catch (e) {
      fb('❌ Impossible de désassigner le livreur.')
      console.error('[LivreursPanel desassignerLivreur]', e)
    }
  }

  // Commandes prêtes en attente d'assignation à un livreur
  const aLivrer = commandes.filter(c => c.status === 'pret' && c.mode?.toLowerCase().includes('livr'))

  // Commandes actuellement en livraison (assignées)
  const enLivraison = commandes.filter(c => c.status === 'en_livraison' && c.mode?.toLowerCase().includes('livr'))

  const toggleZone = z => setForm(p => ({
    ...p,
    zones: p.zones.includes(z) ? p.zones.filter(x => x!==z) : [...p.zones, z]
  }))

  if (loading) return <div style={{ textAlign:'center',padding:'60px 0',opacity:.3 }}>Chargement…</div>
  if (erreur)  return <div style={{ padding: 40, color: '#f87171', textAlign: 'center' }}>{erreur}</div>

  return (
    <div>
      {feedback && <div style={{ background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,padding:'8px 16px',marginBottom:16,fontSize:12,color:'var(--success)' }}>{feedback}</div>}

      {/* KPIs livreurs */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:24 }}>
        {[
          { label:'Disponibles',  val:livreurs.filter(l=>l.status==='disponible').length,  color:'var(--success)' },
          { label:'En course',    val:livreurs.filter(l=>l.status==='en_course').length,   color:'var(--warning)' },
          { label:'Indisponibles',val:livreurs.filter(l=>l.status==='indisponible').length,color:'#6b7280' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--ebony-2)',border:`1px solid ${k.color}20`,borderRadius:12,padding:'14px 16px',textAlign:'center' }}>
            <div style={{ fontSize:22,fontWeight:800,color:k.color }}>{k.val}</div>
            <div style={{ fontSize:11,opacity:.4,marginTop:3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Commandes en cours de livraison */}
      {enLivraison.length > 0 && (
        <div style={{ background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.3)',borderRadius:12,padding:16,marginBottom:24 }}>
          <div style={{ fontSize:12,fontWeight:700,color:'var(--success)',marginBottom:12 }}>🛵 {enLivraison.length} commande{enLivraison.length>1?'s':''} en livraison</div>
          {enLivraison.map(c => {
            const liv = livreurs.find(l => l.id === c.livreurId)
            return (
              <div key={c.id} style={{ display:'flex',flexWrap:'wrap',gap:8,justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(16,185,129,.1)' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:600 }}>{c.id}</div>
                  <div style={{ fontSize:11,opacity:.5, overflowWrap:'break-word' }}>{c.client} · {liv ? `🛵 ${liv.nom}` : 'Livreur inconnu'}</div>
                </div>
                <button onClick={() => desassignerLivreur(c)} style={{ flexShrink:0, background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)',color:'#f87171',padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer' }}>
                  Désassigner
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Commandes à assigner */}
      {aLivrer.length > 0 && (
        <div style={{ background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.3)',borderRadius:12,padding:16,marginBottom:24 }}>
          <div style={{ fontSize:12,fontWeight:700,color:'var(--warning)',marginBottom:12 }}>📦 {aLivrer.length} commande{aLivrer.length>1?'s':''} à assigner</div>
          {aLivrer.map(c => (
            <div key={c.id} style={{ display:'flex',flexWrap:'wrap',gap:8,justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(245,158,11,.1)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13,fontWeight:600 }}>{c.id}</div>
                <div style={{ fontSize:11,opacity:.5, overflowWrap:'break-word' }}>{c.client} · {c.addr || 'Adresse non précisée'}</div>
                {/* v22 — Badge acompte + reste à encaisser */}
                {c.acompte > 0 && c.acompteStatut === 'paye' ? (
                  <div style={{ marginTop:4, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10,padding:'2px 7px',borderRadius:6,background:'rgba(16,185,129,.12)',color:'#10b981',fontWeight:700 }}>
                      ✓ Acompte {c.acompte.toLocaleString('fr-FR')} XAF
                    </span>
                    <span style={{ fontSize:10,padding:'2px 7px',borderRadius:6,background:'rgba(245,158,11,.12)',color:'#f59e0b',fontWeight:700 }}>
                      💵 Encaisser {c.resteARegler.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ) : c.total > 0 && c.paiement === 'livraison' && (!c.acompte || c.acompte === 0) ? (
                  <div style={{ marginTop:4 }}>
                    <span style={{ fontSize:10,padding:'2px 7px',borderRadius:6,background:'rgba(245,158,11,.12)',color:'#f59e0b',fontWeight:700 }}>
                      💵 Encaisser {c.total.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ) : null}
              </div>
              <select onChange={e => e.target.value && setAssig({ commande:c, livreurId:e.target.value })}
                style={{ flexShrink:0, background:'rgba(30,20,10,.95)',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,color:'var(--cream)',padding:'6px 10px',fontSize:12 }}>
                <option value="">— Assigner —</option>
                {livreurs.filter(l=>l.status==='disponible').map(l => (
                  <option key={l.id} value={l.id}>{l.nom}</option>
                ))}
              </select>
            </div>
          ))}
          {assig && (
            <button onClick={assignerLivreur} style={{ marginTop:12,width:'100%',background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',color:'#fff',padding:10,borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer' }}>
              ✅ Confirmer l'assignation
            </button>
          )}
        </div>
      )}

      {/* Liste livreurs */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <div style={{ fontSize:13,fontWeight:700,color:'var(--gold)' }}>🛵 Équipe de livraison ({livreurs.length})</div>
        <button onClick={() => setAjout(a=>!a)} style={{ background:'rgba(201,151,60,.08)',border:'1px solid rgba(201,151,60,.3)',color:'var(--gold)',padding:'7px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer' }}>
          {ajout ? '✕' : '+ Ajouter'}
        </button>
      </div>

      {ajout && (
        <div style={{ background:'rgba(201,151,60,.04)',border:'1px solid rgba(201,151,60,.2)',borderRadius:12,padding:16,marginBottom:16 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
            <div>
              <label style={lbl}>NOM</label>
              <input value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} placeholder="Prénom Nom" style={inp} />
            </div>
            <div>
              <label style={lbl}>TÉLÉPHONE</label>
              <input value={form.tel} onChange={e=>setForm(p=>({...p,tel:e.target.value}))} placeholder="+237 6XX XXX XXX" style={inp} />
            </div>
            <div>
              <label style={lbl}>CODE APP LIVREUR (4 chiffres)</label>
              <input value={form.pin} onChange={e=>setForm(p=>({...p,pin:e.target.value.replace(/\D/g,'').slice(0,4)}))} placeholder="ex: 1234" maxLength={4} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={lbl}>ZONES DE LIVRAISON</label>
            <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
              {ZONES_YAOUND.map(z => (
                <button key={z} onClick={() => toggleZone(z)} style={{ padding:'4px 10px',borderRadius:14,fontSize:11,cursor:'pointer',
                  border:`1px solid ${form.zones.includes(z)?'var(--gold)':'rgba(201,151,60,.2)'}`,
                  background:form.zones.includes(z)?'rgba(201,151,60,.12)':'transparent',
                  color:form.zones.includes(z)?'var(--gold)':'var(--cream-faint)' }}>
                  {z}
                </button>
              ))}
            </div>
          </div>
          <button onClick={ajouter} style={{ background:'linear-gradient(135deg,var(--gold),#a85f28)',border:'none',color:'#fff',padding:'9px 20px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer' }}>
            Ajouter le livreur
          </button>
        </div>
      )}

      {livreurs.length === 0 ? (
        <div style={{ textAlign:'center',padding:'40px 0',opacity:.3 }}>Aucun livreur enregistré</div>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12 }}>
          {livreurs.map(l => {
            const st = STATUS_LIV[l.status] || STATUS_LIV.disponible
            return (
              <div key={l.id} style={{ background:'var(--ebony-2)',border:`1px solid ${st.color}25`,borderRadius:12,padding:16 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8 }}>
                  <div>
                    <div style={{ fontWeight:700,fontSize:14 }}>🛵 {l.nom}</div>
                    <div style={{ fontSize:12,color:'var(--gold)' }}>{l.tel}</div>
                  </div>
                  <span style={{ padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:700,background:`${st.color}18`,color:st.color }}>{st.label}</span>
                </div>
                {l.zones?.length > 0 && (
                  <div style={{ display:'flex',flexWrap:'wrap',gap:4,marginBottom:10 }}>
                    {l.zones.map(z => (
                      <span key={z} style={{ fontSize:10,background:'rgba(255,255,255,.06)',borderRadius:4,padding:'2px 6px',opacity:.6 }}>{z}</span>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex',gap:6 }}>
                  {l.status !== 'disponible'   && <button onClick={() => changerStatus(l.id,'disponible')}   style={btnSt('var(--success)')}>Disponible</button>}
                  {l.status !== 'en_course'    && <button onClick={() => changerStatus(l.id,'en_course')}    style={btnSt('var(--warning)')}>En course</button>}
                  {l.status !== 'indisponible' && <button onClick={() => changerStatus(l.id,'indisponible')} style={btnSt('#6b7280')}>Indispo</button>}
                  <button onClick={() => desactiver(l.id)} style={{ marginLeft:'auto',background:'none',border:'none',color:'rgba(239,68,68,.4)',fontSize:12,cursor:'pointer' }}>×</button>
                </div>

                {/* v26 — Code d'accès à l'app livreur /livraison */}
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,.05)' }}>
                  {pinEdit?.id === l.id ? (
                    <div style={{ display:'flex', gap:6 }}>
                      <input autoFocus value={pinEdit.value} onChange={e=>setPinEdit({ id:l.id, value:e.target.value.replace(/\D/g,'').slice(0,4) })}
                        placeholder="4 chiffres" maxLength={4} style={{ ...inp, padding:'5px 8px', fontSize:12 }} />
                      <button onClick={() => definirPin(l.id, pinEdit.value)} style={btnSt('var(--gold)')}>OK</button>
                      <button onClick={() => setPinEdit(null)} style={btnSt('#6b7280')}>Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => setPinEdit({ id:l.id, value:'' })} style={{ ...btnSt('var(--gold)'), width:'100%' }}>
                      {l.hasPin ? '🔑 Changer le code app livreur' : '🔑 Définir un code app livreur'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const lbl = { fontSize:10,color:'var(--cream-faint)',letterSpacing:1,display:'block',marginBottom:4 }
const inp = { width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,.05)',border:'1px solid rgba(201,151,60,.2)',borderRadius:8,color:'var(--cream)',padding:'8px 12px',fontSize:13,fontFamily:'inherit' }
const btnSt = c => ({ padding:'4px 10px',borderRadius:6,border:`1px solid ${c}40`,background:`${c}10`,color:c,fontSize:10,cursor:'pointer',fontWeight:600 })
