'use client'

import { useState } from 'react'

const PAIE_LABELS = {
  especes:          '💵 Espèces',
  livraison:        '🛵 Espèces à la livraison',
  mtn:              '📱 MTN MoMo',
  mtn_paye:         '📱 MTN MoMo ✅',
  orange:           '🟠 Orange Money',
  orange_paye:      '🟠 Orange Money ✅',
  cinetpay:         '📱 Mobile Money ✅',
  cinetpay_confirme:'📱 Mobile Money ✅',
  cinetpay_pending: '📱 Mobile Money ⏳',
  resto:            '🏠 Au restaurant',
}

function totalCommande(cmd) {
  if (!Array.isArray(cmd?.items)) return cmd?.total || 0
  return cmd.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
}

export default function FacturationPanel({ commandes }) {
  const [selectedId,  setSelectedId]  = useState(null)
  const [filtre,      setFiltre]      = useState('toutes')
  const [filtrePaym,  setFiltrePaym]  = useState('tous')
  const today = new Date().toLocaleDateString('fr-CA')

  const filtered = commandes
    .filter(c => {
      if (filtre === 'aujourd_hui') {
        const d = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-CA') : ''
        if (d !== today) return false
      }
      if (filtrePaym !== 'tous') {
        const paie = c.paiement || ''
        if (filtrePaym === 'especes'  && !['especes','livraison','resto'].includes(paie)) return false
        if (filtrePaym === 'momo'     && !['mtn','mtn_paye','orange','orange_paye','cinetpay','cinetpay_confirme'].includes(paie)) return false
      }
      return true
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const selected = filtered.find(c => c.id === selectedId) || filtered[0]

  // Résumé rapide
  const totalEspeces = filtered.filter(c => ['especes','livraison','resto'].includes(c.paiement)).reduce((s,c) => s+(c.total||0), 0)
  const totalMoMo    = filtered.filter(c => ['mtn','mtn_paye','orange','orange_paye','cinetpay','cinetpay_confirme'].includes(c.paiement)).reduce((s,c) => s+(c.total||0), 0)
  const totalAll     = filtered.reduce((s,c) => s+(c.total||0), 0)

  const handlePrint = () => {
    const cmd = selected
    const t   = totalCommande(cmd)
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Reçu ${cmd.id}</title>
      <style>
        body { font-family: monospace; max-width: 320px; margin: 0 auto; padding: 20px; font-size: 13px; }
        h2 { text-align: center; font-size: 16px; }
        .line { display: flex; justify-content: space-between; }
        .sep { border-top: 1px dashed #000; margin: 8px 0; }
        .total { font-weight: bold; font-size: 15px; }
        .center { text-align: center; }
      </style></head><body>
      <h2>⭐ CHEZ MAMAN BIYA ⭐</h2>
      <p class="center">Quartier Bastos, Yaoundé<br>Tel: +237 691 78 33 41</p>
      <div class="sep"></div>
      <div class="line"><span>Commande:</span><span>${cmd.id}</span></div>
      <div class="line"><span>Client:</span><span>${cmd.client || '-'}</span></div>
      <div class="line"><span>Tél:</span><span>${cmd.tel || '-'}</span></div>
      <div class="line"><span>Date:</span><span>${new Date(cmd.createdAt || Date.now()).toLocaleString('fr-FR')}</span></div>
      <div class="line"><span>Type:</span><span>${cmd.mode || 'Livraison'}</span></div>
      <div class="line"><span>Paiement:</span><span>${
        cmd.paiement === 'cinetpay'          ? '✅ Mobile Money (payé)' :
        cmd.paiement === 'cinetpay_confirme' ? '✅ Mobile Money (confirmé)' :
        cmd.paiement === 'cinetpay_pending'  ? '⏳ Mobile Money (en attente)' :
        (PAIE_LABELS[cmd.paiement] || cmd.paiement || '–')
      }</span></div>
      <div class="sep"></div>
      ${(Array.isArray(cmd.items) ? cmd.items : []).map(it => `
        <div class="line">
          <span>${it.qty || 1}× ${it.name}</span>
          <span>${((it.price || 0) * (it.qty || 1)).toLocaleString('fr-FR')} FCFA</span>
        </div>
      `).join('')}
      <div class="sep"></div>
      ${(() => {
        const frais    = cmd.fraisLivraison || 0
        const reduc    = cmd.reduction || 0
        const sousTotal = Array.isArray(cmd.items)
          ? cmd.items.reduce((s, it) => s + (it.price||0)*(it.qty||1), 0)
          : (cmd.total || t)
        if (frais === 0 && reduc === 0) return ''
        const livraisonLine = frais > 0 ? '<div class="line"><span>Livraison</span><span>+ ' + frais.toLocaleString('fr-FR') + ' FCFA</span></div>' : ''
        const reductionLine = reduc > 0 ? '<div class="line"><span>Réduction -10%</span><span>- ' + reduc.toLocaleString('fr-FR') + ' FCFA</span></div>' : ''
        return '<div class="line"><span>Sous-total</span><span>' + sousTotal.toLocaleString('fr-FR') + ' FCFA</span></div>' + livraisonLine + reductionLine + '<div class="sep"></div>'
      })()}
      <div class="line total"><span>TOTAL</span><span>${t.toLocaleString('fr-FR')} FCFA</span></div>
      <div class="sep"></div>
      <p class="center">Merci de votre confiance !<br>Bonne dégustation 🍽️</p>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Liste */}
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        {/* Résumé rapide */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total période', value: totalAll, color: 'var(--gold)' },
            { label: '💵 Espèces', value: totalEspeces, color: 'var(--success)' },
            { label: '📱 Mobile Money', value: totalMoMo, color: 'var(--warning)' },
          ].map(r => (
            <div key={r.label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,151,60,.1)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: r.color }}>{r.value.toLocaleString('fr-FR')}</div>
              <div style={{ fontSize: 10, opacity: .4, marginTop: 2 }}>{r.label} FCFA</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[{ id: 'toutes', label: 'Toutes' }, { id: 'aujourd_hui', label: "Aujourd'hui" }].map(f => (
            <button key={f.id} onClick={() => setFiltre(f.id)} style={{
              padding: '5px 14px', borderRadius: 20,
              border: `1px solid ${filtre === f.id ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`,
              background: filtre === f.id ? 'rgba(201,151,60,.1)' : 'transparent',
              color: filtre === f.id ? 'var(--gold)' : 'var(--cream-faint)',
              fontSize: 12, cursor: 'pointer',
            }}>{f.label}</button>
          ))}
        </div>
          <div style={{ width: 1, background: 'rgba(201,151,60,.15)', margin: '0 4px' }} />
          {[{ id: 'tous', label: 'Tous modes' }, { id: 'especes', label: '💵 Espèces' }, { id: 'momo', label: '📱 MoMo' }].map(f => (
            <button key={f.id} onClick={() => setFiltrePaym(f.id)} style={{
              padding: '5px 12px', borderRadius: 20,
              border: `1px solid ${filtrePaym === f.id ? 'var(--success)' : 'rgba(16,185,129,.15)'}`,
              background: filtrePaym === f.id ? 'rgba(16,185,129,.1)' : 'transparent',
              color: filtrePaym === f.id ? 'var(--success)' : 'rgba(245,239,230,.3)',
              fontSize: 11, cursor: 'pointer',
            }}>{f.label}</button>
          ))}

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', opacity: .3 }}>🧾 Aucune commande</div>
        ) : filtered.map(cmd => (
          <div key={cmd.id} onClick={() => setSelectedId(cmd.id)} style={{
            background: selected?.id === cmd.id ? 'rgba(201,151,60,0.07)' : 'rgba(255,255,255,0.025)',
            border: `1px solid ${selected?.id === cmd.id ? 'rgba(201,151,60,.5)' : 'rgba(201,151,60,0.12)'}`,
            borderRadius: 12, padding: '14px 18px', marginBottom: 10, cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>{cmd.id}</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{totalCommande(cmd).toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div style={{ fontSize: 12, opacity: .5, marginTop: 4 }}>
              {cmd.client || 'Anonyme'} · {cmd.tel || '-'} · {cmd.mode || 'Livraison'}
            </div>
          </div>
        ))}
      </div>

      {/* Aperçu reçu — FIX: mode paiement + date + frais détaillés */}
      {selected && <ApercuRecu cmd={selected} onPrint={handlePrint} paiLabels={PAIE_LABELS} totalFn={totalCommande} />}
    </div>
  )
}

// ── Aperçu reçu complet ───────────────────────────────────────────────────────
function ApercuRecu({ cmd, onPrint, paiLabels, totalFn }) {
  const sousTotal   = Array.isArray(cmd.items)
    ? cmd.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
    : (cmd.total || 0)
  const fraisLiv    = cmd.fraisLivraison || 0
  const reduction   = cmd.reduction || 0
  const totalFinal  = cmd.total || totalFn(cmd)
  const dateStr     = cmd.createdAt
    ? new Date(cmd.createdAt).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  // Libellé mode de paiement — FIX principal
  const paiLabel = cmd.paiement === 'cinetpay'
    ? '✅ Mobile Money (payé)'
    : cmd.paiement === 'cinetpay_confirme'
    ? '✅ Mobile Money (confirmé)'
    : cmd.paiement === 'cinetpay_pending'
    ? '⏳ Mobile Money (en attente)'
    : (paiLabels[cmd.paiement] || cmd.paiement || '—')

  const Row = ({ label, value, accent, muted }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
      <span style={{ opacity: muted ? .35 : .5 }}>{label}</span>
      <span style={{ color: accent ? 'var(--gold)' : undefined, fontWeight: accent ? 700 : 400 }}>{value}</span>
    </div>
  )

  return (
    <div style={{
      flex: '0 0 300px', minWidth: 280,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(201,151,60,.15)',
      borderRadius: 14, padding: 24,
      fontFamily: 'monospace', fontSize: 13,
    }}>
      {/* En-tête */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>⭐ CHEZ MAMAN BIYA ⭐</div>
        <div style={{ opacity: .4, fontSize: 11, marginTop: 3 }}>
          Quartier Bastos, Yaoundé<br />
          +237 691 78 33 41
        </div>
      </div>

      <div style={{ borderTop: '1px dashed rgba(255,255,255,.12)', margin: '10px 0' }} />

      {/* Infos commande */}
      <Row label="Commande" value={cmd.id} />
      <Row label="Date"     value={dateStr} />
      <Row label="Client"   value={cmd.client || '—'} />
      <Row label="Tél"      value={cmd.tel    || '—'} />
      <Row label="Mode"     value={cmd.mode   || 'Livraison'} />
      {cmd.addr && <Row label="Adresse" value={cmd.addr} />}

      {/* FIX: Mode de paiement affiché dans l'aperçu */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        margin: '6px 0 4px', fontSize: 12,
        background: 'rgba(201,151,60,.06)',
        border: '1px solid rgba(201,151,60,.15)',
        borderRadius: 5, padding: '5px 8px',
      }}>
        <span style={{ opacity: .55 }}>Paiement</span>
        <span style={{ fontWeight: 600, fontSize: 11 }}>{paiLabel}</span>
      </div>

      <div style={{ borderTop: '1px dashed rgba(255,255,255,.12)', margin: '12px 0' }} />

      {/* Articles */}
      {(Array.isArray(cmd.items) ? cmd.items : []).map((it, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ opacity: .7, maxWidth: '60%', wordBreak: 'break-word' }}>
            {it.qty || 1}× {it.name}
          </span>
          <span>{((it.price || 0) * (it.qty || 1)).toLocaleString('fr-FR')} FCFA</span>
        </div>
      ))}

      <div style={{ borderTop: '1px dashed rgba(255,255,255,.12)', margin: '10px 0' }} />

      {/* Détail des totaux */}
      {(fraisLiv > 0 || reduction > 0) && (
        <>
          <Row label="Sous-total" value={`${sousTotal.toLocaleString('fr-FR')} FCFA`} muted />
          {fraisLiv > 0 && (
            <Row label="Livraison" value={`+ ${fraisLiv.toLocaleString('fr-FR')} FCFA`} muted />
          )}
          {reduction > 0 && (
            <Row label="Réduction -10%" value={`− ${reduction.toLocaleString('fr-FR')} FCFA`} muted />
          )}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,.08)', margin: '6px 0' }} />
        </>
      )}

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
        <span>TOTAL</span>
        <span style={{ color: 'var(--gold)' }}>{totalFinal.toLocaleString('fr-FR')} FCFA</span>
      </div>

      <div style={{ borderTop: '1px dashed rgba(255,255,255,.12)', margin: '12px 0' }} />

      <div style={{ textAlign: 'center', opacity: .3, fontSize: 11, marginBottom: 14 }}>
        Merci de votre confiance !<br />Bonne dégustation 🍽️
      </div>

      <button
        onClick={onPrint}
        style={{
          width: '100%',
          background: 'rgba(201,151,60,0.12)',
          border: '1px solid rgba(201,151,60,.4)',
          color: 'var(--gold)', padding: '10px 0',
          borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        🖨️ Imprimer / PDF
      </button>
    </div>
  )
}
