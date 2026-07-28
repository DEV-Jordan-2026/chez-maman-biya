'use client'
import { useState, useEffect } from 'react'
import { MODES_PAIEMENT } from '@/components/caisse/constants'

// ── Modal Encaissement ────────────────────────────────────────────────────────

function EncaissementModal({ cmd, total: totalInitial, loading, error, onConfirm, onClose, parametres, sessionCaisse }) {
  const initMode = ['especes','livraison','resto','mtn','mtn_paye','orange','orange_paye'].includes(cmd.paiement)
    ? (cmd.paiement === 'mtn_paye' ? 'mtn' : cmd.paiement === 'orange_paye' ? 'orange' : cmd.paiement)
    : 'especes'

  // ── Paiement ──────────────────────────────────────────────────────────────
  const [mixte,       setMixte]       = useState(false)
  const [mode,        setMode]        = useState(initMode)
  const [lignesPay,   setLignesPay]   = useState([{ key: initMode, montant: String(totalInitial) }])
  const [montantRecu, setMontantRecu] = useState('')

  // ── Vérification MoMo ─────────────────────────────────────────────────────
  // Oblige le caissier à confirmer qu'il a bien reçu le paiement mobile
  const [momoVerifie,    setMomoVerifie]    = useState(false)
  const [momoNumero,     setMomoNumero]     = useState(cmd.tel || '')
  const isMomo = !mixte && ['mtn', 'orange'].includes(mode)
  const momoLabel = mode === 'mtn' ? 'MTN MoMo' : 'Orange Money'

  // ── Remise ────────────────────────────────────────────────────────────────
  const [showRemise,        setShowRemise]        = useState(false)
  const [remiseType,        setRemiseType]        = useState('montant')
  const [remiseValeur,      setRemiseValeur]      = useState('')
  const [remiseMotif,       setRemiseMotif]       = useState('Fidélité client')
  const [remiseMotifCustom, setRemiseMotifCustom] = useState('')
  const [remiseBusy,        setRemiseBusy]        = useState(false)
  const [remiseOK,          setRemiseOK]          = useState(null)
  const [remiseErr,         setRemiseErr]         = useState('')

  const MOTIFS_REMISE = ['Fidélité client','Commande importante','Geste commercial','Article manquant','Erreur de commande','Autre']

  const total          = remiseOK ? Math.max(0, totalInitial - remiseOK.montant) : totalInitial
  const remiseValeurN  = parseFloat(remiseValeur) || 0
  const remisePreview  = remiseType === 'pct' ? Math.round(totalInitial * remiseValeurN / 100) : Math.round(remiseValeurN)
  const totalPreview   = Math.max(0, totalInitial - remisePreview)

  // Recaler lignesPay si total change
  useEffect(() => { if (!mixte) setLignesPay([{ key: mode, montant: String(total) }]) }, [total]) // eslint-disable-line

  // ── Paiement calc ─────────────────────────────────────────────────────────
  const resteAPayer       = total - lignesPay.reduce((s, l) => s + (parseInt(l.montant) || 0), 0)
  const mixteValide       = lignesPay.length >= 2 && lignesPay.every(l => l.key && parseInt(l.montant) > 0) && Math.abs(resteAPayer) < 1
  const modeIncludesEsp   = !mixte ? ['especes','livraison','resto'].includes(mode) : lignesPay.some(l => ['especes','livraison','resto'].includes(l.key))
  const montantRecuNum    = parseInt(montantRecu) || 0
  const renduMonnaie      = modeIncludesEsp && montantRecuNum > total ? montantRecuNum - total : 0
  const montantRecuValide = !montantRecu || montantRecuNum >= total

  function ajouterLigne()    { const k = MODES_PAIEMENT.find(m => !lignesPay.some(l => l.key === m.key))?.key || 'especes'; setLignesPay(p => [...p, { key: k, montant: String(Math.max(0, resteAPayer)) }]) }
  function supprimerLigne(i) { setLignesPay(p => p.filter((_, idx) => idx !== i)) }
  function updateLigne(i, f, v) { setLignesPay(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l)) }

  async function appliquerRemise() {
    if (remisePreview <= 0 || remisePreview >= totalInitial) { setRemiseErr('Montant invalide'); return }
    const motif = remiseMotif === 'Autre' ? (remiseMotifCustom.trim() || 'Autre') : remiseMotif
    setRemiseBusy(true); setRemiseErr('')
    try {
      const res  = await fetch(`/api/commandes/${cmd.id}/remise`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ montant: remisePreview, motif }) })
      const data = await res.json()
      if (!res.ok) { setRemiseErr(data.error || 'Erreur'); setRemiseBusy(false); return }
      setRemiseOK({ montant: remisePreview, motif })
      setShowRemise(false)
    } catch { setRemiseErr('Erreur réseau') }
    setRemiseBusy(false)
  }

  function confirmer() {
    if (isMomo && !momoVerifie) return
    if (mixte) { if (!mixteValide) return; onConfirm(lignesPay.map(l => ({ mode: l.key, label: MODES_PAIEMENT.find(m => m.key === l.key)?.label || l.key, montant: parseInt(l.montant) })), 0) }
    else { onConfirm(mode, renduMonnaie) }
  }

  const sInp = { padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#1a1206', border: '1px solid rgba(201,151,60,.3)', color: 'var(--cream)', fontFamily: 'var(--font-dm)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#141008', border: '1px solid rgba(201,151,60,.3)', borderRadius: 16, padding: '24px 20px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.6)', maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)' }}>💳 Encaisser la commande</div>
          <div style={{ fontSize: 12, opacity: .45, marginTop: 3 }}>{cmd.id}</div>
        </div>

        {/* Bloc montant */}
        <div style={{ background: remiseOK ? 'rgba(245,158,11,.06)' : 'rgba(34,197,94,.08)', border: `1px solid ${remiseOK ? 'rgba(245,158,11,.3)' : 'rgba(34,197,94,.2)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          {remiseOK ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: .55, marginBottom: 4 }}><span>Sous-total</span><span>{totalInitial.toLocaleString('fr-FR')} FCFA</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4ade80', marginBottom: 6 }}><span>🎟️ Remise — {remiseOK.motif}</span><span>− {remiseOK.montant.toLocaleString('fr-FR')} FCFA</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 12, opacity: .5 }}>Total à encaisser</span><span style={{ fontSize: 26, fontWeight: 900, color: 'var(--warning)' }}>{total.toLocaleString('fr-FR')} FCFA</span></div>
              <button onClick={() => setRemiseOK(null)} style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'rgba(239,68,68,.6)', fontSize: 11, cursor: 'pointer', padding: 0 }}>✕ Annuler la remise</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--success)' }}>{total.toLocaleString('fr-FR')} FCFA</div>
              <div style={{ fontSize: 11, opacity: .4, marginTop: 2 }}>Montant à encaisser</div>
            </div>
          )}
        </div>

        {/* Bouton remise */}
        {!remiseOK && (
          <button onClick={() => setShowRemise(p => !p)} style={{ width: '100%', padding: '8px', borderRadius: 8, marginBottom: 14, cursor: 'pointer', background: showRemise ? 'rgba(245,158,11,.1)' : 'transparent', border: `1px dashed ${showRemise ? 'rgba(245,158,11,.5)' : 'rgba(201,151,60,.25)'}`, color: showRemise ? 'var(--warning)' : 'rgba(201,151,60,.55)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            🎟️ {showRemise ? 'Masquer la remise' : 'Appliquer une remise'}
          </button>
        )}

        {/* Panneau remise */}
        {showRemise && !remiseOK && (
          <div style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 12, fontWeight: 700 }}>🎟️ Remise manuelle</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(245,158,11,.3)', flexShrink: 0 }}>
                {[['montant','FCFA'],['pct','%']].map(([t, lbl]) => (
                  <button key={t} onClick={() => { setRemiseType(t); setRemiseValeur('') }} style={{ padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: remiseType === t ? 'rgba(245,158,11,.25)' : 'transparent', color: remiseType === t ? 'var(--warning)' : 'rgba(245,158,11,.5)', fontFamily: 'var(--font-dm)' }}>{lbl}</button>
                ))}
              </div>
              <input type="number" min="0" max={remiseType === 'pct' ? 100 : totalInitial} placeholder={remiseType === 'pct' ? 'ex: 10' : 'ex: 2000'} value={remiseValeur} onChange={e => setRemiseValeur(e.target.value)} style={{ ...sInp, flex: 1 }} />
            </div>
            {remisePreview > 0 && remisePreview < totalInitial && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10, padding: '8px 10px', background: 'rgba(245,158,11,.08)', borderRadius: 7 }}>
                <span style={{ opacity: .6 }}>Nouveau total :</span>
                <span style={{ fontWeight: 800, color: 'var(--warning)' }}>{totalPreview.toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, opacity: .4, marginBottom: 6 }}>MOTIF *</div>
              <select value={remiseMotif} onChange={e => setRemiseMotif(e.target.value)} style={{ ...sInp, width: '100%', marginBottom: remiseMotif === 'Autre' ? 8 : 0 }}>
                {MOTIFS_REMISE.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {remiseMotif === 'Autre' && <input placeholder="Précisez…" value={remiseMotifCustom} onChange={e => setRemiseMotifCustom(e.target.value)} style={{ ...sInp, width: '100%', marginTop: 6 }} />}
            </div>
            {remiseErr && <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 8 }}>⚠️ {remiseErr}</div>}
            <button onClick={appliquerRemise} disabled={remiseBusy || remisePreview <= 0 || remisePreview >= totalInitial} style={{ width: '100%', padding: '9px', borderRadius: 8, background: (remiseBusy || remisePreview <= 0) ? 'rgba(245,158,11,.15)' : 'linear-gradient(135deg,#d97706,#92400e)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: remiseBusy || remisePreview <= 0 ? 'default' : 'pointer' }}>
              {remiseBusy ? '⏳ Application…' : `✓ Appliquer − ${remisePreview > 0 ? remisePreview.toLocaleString('fr-FR') + ' FCFA' : '…'}`}
            </button>
          </div>
        )}

        {/* Toggle simple / mixte */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ id: false, label: 'Mode unique', color: 'var(--gold)', bg: 'var(--border-gold)' }, { id: true, label: '✂️ Paiement mixte', color: '#a78bfa', bg: 'rgba(139,92,246,.2)' }].map(opt => (
            <button key={String(opt.id)} onClick={() => { setMixte(opt.id); if (opt.id) setLignesPay([{ key: initMode, montant: '' }, { key: MODES_PAIEMENT.find(m => m.key !== initMode)?.key || 'mtn', montant: '' }]); else setLignesPay([{ key: mode, montant: String(total) }]) }} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: mixte === opt.id ? opt.bg : 'transparent', border: `1px solid ${mixte === opt.id ? opt.color : 'rgba(201,151,60,.25)'}`, color: mixte === opt.id ? opt.color : 'rgba(240,232,216,.5)' }}>{opt.label}</button>
          ))}
        </div>

        {/* Mode unique */}
        {!mixte && (
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .35, marginBottom: 10 }}>Mode de paiement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {MODES_PAIEMENT.map(m => (
                <button key={m.key} onClick={() => setMode(m.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: mode === m.key ? 'var(--border-gold)' : 'rgba(240,232,216,.03)', border: `1px solid ${mode === m.key ? 'var(--gold)' : 'var(--border-gold)'}`, color: mode === m.key ? 'var(--gold)' : 'rgba(240,232,216,.7)', textAlign: 'left', fontFamily: 'var(--font-dm)' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div><div style={{ fontSize: 10, opacity: .45 }}>{m.desc}</div></div>
                  {mode === m.key && <span style={{ fontSize: 16 }}>✓</span>}
                </button>
              ))}
            </div>
            {modeIncludesEsp && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .35, marginBottom: 8 }}>Montant remis par le client</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <input type="number" min={total} placeholder={`Min. ${total.toLocaleString('fr-FR')}`} value={montantRecu} onChange={e => setMontantRecu(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#1a1206', border: `1px solid ${!montantRecu || montantRecuValide ? 'rgba(201,151,60,.4)' : 'rgba(239,68,68,.5)'}`, color: 'var(--cream)', fontFamily: 'var(--font-dm)' }} />
                  <span style={{ fontSize: 11, opacity: .4, flexShrink: 0 }}>FCFA</span>
                </div>
                {montantRecu && !montantRecuValide && <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 8 }}>⚠️ Montant insuffisant (min. {total.toLocaleString('fr-FR')} FCFA)</div>}
                {renduMonnaie > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, marginBottom: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>💵 Rendu monnaie</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--warning)' }}>{renduMonnaie.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mode mixte */}
        {mixte && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .35, marginBottom: 12 }}>Ventilation du règlement</div>
            {lignesPay.map((ligne, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <select value={ligne.key} onChange={e => updateLigne(idx, 'key', e.target.value)} style={{ flex: 1.4, padding: '9px 10px', borderRadius: 8, fontSize: 12, background: '#1a1206', border: '1px solid rgba(201,151,60,.3)', color: 'var(--cream)', fontFamily: 'var(--font-dm)', cursor: 'pointer' }}>
                  {MODES_PAIEMENT.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <input type="number" min="0" max={total} placeholder="Montant" value={ligne.montant} onChange={e => updateLigne(idx, 'montant', e.target.value)} style={{ flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 12, background: '#1a1206', border: '1px solid rgba(201,151,60,.3)', color: 'var(--cream)', fontFamily: 'var(--font-dm)' }} />
                <span style={{ fontSize: 10, opacity: .4, flexShrink: 0 }}>FCFA</span>
                {lignesPay.length > 2 && <button onClick={() => supprimerLigne(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>✕</button>}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, marginBottom: 8, background: Math.abs(resteAPayer) < 1 ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${Math.abs(resteAPayer) < 1 ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.25)'}` }}>
              <span style={{ fontSize: 12, opacity: .7 }}>{resteAPayer > 0 ? 'Reste à ventiler' : resteAPayer < 0 ? '⚠️ Excédent' : '✅ Total équilibré'}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: Math.abs(resteAPayer) < 1 ? 'var(--success)' : resteAPayer > 0 ? 'var(--warning)' : 'var(--danger)' }}>{Math.abs(resteAPayer).toLocaleString('fr-FR')} FCFA</span>
            </div>
            {lignesPay.length < MODES_PAIEMENT.length && <button onClick={ajouterLigne} style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px dashed rgba(201,151,60,.3)', color: 'rgba(201,151,60,.6)', fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>+ Ajouter un mode</button>}
          </div>
        )}

        {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

        {/* ── Bloc vérification MoMo obligatoire ── */}
        {isMomo && !mixte && (
          <div style={{ background: momoVerifie ? 'rgba(34,197,94,.07)' : 'rgba(245,158,11,.06)', border: `1px solid ${momoVerifie ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.35)'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: momoVerifie ? 'var(--success)' : 'var(--warning)', marginBottom: 10 }}>
              {momoVerifie ? `✅ Paiement ${momoLabel} confirmé` : `📱 Vérification ${momoLabel} requise`}
            </div>
            {!momoVerifie && (
              <>
                <div style={{ fontSize: 12, opacity: .65, marginBottom: 10, lineHeight: 1.5 }}>
                  Avant de valider, confirmez que le transfert {momoLabel} de <strong style={{ color: 'var(--warning)' }}>{total.toLocaleString('fr-FR')} FCFA</strong> a bien été reçu sur le compte du restaurant.
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .4, marginBottom: 6 }}>Numéro expéditeur (client)</div>
                  <input
                    type="tel"
                    placeholder="Ex : +237 677 123 456"
                    value={momoNumero}
                    onChange={e => setMomoNumero(e.target.value)}
                    style={{ ...sInp, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ fontSize: 11, opacity: .5, marginBottom: 12, lineHeight: 1.5 }}>
                  ⚠️ Vérifiez sur votre téléphone ou l'application {momoLabel} que la transaction est bien confirmée avant de cocher.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={momoVerifie}
                    onChange={e => setMomoVerifie(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--success)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>
                    Je confirme avoir reçu le paiement {momoLabel}
                  </span>
                </label>
              </>
            )}
            {momoVerifie && momoNumero && (
              <div style={{ fontSize: 12, opacity: .65 }}>
                Numéro expéditeur : <strong>{momoNumero}</strong>
                <button onClick={() => setMomoVerifie(false)} style={{ marginLeft: 10, background: 'transparent', border: 'none', color: 'rgba(239,68,68,.6)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  ✕ Annuler
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(201,151,60,.2)', color: 'var(--cream-faint)', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
          <button onClick={confirmer} disabled={loading || (mixte && !mixteValide) || !montantRecuValide || (isMomo && !momoVerifie)} style={{ flex: 2, padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: (loading || (mixte && !mixteValide) || !montantRecuValide || (isMomo && !momoVerifie)) ? 'rgba(201,151,60,.2)' : 'linear-gradient(135deg,var(--gold),#a85f28)', color: '#fff', border: 'none', cursor: (loading || (mixte && !mixteValide) || !montantRecuValide || (isMomo && !momoVerifie)) ? 'default' : 'pointer' }}>
            {loading ? '⏳ En cours…' : '✅ Confirmer l\'encaissement'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Mode Caisse Directe ───────────────────────────────────────────────────────

export default EncaissementModal
