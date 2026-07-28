'use client'
// components/Recu.jsx — Reçu imprimable · Chez Maman Biya
// Export 1 : imprimerRecu(params) → overlay DOM plein-écran + window.print()
// Export 2 : <Recu /> → bouton déclencheur à placer dans EcranConfirmation

import { useRestaurantConfig } from '@/hooks/useRestaurantConfig'
import { generateQRSVG }       from '@/lib/qrcode'

const PAIEMENTS_LABELS = {
  cinetpay:  'Mobile Money (MTN / Orange)',
  livraison: 'Espèces à la livraison',
  resto:     'Paiement au restaurant',
}

// ─────────────────────────────────────────────────────────────────
// imprimerRecu — fonction standalone sans React
// ─────────────────────────────────────────────────────────────────
export function imprimerRecu({ config, cmd, form, lignes = [], sousTotal = 0, fraisLiv = 0, reduction = 0, total = 0, qrUrl = null, numeroFacture = null }) {
  const date = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const logoHtml = config?.logo
    ? `<img src="${config.logo}" alt="${config?.nom || ''}" style="height:60px;max-width:190px;object-fit:contain;display:block;margin:0 auto 6px">`
    : `<div style="font-size:38px;margin-bottom:6px">🍲</div>`

  const lignesHtml = lignes.length
    ? lignes.map(l => `
        <tr>
          <td style="padding:3px 0;vertical-align:top">
            ${l.qte > 1 ? `<b>${l.qte}×</b> ` : ''}${l.plat?.name || l.name || '?'}
          </td>
          <td style="text-align:right;white-space:nowrap;padding:3px 0 3px 10px;vertical-align:top">
            ${((l.plat?.price || l.price || 0) * l.qte).toLocaleString('fr-FR')} F
          </td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="opacity:.4;padding:4px 0;font-style:italic">Détail non disponible</td></tr>`

  const totalFinal = total || cmd?.total || 0

  const receiptHtml = `
    <div style="max-width:300px;margin:0 auto;font-family:'Courier New',Courier,monospace;font-size:12px;color:#1a1a1a;line-height:1.6">
      <div style="text-align:center;margin-bottom:14px">
        ${logoHtml}
        <div style="font-weight:700;font-size:15px;letter-spacing:.5px">${config?.nom || 'Chez Maman Biya'}</div>
        ${config?.tagline ? `<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;opacity:.55;margin-top:2px">${config.tagline}</div>` : ''}
        ${config?.adresse ? `<div style="font-size:9px;opacity:.5;margin-top:3px">${config.adresse}</div>` : ''}
        ${config?.tel     ? `<div style="font-size:9px;opacity:.5">📞 ${config.tel}</div>` : ''}
      </div>

      <hr style="border:none;border-top:1px solid #1a1a1a;margin:10px 0">

      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:9px;opacity:.45;text-transform:uppercase;letter-spacing:1.5px">REÇU DE COMMANDE</div>
        <div style="font-size:16px;font-weight:700;letter-spacing:1px;margin:3px 0">
          ${numeroFacture || cmd?.numeroFacture || ('N° ' + (cmd?.id || '—'))}
        </div>
        <div style="font-size:9px;opacity:.45">${date}</div>
      </div>

      <hr style="border:none;border-top:1px dashed #bbb;margin:10px 0">

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <tr><td style="opacity:.5;padding:2px 0">Client</td>    <td style="text-align:right;font-weight:600">${form?.client || '—'}</td></tr>
        <tr><td style="opacity:.5;padding:2px 0">Téléphone</td> <td style="text-align:right">${form?.tel || '—'}</td></tr>
        <tr><td style="opacity:.5;padding:2px 0">Mode</td>      <td style="text-align:right">${cmd?.mode || '—'}</td></tr>
        ${(cmd?.addr || form?.addr) ? `<tr><td style="opacity:.5;padding:2px 0;vertical-align:top">Adresse</td><td style="text-align:right">${cmd?.addr || form?.addr}</td></tr>` : ''}
      </table>

      <hr style="border:none;border-top:1px dashed #bbb;margin:10px 0">

      <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;opacity:.45;margin-bottom:8px">ARTICLES COMMANDÉS</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">${lignesHtml}</table>

      <hr style="border:none;border-top:1px dashed #bbb;margin:10px 0">

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <tr><td style="opacity:.5;padding:2px 0">Sous-total</td><td style="text-align:right">${sousTotal.toLocaleString('fr-FR')} FCFA</td></tr>
        ${fraisLiv > 0
          ? `<tr><td style="opacity:.5;padding:2px 0">Livraison</td><td style="text-align:right">+${fraisLiv.toLocaleString('fr-FR')} FCFA</td></tr>`
          : form?.mode === 'livraison' || (cmd?.mode || '').toLowerCase().includes('livraison')
            ? `<tr><td style="opacity:.5;padding:2px 0">Livraison</td><td style="text-align:right;color:#16a34a">GRATUITE</td></tr>`
            : ''}
        ${reduction > 0 ? `<tr style="color:#16a34a"><td style="padding:2px 0">Réduction −10%</td><td style="text-align:right">−${reduction.toLocaleString('fr-FR')} FCFA</td></tr>` : ''}
      </table>

      <hr style="border:none;border-top:1px solid #1a1a1a;margin:10px 0">

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <tr>
          <td style="font-weight:700;font-size:14px">TOTAL</td>
          <td style="text-align:right;font-weight:700;font-size:14px">${totalFinal.toLocaleString('fr-FR')} FCFA</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <tr><td style="opacity:.5;padding:2px 0">Paiement</td><td style="text-align:right">${PAIEMENTS_LABELS[form?.paiement] || form?.paiement || '—'}</td></tr>
      </table>

      ${form?.note ? `<div style="margin-bottom:12px"><div style="font-size:9px;opacity:.45;margin-bottom:3px">NOTE</div><div style="font-style:italic;opacity:.7">${form.note}</div></div>` : ''}

      <hr style="border:none;border-top:1px dashed #bbb;margin:10px 0">

      ${(qrUrl || cmd?.qrUrl) ? (() => {
        // QR code généré localement — aucune dépendance réseau, fonctionne hors-ligne
        const qrSVG = generateQRSVG(qrUrl || cmd?.qrUrl, { size: 220, fg: '#1a1a1a', bg: '#ffffff' })
        return `
      <div style="text-align:center;margin:12px 0 4px">
        <div style="font-size:9px;opacity:.45;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">
          VÉRIFIER CETTE FACTURE
        </div>
        <div style="width:228px;height:228px;display:block;margin:0 auto;border:2px solid #eee;border-radius:6px;padding:4px;background:#fff;box-sizing:border-box">
          ${qrSVG}
        </div>
        <div style="font-size:8px;opacity:.35;margin-top:6px;max-width:220px;margin-left:auto;margin-right:auto;line-height:1.4">
          Scannez avec votre téléphone pour vérifier l'authenticité
        </div>
      </div>
      <hr style="border:none;border-top:1px dashed #bbb;margin:10px 0">
        `
      })() : ''}

      <div style="text-align:center;padding-top:8px">
        <div style="font-size:20px">🙏</div>
        <div style="font-weight:700;font-size:13px;margin-top:4px">Merci pour votre commande !</div>
        <div style="font-size:9px;opacity:.4;margin-top:5px;line-height:1.7">
          Ce document fait foi de votre achat.<br>Conservez-le pour tout échange ou réclamation.
        </div>
        ${config?.whatsapp ? `<div style="font-size:9px;opacity:.4;margin-top:4px">WhatsApp : ${config.whatsapp}</div>` : ''}
      </div>
    </div>
  `

  // Nettoyage éventuel d'un overlay précédent
  document.getElementById('cmb-recu-overlay')?.remove()
  document.getElementById('cmb-recu-print-style')?.remove()

  // CSS @media print : masque tout sauf l'overlay
  const style = document.createElement('style')
  style.id = 'cmb-recu-print-style'
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #cmb-recu-overlay, #cmb-recu-overlay * { visibility: visible !important; }
      #cmb-recu-overlay { position: fixed !important; inset: 0 !important; padding: 0 !important; overflow: visible !important; }
      .cmb-recu-actions { display: none !important; }
      @page { margin: 10mm; size: 80mm auto; }
    }
  `
  document.head.appendChild(style)

  const overlay = document.createElement('div')
  overlay.id = 'cmb-recu-overlay'
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999', 'background:#fff',
    'overflow:auto', 'padding:20px 16px 40px',
    'font-family:"Courier New",Courier,monospace', 'font-size:12px', 'color:#1a1a1a',
  ].join(';')

  const cleanup = () => {
    document.getElementById('cmb-recu-overlay')?.remove()
    document.getElementById('cmb-recu-print-style')?.remove()
    window.removeEventListener('afterprint', cleanup)
  }

  overlay.innerHTML = `
    <div class="cmb-recu-actions" style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-bottom:20px;max-width:300px;margin-left:auto;margin-right:auto;">
      <button onclick="document.getElementById('cmb-recu-overlay').remove();document.getElementById('cmb-recu-print-style').remove()"
        style="background:none;border:1px solid #ddd;border-radius:7px;padding:7px 16px;cursor:pointer;font-size:12px;color:#555;font-family:inherit">
        ✕ Fermer
      </button>
      <button onclick="window.print()"
        style="background:#1a1a1a;color:#fff;border:none;border-radius:7px;padding:7px 18px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">
        🖨️ Imprimer / PDF
      </button>
    </div>
    ${receiptHtml}
  `

  document.body.appendChild(overlay)
  window.addEventListener('afterprint', cleanup)
}

// ─────────────────────────────────────────────────────────────────
// <Recu /> — Bouton React pour EcranConfirmation
// ─────────────────────────────────────────────────────────────────
export default function Recu({ cmd, form, lignes = [], sousTotal = 0, fraisLiv = 0, reduction = 0, total = 0, qrUrl = null, numeroFacture = null }) {
  const { config, loaded } = useRestaurantConfig()
  if (!loaded) return null

  return (
    <button
      onClick={() => imprimerRecu({ config, cmd, form, lignes, sousTotal, fraisLiv, reduction, total, qrUrl: qrUrl || cmd?.qrUrl, numeroFacture: numeroFacture || cmd?.numeroFacture })}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%',
        background: 'rgba(240,232,216,.05)',
        border: '1px solid rgba(240,232,216,.15)',
        borderRadius: 8, padding: '11px 16px',
        color: 'rgba(240,232,216,.5)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: .5,
        transition: 'background .2s, color .2s, border-color .2s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(240,232,216,.10)'
        e.currentTarget.style.color = 'rgba(240,232,216,.8)'
        e.currentTarget.style.borderColor = 'rgba(240,232,216,.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(240,232,216,.05)'
        e.currentTarget.style.color = 'rgba(240,232,216,.5)'
        e.currentTarget.style.borderColor = 'rgba(240,232,216,.15)'
      }}
    >
      🖨️ Imprimer le reçu
    </button>
  )
}
