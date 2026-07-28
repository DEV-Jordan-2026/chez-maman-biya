'use client'
import { useState } from 'react'
import { totalCommande } from '@/components/caisse/constants'

function ClotureTab({ sessionCaisse, commandes, caissier, onSessionChange }) {
  const [fondOuverture, setFondOuverture] = useState('')
  const [ouvertPar,     setOuvertPar]     = useState(caissier || '')
  const [busy,          setBusy]          = useState(false)
  const [msg,           setMsg]           = useState({ type: '', text: '' })
  // M3 — Modal résumé avant clôture
  const [previewCloture, setPreviewCloture] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const todayStr   = new Date().toLocaleDateString('fr-CA')
  const encaisses  = commandes.filter(c => c.status === 'livre')
  const caJour     = encaisses.filter(c => {
    const d = c.updatedAt || c.createdAt
    return d ? new Date(d).toLocaleDateString('fr-CA') === todayStr : false
  })
  // C6 — Utiliser totalCommande() pour gérer les commandes sans c.total (calculé depuis items[])
  const totalJour  = caJour.reduce((s, c) => s + totalCommande(c), 0)
  const nbTrans    = caJour.length

  async function ouvrirSession() {
    if (!fondOuverture) { setMsg({ type: 'err', text: 'Saisissez le fond de caisse' }); return }
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      const res  = await fetch('/api/caisse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fondCaisse: parseInt(fondOuverture), ouvertPar: ouvertPar || caissier }) })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error || 'Erreur' }); setBusy(false); return }
      onSessionChange(data)
      setMsg({ type: 'ok', text: '✅ Session caisse ouverte !' })
    } catch { setMsg({ type: 'err', text: 'Erreur réseau' }) }
    setBusy(false)
  }

  // M3 — Étape 1 : charger le preview avant de clôturer
  async function demanderCloture() {
    if (!sessionCaisse) return
    setBusy(true)
    try {
      const r = await fetch(`/api/caisse?mode=preview&sessionId=${sessionCaisse.id}`)
      const data = await r.json()
      if (!r.ok) { setMsg({ type: 'err', text: data.error || 'Erreur' }); setBusy(false); return }
      setPreviewCloture(data)
      setShowPreviewModal(true)
    } catch { setMsg({ type: 'err', text: 'Erreur réseau' }) }
    setBusy(false)
  }

  // M3 — Étape 2 : clôture effective après confirmation dans la modal
  async function cloturerSession() {
    if (!sessionCaisse) return
    setShowPreviewModal(false)
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      const res  = await fetch(`/api/caisse`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cloturer', sessionId: sessionCaisse.id }) })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error || 'Erreur' }); setBusy(false); return }
      onSessionChange(null)
      setMsg({ type: 'ok', text: '🔒 Session clôturée. Rapport Z généré.' })
    } catch { setMsg({ type: 'err', text: 'Erreur réseau' }) }
    setBusy(false)
  }

  const inp = { background: 'rgba(240,232,216,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: 'var(--cream)', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ maxWidth: 500 }}>
      {msg.text && (
        <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`, borderRadius: 10, padding: '12px 16px', color: msg.type === 'err' ? 'var(--danger)' : 'var(--success)', fontSize: 13, marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* Résumé journée */}
      <div style={{ background: 'rgba(201,151,60,.04)', border: '1px solid rgba(201,151,60,.15)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .35, marginBottom: 12 }}>Résumé du jour</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'CA encaissé', val: `${totalJour.toLocaleString('fr-FR')} FCFA`, color: 'var(--success)' },
            { label: 'Transactions', val: nbTrans, color: 'var(--info)' },
            { label: 'Fond d\'ouverture', val: sessionCaisse ? `${(sessionCaisse.fondOuverture || 0).toLocaleString('fr-FR')} FCFA` : '—', color: 'var(--warning)' },
            { label: 'Session', val: sessionCaisse ? `#${String(sessionCaisse.id).slice(-6).toUpperCase()}` : 'Fermée', color: sessionCaisse ? 'var(--gold)' : 'var(--danger)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 9, padding: '12px' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, opacity: .4, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {sessionCaisse && (
          <div style={{ fontSize: 11, opacity: .4, marginTop: 12, textAlign: 'right' }}>
            Ouverte le {new Date(sessionCaisse.ouverture).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} par {sessionCaisse.ouvertPar}
          </div>
        )}
      </div>

      {/* Action : ouvrir ou clôturer */}
      {!sessionCaisse ? (
        <div style={{ background: 'rgba(34,197,94,.04)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12, padding: '18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>🔓 Ouvrir une session caisse</div>

          {/* Explication du fond de caisse */}
          <div style={{ background: 'rgba(201,151,60,.06)', border: '1px solid rgba(201,151,60,.18)', borderRadius: 9, padding: '10px 13px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>📋 Procédure d'ouverture</div>
            <div style={{ fontSize: 11, opacity: .7, lineHeight: 1.7 }}>
              1. Le <strong>manager ou responsable de quart</strong> compte physiquement le fond de caisse (billets + monnaie) et en valide le montant.<br />
              2. Le caissier saisit ici le montant compté, puis valide l'ouverture.<br />
              3. Ce fond sera déduit à la clôture pour calculer le solde espèces réel.
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, letterSpacing: 1.5, opacity: .35, display: 'block', marginBottom: 6 }}>FOND DE CAISSE (FCFA) *</label>
            <input type="number" min="0" placeholder="ex: 50000" value={fondOuverture} onChange={e => setFondOuverture(e.target.value)} style={inp} />
            {fondOuverture && (
              <div style={{ fontSize: 11, opacity: .55, marginTop: 5, color: 'var(--warning)' }}>
                💡 Ce montant doit être validé avec le manager avant ouverture.
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, letterSpacing: 1.5, opacity: .35, display: 'block', marginBottom: 6 }}>CAISSIER</label>
            <input placeholder={caissier || 'Nom du caissier'} value={ouvertPar} onChange={e => setOuvertPar(e.target.value)} style={inp} />
          </div>
          <button onClick={ouvrirSession} disabled={busy} style={{ width: '100%', padding: '12px', borderRadius: 9, background: busy ? 'rgba(34,197,94,.2)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? '⏳ Ouverture…' : '🔓 Ouvrir la caisse'}
          </button>
        </div>
      ) : (
        <div style={{ background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: '18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 10 }}>🔒 Clôturer la session</div>

          {/* Solde théorique disponible */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, opacity: .45, marginBottom: 3 }}>Espèces encaissées</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>{totalJour.toLocaleString('fr-FR')} FCFA</div>
            </div>
            <div style={{ background: 'rgba(201,151,60,.06)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, opacity: .45, marginBottom: 3 }}>Fond d'ouverture</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{(sessionCaisse?.fondOuverture || 0).toLocaleString('fr-FR')} FCFA</div>
            </div>
          </div>

          <p style={{ fontSize: 12, opacity: .5, lineHeight: 1.6, marginBottom: 16 }}>
            La clôture arrête la session, génère le rapport Z et verrouille les encaissements jusqu'à la prochaine ouverture.
          </p>
          <div style={{ background: 'rgba(201,151,60,.06)', border: '1px solid rgba(201,151,60,.15)', borderRadius: 9, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Solde espèces à remettre</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)' }}>{(totalJour + (sessionCaisse?.fondOuverture || 0)).toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div style={{ fontSize: 11, opacity: .5, marginBottom: 16, lineHeight: 1.6 }}>
            ⚠️ Ce solde doit être compté et remis au <strong>manager</strong> en présence du caissier. Le manager valide la clôture depuis son dashboard.
          </div>
          <button onClick={demanderCloture} disabled={busy} style={{ width: '100%', padding: '12px', borderRadius: 9, background: busy ? 'rgba(239,68,68,.2)' : 'linear-gradient(135deg,#ef4444,#b91c1c)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? '⏳ Chargement du résumé…' : '🔒 Clôturer et générer le rapport Z'}
          </button>

          {/* M3 — Modal résumé de clôture (dark gold/ambre) */}
          {showPreviewModal && previewCloture && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ background: '#141417', border: '1px solid rgba(201,151,60,.35)', borderRadius: 16, padding: '28px 24px', maxWidth: 380, width: '100%' }}>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--warning)', opacity: .7, marginBottom: 14 }}>Résumé avant clôture</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {[
                    ['💵 Espèces',        `${(previewCloture.especes     || 0).toLocaleString('fr-FR')} FCFA`],
                    ['📱 Mobile Money',   `${(previewCloture.momo        || 0).toLocaleString('fr-FR')} FCFA`],
                    ['🏠 Resto / Tab',    `${(previewCloture.resto       || 0).toLocaleString('fr-FR')} FCFA`],
                    ['🛵 Livraison',      `${(previewCloture.livraison   || 0).toLocaleString('fr-FR')} FCFA`],
                    ['📦 Total recettes', `${(previewCloture.totalRecettes || 0).toLocaleString('fr-FR')} FCFA`],
                    ['🏦 Fond de caisse', `${(previewCloture.fondCaisse  || 0).toLocaleString('fr-FR')} FCFA`],
                    ['✅ Solde théorique',`${(previewCloture.totalTheorique || 0).toLocaleString('fr-FR')} FCFA`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(201,151,60,.1)' }}>
                      <span style={{ opacity: .7 }}>{label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowPreviewModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(201,151,60,.3)', color: 'var(--cream-faint)', fontSize: 13, cursor: 'pointer' }}>
                    Annuler
                  </button>
                  <button onClick={cloturerSession} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Confirmer la clôture
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ClotureTab
