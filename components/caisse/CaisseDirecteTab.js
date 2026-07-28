'use client'
import { useState, useEffect } from 'react'
import { PAIEMENT_LABELS, buildReceiptHTML, miniInput, MODES_PAIEMENT } from '@/components/caisse/constants'

function CaisseDirecteTab({ bannerHeight = 0, sessionCaisse, parametres, branding }) {
  const [menu,       setMenu]       = useState([])
  const [panier,     setPanier]     = useState({})
  const [catActive,  setCat]        = useState('tous')
  const [client,     setClient]     = useState('')
  const [tel,        setTel]        = useState('')
  const [note,       setNote]       = useState('')
  const [loading,    setLoading]    = useState(true)
  const [busy,       setBusy]       = useState(false)
  const [recu,       setRecu]       = useState(null)
  const [erreur,     setErreur]     = useState('')
  const [recherche,  setRecherche]  = useState('')
  // Paiement
  const [paiement,   setPaiement]   = useState('especes')
  const [mixte,      setMixte]      = useState(false)
  const [lignesPay,  setLignesPay]  = useState([{ key: 'especes', montant: '' }])
  const [montantRecu,setMontantRecu]= useState('')

  useEffect(() => {
    fetch('/api/menu').then(r => r.json()).then(data => {
      setMenu(Array.isArray(data) ? data.filter(p => p.actif) : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const lignes     = Object.entries(panier).map(([id, qty]) => ({ plat: menu.find(p => String(p.id) === id), qty })).filter(l => l.plat && l.qty > 0)
  const sousTotal  = lignes.reduce((s, l) => s + l.plat.price * l.qty, 0)
  const reduction  = sousTotal >= 15000 ? Math.round(sousTotal * 0.10) : 0
  const total      = sousTotal - reduction
  const nbArticles = Object.values(panier).reduce((s, q) => s + q, 0)
  const cats       = ['tous', ...new Set(menu.map(p => p.cat))]
  const menuFiltre = menu.filter(p => (catActive === 'tous' || p.cat === catActive) && (!recherche || p.name.toLowerCase().includes(recherche.toLowerCase())))

  // Paiement mixte
  const resteAPayer       = total - lignesPay.reduce((s, l) => s + (parseInt(l.montant) || 0), 0)
  const mixteValide       = mixte && lignesPay.length >= 2 && lignesPay.every(l => l.key && parseInt(l.montant) > 0) && Math.abs(resteAPayer) < 1
  const modeIncludesEsp   = !mixte ? ['especes','livraison','resto'].includes(paiement) : lignesPay.some(l => ['especes','livraison','resto'].includes(l.key))
  const montantRecuNum    = parseInt(montantRecu) || 0
  const renduMonnaie      = modeIncludesEsp && montantRecuNum > total ? montantRecuNum - total : 0
  const montantRecuValide = !modeIncludesEsp || !montantRecu || montantRecuNum >= total

  function setQty(id, delta) {
    setPanier(prev => { const q = Math.max(0, (prev[id] || 0) + delta); const n = { ...prev, [id]: q }; if (q === 0) delete n[id]; return n })
  }
  function updateLigne(i, f, v) { setLignesPay(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l)) }

  function reset() { setPanier({}); setClient(''); setTel(''); setNote(''); setPaiement('especes'); setMixte(false); setLignesPay([{ key: 'especes', montant: '' }]); setMontantRecu(''); setErreur(''); setRecu(null) }

  async function vendre() {
    if (lignes.length === 0)  { setErreur('Sélectionnez au moins un article'); return }
    if (!sessionCaisse)       { setErreur('Ouvrez la session caisse avant de vendre'); return }
    if (mixte && !mixteValide){ setErreur('Vérifiez la ventilation du paiement mixte'); return }
    if (!montantRecuValide)   { setErreur(`Montant reçu insuffisant (min. ${total.toLocaleString('fr-FR')} FCFA)`); return }
    setBusy(true); setErreur('')
    const paiementFinal = mixte
      ? lignesPay.map(l => ({ mode: l.key, label: MODES_PAIEMENT.find(m => m.key === l.key)?.label || l.key, montant: parseInt(l.montant) }))
      : paiement
    try {
      const items = lignes.map(l => ({ id: l.plat.id, name: l.plat.name, price: l.plat.price, qty: l.qty }))
      const res   = await fetch('/api/vente-directe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: client || 'Client sur place', tel: tel || '000000000', items, total, paiement: paiementFinal, note }),
      })
      const data = await res.json()
      if (!res.ok) { setErreur(data.error || 'Erreur'); setBusy(false); return }
      setRecu({ ...data, items, total, sousTotal, reduction, renduMonnaie, client: client || 'Client sur place', tel, paiement: paiementFinal })
    } catch { setErreur('Erreur réseau. Veuillez réessayer.') }
    setBusy(false)
  }

  function imprimerRecu() {
    if (!recu) return
    const win = window.open('', '_blank', 'width=400,height=680')
    if (!win) { alert('Autorisez les popups pour imprimer le reçu.'); return }
    const dateStr = new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    win.document.write(buildReceiptHTML({
      id: recu.id, client: recu.client, tel: recu.tel,
      mode: 'Caisse directe — Sur place',
      paiement: Array.isArray(recu.paiement) ? recu.paiement : (PAIEMENT_LABELS[recu.paiement] || recu.paiement),
      renduMonnaie: recu.renduMonnaie || 0,
      dateStr, items: recu.items,
      sousTotal: recu.sousTotal, reduction: recu.reduction, total: recu.total,
      caissier: sessionCaisse?.ouvertPar, sessionId: sessionCaisse?.id, note: recu.note,
      restaurantNom: parametres?.nom || 'CHEZ MAMAN BIYA',
      restaurantAdresse: parametres?.adresse || 'Yaoundé, Cameroun',
      restaurantTel: parametres?.telephone || '+237 677 000 000',
      numeroFacture: recu.numeroFacture,
      logo: branding?.logo || null,
      qrUrl: recu.qrUrl || null,
    }))
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  if (recu) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 22, fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>Vente enregistrée !</div>
          <div style={{ fontSize: 13, opacity: .5 }}>{recu.id}</div>
        </div>
        <div style={{ background: 'rgba(240,232,216,.04)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 14, padding: '20px 18px', fontFamily: 'monospace', fontSize: 12, marginBottom: 20 }}>
          <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 14, marginBottom: 12 }}>★ CHEZ MAMAN BIYA ★</div>
          {Array.isArray(recu.paiement)
            ? recu.paiement.map((p, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ opacity: .45 }}>{p.label || p.mode}</span><span>{p.montant.toLocaleString('fr-FR')} FCFA</span></div>)
            : <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ opacity: .45 }}>Règlement</span><span>{PAIEMENT_LABELS[recu.paiement] || recu.paiement}</span></div>
          }
          <div style={{ borderTop: '1px dashed rgba(255,255,255,.2)', margin: '10px 0' }} />
          {recu.items.map((it, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, opacity: .8 }}><span>{it.qty}× {it.name}</span><span>{((it.price||0)*it.qty).toLocaleString('fr-FR')} F</span></div>)}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,.2)', margin: '10px 0' }} />
          {recu.reduction > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', marginBottom: 4, fontSize: 11 }}><span>Réduction -10%</span><span>- {recu.reduction.toLocaleString('fr-FR')} F</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginTop: 4 }}><span>TOTAL TTC</span><span style={{ color: 'var(--gold)' }}>{recu.total.toLocaleString('fr-FR')} FCFA</span></div>
          {recu.renduMonnaie > 0 && (<><div style={{ borderTop: '1px dashed rgba(255,255,255,.2)', margin: '8px 0' }} /><div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 15, color: 'var(--warning)' }}><span>💵 Rendu monnaie</span><span>{recu.renduMonnaie.toLocaleString('fr-FR')} FCFA</span></div></>)}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={imprimerRecu} style={{ flex: 2, background: 'linear-gradient(135deg,var(--gold),#a85f28)', border: 'none', color: '#fff', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🖨️ Imprimer le reçu</button>
          <button onClick={reset} style={{ flex: 1, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: 'var(--success)', padding: '13px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🛒 Nouvelle vente</button>
        </div>
      </div>
    )
  }

  return (
    <div className="caisse-split">
      <div>
        <div style={{ marginBottom: 14 }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="🔍 Rechercher un plat…" style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(240,232,216,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: 'var(--cream)', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `1px solid ${catActive === c ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`, background: catActive === c ? 'var(--border-gold)' : 'transparent', color: catActive === c ? 'var(--gold)' : 'var(--cream-faint)' }}>{c === 'tous' ? 'Tout le menu' : c}</button>)}
          </div>
        </div>
        {loading ? <div style={{ textAlign: 'center', padding: '40px 0', opacity: .3 }}>Chargement du menu…</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {menuFiltre.map(plat => {
              const qty = panier[plat.id] || 0
              return (
                <div key={plat.id} style={{ background: qty > 0 ? 'rgba(201,151,60,.08)' : 'var(--ebony-2)', border: `1px solid ${qty > 0 ? 'rgba(201,151,60,.5)' : 'var(--border-gold)'}`, borderRadius: 12, padding: '14px 14px', cursor: 'pointer', transition: 'all .15s', position: 'relative' }} onClick={() => setQty(String(plat.id), 1)}>
                  {qty > 0 && <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--gold)', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{qty}</div>}
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{plat.emoji || '🍽️'}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>{plat.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{plat.price.toLocaleString('fr-FR')} FCFA</div>
                  {qty > 0 ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button onClick={e => { e.stopPropagation(); setQty(String(plat.id), -1) }} style={{ flex: 1, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', borderRadius: 6, fontSize: 16, cursor: 'pointer', padding: '3px 0' }}>−</button>
                      <button onClick={e => { e.stopPropagation(); setQty(String(plat.id), 1) }} style={{ flex: 1, background: 'var(--border-gold)', border: '1px solid rgba(201,151,60,.4)', color: 'var(--gold)', borderRadius: 6, fontSize: 16, cursor: 'pointer', padding: '3px 0' }}>+</button>
                    </div>
                  ) : <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'var(--gold)', opacity: .5 }}>Cliquer pour ajouter</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ticket */}
      <div className="caisse-sticky-panel" style={{ top: bannerHeight + 60 + 44 }}>
        <div style={{ background: 'rgba(240,232,216,.03)', border: '1px solid rgba(201,151,60,.18)', borderRadius: 14, padding: '18px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>🛒 Ticket ({nbArticles} article{nbArticles !== 1 ? 's' : ''})</div>
          {lignes.length === 0 ? <div style={{ textAlign: 'center', opacity: .25, padding: '20px 0', fontSize: 12 }}>Sélectionnez des plats dans le menu</div> : (
            <div style={{ marginBottom: 14 }}>
              {lignes.map(l => (
                <div key={l.plat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.plat.name}</div><div style={{ opacity: .4 }}>{l.plat.price.toLocaleString('fr-FR')} × {l.qty}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{(l.plat.price * l.qty).toLocaleString('fr-FR')}</span>
                    <button onClick={() => setQty(String(l.plat.id), -l.qty)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.5)', fontSize: 14, cursor: 'pointer' }}>×</button>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed rgba(201,151,60,.2)', paddingTop: 10, marginTop: 6 }}>
                {reduction > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--success)', marginBottom: 4 }}><span>🎉 Réduction -10% (≥15 000)</span><span>- {reduction.toLocaleString('fr-FR')}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}><span>Total</span><span style={{ color: 'var(--success)' }}>{total.toLocaleString('fr-FR')} FCFA</span></div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder="Nom du client (optionnel)" style={miniInput} />
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Téléphone (optionnel)" style={{ ...miniInput, marginTop: 6 }} />
          </div>

          {/* Mode paiement */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[{ id: false, label: 'Mode unique' }, { id: true, label: '✂️ Mixte' }].map(opt => (
                <button key={String(opt.id)} onClick={() => { setMixte(opt.id); if (opt.id) setLignesPay([{ key: paiement, montant: '' }, { key: 'mtn', montant: '' }]); else setLignesPay([{ key: paiement, montant: String(total) }]) }} style={{ flex: 1, padding: '6px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${mixte === opt.id ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`, background: mixte === opt.id ? 'var(--border-gold)' : 'transparent', color: mixte === opt.id ? 'var(--gold)' : 'var(--cream-faint)', fontFamily: 'inherit' }}>{opt.label}</button>
              ))}
            </div>
            {!mixte ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {MODES_PAIEMENT.map(p => <button key={p.key} onClick={() => setPaiement(p.key)} style={{ padding: '8px 6px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${paiement === p.key ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`, background: paiement === p.key ? 'var(--border-gold)' : 'transparent', color: paiement === p.key ? 'var(--gold)' : 'var(--cream-faint)' }}>{p.label}</button>)}
              </div>
            ) : (
              <div>
                {lignesPay.map((ligne, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <select value={ligne.key} onChange={e => updateLigne(idx, 'key', e.target.value)} style={{ flex: 1, padding: '7px 8px', borderRadius: 7, fontSize: 11, background: '#1a1206', border: '1px solid rgba(201,151,60,.3)', color: 'var(--cream)', fontFamily: 'inherit' }}>
                      {MODES_PAIEMENT.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <input type="number" min="0" placeholder="Montant" value={ligne.montant} onChange={e => updateLigne(idx, 'montant', e.target.value)} style={{ width: 80, padding: '7px 8px', borderRadius: 7, fontSize: 11, background: '#1a1206', border: '1px solid rgba(201,151,60,.3)', color: 'var(--cream)', fontFamily: 'inherit' }} />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: Math.abs(resteAPayer) < 1 ? 'var(--success)' : 'var(--warning)', marginBottom: 6 }}>
                  {Math.abs(resteAPayer) < 1 ? '✅ Équilibré' : `Reste : ${resteAPayer.toLocaleString('fr-FR')} FCFA`}
                </div>
                {lignesPay.length < MODES_PAIEMENT.length && <button onClick={() => setLignesPay(p => [...p, { key: 'orange', montant: '' }])} style={{ fontSize: 11, background: 'transparent', border: '1px dashed rgba(201,151,60,.3)', color: 'rgba(201,151,60,.6)', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 6, width: '100%' }}>+ Mode</button>}
              </div>
            )}
          </div>

          {/* Rendu monnaie */}
          {modeIncludesEsp && !mixte && (
            <div style={{ marginBottom: 10 }}>
              <input type="number" min={total} placeholder={`Reçu par client (min ${total.toLocaleString('fr-FR')})`} value={montantRecu} onChange={e => setMontantRecu(e.target.value)} style={{ ...miniInput, border: `1px solid ${!montantRecu || montantRecuValide ? 'rgba(201,151,60,.18)' : 'rgba(239,68,68,.4)'}` }} />
              {renduMonnaie > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '8px 10px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 7, fontWeight: 700, color: 'var(--warning)', fontSize: 13 }}><span>💵 Rendu monnaie</span><span>{renduMonnaie.toLocaleString('fr-FR')} FCFA</span></div>}
            </div>
          )}

          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (allergies, instructions…)" rows={2} style={{ ...miniInput, resize: 'none', marginBottom: 12, width: '100%', boxSizing: 'border-box' }} />

          {erreur && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '8px 12px', color: 'var(--danger)', fontSize: 11, marginBottom: 10 }}>⚠️ {erreur}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={vendre} disabled={busy || lignes.length === 0 || !sessionCaisse} style={{ background: busy || lignes.length === 0 ? 'rgba(201,151,60,.25)' : 'linear-gradient(135deg,var(--gold),#a85f28)', border: 'none', color: '#fff', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: busy || lignes.length === 0 ? 'not-allowed' : 'pointer' }}>
              {busy ? '⏳ Enregistrement…' : `✅ Encaisser ${total > 0 ? total.toLocaleString('fr-FR') + ' FCFA' : ''}`}
            </button>
            {lignes.length > 0 && <button onClick={() => setPanier({})} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.2)', color: 'rgba(239,68,68,.5)', padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>🗑️ Vider le ticket</button>}
            {!sessionCaisse && <div style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', opacity: .8 }}>⚠️ Ouvrez la caisse avant de vendre</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaisseDirecteTab
