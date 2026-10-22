'use client'
import { useState } from 'react'
import { PAIEMENT_LABELS, parsePaiement, buildReceiptHTML } from '@/components/caisse/constants'

function FacturationTab({ commandes, selectedId, onSelect, bannerHeight = 0, sessionCaisse, caissier, parametres, branding }) {
  const today = new Date().toLocaleDateString('fr-CA')
  const [filtre, setFiltre] = useState("aujourd'hui")
  const [filtrePaym, setFiltrePaym] = useState('tous')

  const filtered = commandes
    .filter(c => {
      if (filtre === "aujourd'hui") {
        const dateRef = c.updatedAt || c.createdAt
        const d = dateRef ? new Date(dateRef).toLocaleDateString('fr-CA') : ''
        if (d !== today) return false
      }
      // A2 — Filtre session en cours : uniquement les commandes depuis l'ouverture de la session
      if (filtre === 'session' && sessionCaisse) {
        const debut  = new Date(sessionCaisse.ouvertureAt)
        const dateRef = new Date(c.updatedAt || c.createdAt)
        if (dateRef < debut) return false
      }
      if (filtrePaym !== 'tous') {
        const p = c.paiement || ''
        if (filtrePaym === 'especes' && !['especes','livraison','resto'].includes(p)) return false
        if (filtrePaym === 'momo'    && !['mtn','mtn_paye','orange','orange_paye','cinetpay','cinetpay_confirme'].includes(p)) return false
      }
      return true
    })
    .sort((a, b) => {
      const da = b.updatedAt || b.createdAt || ''
      const db = a.updatedAt || a.createdAt || ''
      return da.localeCompare(db)
    })

  const selected = filtered.find(c => c.id === selectedId) || filtered[0]
  const total = selected ? (Array.isArray(selected.items)
    ? selected.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
    : selected.total || 0) : 0

  // Résumé rapide
  // Fix Bug — calcul correct pour paiements mixtes (array) et simples
  function montantParMode(commande, modes) {
    const p = commande.paiement
    if (Array.isArray(p)) return p.filter(l => modes.includes(l.mode)).reduce((s, l) => s + (l.montant || 0), 0)
    return modes.includes(p) ? (commande.total || 0) : 0
  }
  const totalEspeces = filtered.reduce((s, c) => s + montantParMode(c, ['especes','livraison','resto']), 0)
  const totalMoMo    = filtered.reduce((s, c) => s + montantParMode(c, ['mtn','mtn_paye','orange','orange_paye','cinetpay','cinetpay_confirme']), 0)
  const totalAll     = filtered.reduce((s,c) => s+(c.total||0), 0)

  function imprimer() {
    if (!selected) return
    const win = window.open('', '_blank', 'width=400,height=680')
    if (!win) { alert('Autorisez les popups pour imprimer le reçu.'); return }
    const t = Array.isArray(selected.items)
      ? selected.items.reduce((s, it) => s + (it.price||0)*(it.qty||1), 0)
      : selected.total || 0
    const dateStr = new Date(selected.updatedAt || selected.createdAt || Date.now())
      .toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    win.document.write(buildReceiptHTML({
      id: selected.id,
      client: selected.client,
      tel: selected.tel,
      mode: selected.mode || 'Sur place',
      paiement: (() => {
        const p = parsePaiement(selected.paiement)
        if (Array.isArray(p)) return p
        return PAIEMENT_LABELS[selected.paiement] || selected.paiement || '-'
      })(),
      dateStr,
      items: Array.isArray(selected.items) ? selected.items : [],
      sousTotal: t,
      reduction: 0,
      total: selected.total || t,
      caissier: caissier || sessionCaisse?.ouvertPar,
      sessionId: sessionCaisse?.id,
      note: selected.note,
      // Bug 1 — numéro de facture stocké sur la commande
      numeroFacture: selected.numeroFacture || null,
      // Bug 2 — logo depuis branding
      logo: branding?.logo || null,
      // Bug 3 — URL QR : reconstruire depuis qrHash si disponible, sinon fallback id
      qrUrl: selected.qrHash
        ? `${window.location.origin}/facture/${selected.id}?h=${selected.qrHash}`
        : null,
      restaurantNom: parametres?.nom || 'CHEZ MAMAN BIYA',
      restaurantAdresse: parametres?.adresse || 'Yaoundé, Cameroun',
      restaurantTel: parametres?.telephone || '+237 691 78 33 41',
    }))
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div className="caisse-split-narrow">

      {/* Liste */}
      <div>
        {/* Résumé rapide */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Total',          value: totalAll,     color: 'var(--gold)' },
            { label: '💵 Espèces',    value: totalEspeces, color: 'var(--success)' },
            { label: '📱 Mobile Money',value: totalMoMo,   color: 'var(--warning)' },
          ].map(r => (
            <div key={r.label} style={{ background: 'rgba(240,232,216,.03)', border: '1px solid var(--border-gold)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: r.color }}>{r.value.toLocaleString('fr-FR')}</div>
              <div style={{ fontSize: 10, opacity: .4, marginTop: 2 }}>{r.label} FCFA</div>
            </div>
          ))}
        </div>

        {/* Filtres période + mode paiement */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {[["aujourd'hui", "Aujourd'hui"], ['session', '🔓 Session'], ['toutes', 'Toutes']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltre(val)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${filtre === val ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`,
              background: filtre === val ? 'var(--border-gold)' : 'transparent',
              color: filtre === val ? 'var(--gold)' : 'var(--cream-faint)',
            }}>{label}</button>
          ))}
          <div style={{ width: 1, background: 'var(--border-gold)', height: 20, flexShrink: 0 }} />
          {[['tous','Tous'], ['especes','💵 Espèces'], ['momo','📱 MoMo']].map(([val, label]) => (
            <button key={val} onClick={() => setFiltrePaym(val)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${filtrePaym === val ? 'var(--success)' : 'rgba(34,197,94,.15)'}`,
              background: filtrePaym === val ? 'rgba(34,197,94,.1)' : 'transparent',
              color: filtrePaym === val ? 'var(--success)' : 'var(--cream-faint)',
            }}>{label}</button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11, opacity: .4 }}>
            {filtered.length} commande{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', opacity: .3 }}>🧾 Aucune commande</div>
        ) : filtered.map(cmd => {
          const t   = Array.isArray(cmd.items) ? cmd.items.reduce((s,it)=>s+(it.price||0)*(it.qty||1),0) : cmd.total||0
          const sel = selected?.id === cmd.id
          const rawPay = cmd.paiement
          const estMixte = Array.isArray(rawPay)
          const estPaye = estMixte || rawPay?.includes('paye') || ['cinetpay','cinetpay_confirme'].includes(rawPay)
          const enAttente = cmd.paiement === 'cinetpay_pending'
          return (
            <div key={cmd.id} onClick={() => onSelect(cmd.id)} style={{
              background: sel ? 'rgba(201,151,60,.07)' : 'var(--ebony-2)',
              border: `1px solid ${sel ? 'rgba(201,151,60,.5)' : 'var(--border-gold)'}`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
              transition: 'all .15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 12 }}>{cmd.id}</span>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{t.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ fontSize: 11, opacity: .5 }}>
                {cmd.mode || 'Sur place'}
                {(cmd.mode === 'livraison' || cmd.mode === 'emporter') && cmd.client
                  ? ` · ${cmd.client}` : ''} ·{' '}
                <span style={{ color: estPaye ? 'var(--success)' : enAttente ? 'var(--warning)' : 'inherit' }}>
                  {Array.isArray(cmd.paiement) ? '✂️ Mixte' : (PAIEMENT_LABELS[cmd.paiement] || cmd.paiement)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Aperçu reçu — sticky sous header+tabs+banner */}
      <div className="caisse-sticky-panel" style={{ top: bannerHeight + 60 + 44 }}>
        {selected ? (
          <div style={{ background: 'rgba(240,232,216,.03)', border: '1px solid rgba(201,151,60,.15)', borderRadius: 14, padding: '20px 18px', fontFamily: 'monospace', fontSize: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>★ CHEZ MAMAN BIYA ★</div>
              <div style={{ opacity: .35, fontSize: 10, marginTop: 4 }}>Bastos, Yaoundé · +237 691 78 33 41</div>
            </div>
            <div style={{ borderTop: '1px dashed rgba(255,255,255,.15)', margin: '10px 0' }} />
            {[
              ['Réf',      selected.id],
              ['Mode',     selected.mode   || 'Sur place'],
              ...(selected.mode === 'livraison' || selected.mode === 'emporter'
                ? [['Client', selected.client || '-']]
                : []),
              ...(Array.isArray(selected.paiement)
                ? selected.paiement.map(p => [p.label || p.mode, `${p.montant.toLocaleString('fr-FR')} FCFA`])
                : [['Règlement', PAIEMENT_LABELS[selected.paiement] || selected.paiement || '-']]),
              ['Date',     selected.updatedAt || selected.createdAt
                ? new Date(selected.updatedAt || selected.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
                : '-'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ opacity: .4 }}>{k}</span>
                <span style={{ textAlign: 'right', maxWidth: '55%', wordBreak: 'break-all', fontSize: 11 }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed rgba(255,255,255,.15)', margin: '10px 0' }} />
            {(Array.isArray(selected.items) ? selected.items : []).map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ opacity: .65 }}>{it.qty || 1}× {it.name}</span>
                <span>{((it.price||0)*(it.qty||1)).toLocaleString('fr-FR')} F</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed rgba(255,255,255,.15)', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14 }}>
              <span>TOTAL</span>
              <span style={{ color: 'var(--gold)' }}>{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <button onClick={imprimer} style={{ marginTop: 16, width: '100%', background: 'var(--border-gold)', border: '1px solid rgba(201,151,60,.4)', color: 'var(--gold)', padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🖨️ Imprimer le reçu
            </button>
          </div>
        ) : (
          <div style={{ background: 'rgba(240,232,216,.025)', border: '1px dashed rgba(201,151,60,.15)', borderRadius: 14, padding: '40px 20px', textAlign: 'center', opacity: .3, fontSize: 13 }}>
            Sélectionnez une commande pour voir le reçu
          </div>
        )}
      </div>
    </div>
  )
}

export default FacturationTab
