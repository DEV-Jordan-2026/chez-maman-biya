// components/caisse/constants.js
// Constantes et helpers partagés entre les onglets caisse
// Extraits verbatim depuis CaissierClient.js
import { generateQRSVG } from '@/lib/qrcode'

// miniInput : style objet JSX inline pour les champs de saisie de la caisse.
// Défini à la ligne 1363 du source (APRÈS CaisseDirecteTab qui l'utilise) —
// placé EN TÊTE DE MODULE pour qu'aucun extracteur ne manque l'import.
export const miniInput = { background: 'rgba(240,232,216,.04)', border: '1px solid rgba(201,151,60,.18)', borderRadius: 7, color: 'var(--cream)', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', width: '100%' }

export const STATUS = {
  nouveau        : { label: 'À valider',        color: 'var(--info)', bg: 'rgba(59,130,246,.12)',  emoji: '📋' },
  en_cours       : { label: 'En cuisine',        color: 'var(--warning)', bg: 'rgba(245,158,11,.12)',  emoji: '👨‍🍳' },
  en_preparation : { label: 'En préparation',    color: '#8B5CF6', bg: 'rgba(139,92,246,.12)',  emoji: '🍳' },
  pret           : { label: 'Prêt — à encaisser',color: 'var(--success)', bg: 'rgba(34,197,94,.12)', emoji: '✅' },
  en_livraison   : { label: 'En livraison',      color: 'var(--success)', bg: 'rgba(34,197,94,.08)',  emoji: '🛵' },
  livre          : { label: 'Encaissé',          color: '#6B7280', bg: 'rgba(107,114,128,.1)',  emoji: '💳' },
}

export const PAIEMENT_LABELS = {
  mtn              : 'MTN MoMo',
  mtn_paye         : '✅ MTN MoMo (payé)',
  orange           : 'Orange Money',
  orange_paye      : '✅ Orange Money (payé)',
  cinetpay         : '✅ Mobile Money (payé)',
  cinetpay_pending : '⏳ Mobile Money (en attente)',
  cinetpay_confirme: '✅ Mobile Money (confirmé)',
  especes          : 'Espèces',
  livraison        : 'Espèces à la livraison',
  resto            : 'Au restaurant',
}

// MODES_PAIEMENT : utilisé par EncaissementModal et CaisseDirecteTab
// (absent de la table de dépendances du prompt — ajout issu de l'audit)
export const MODES_PAIEMENT = [
  { key: 'especes',   label: '💵 Espèces',          desc: 'Paiement en main propre' },
  { key: 'mtn',       label: '📱 MTN MoMo',          desc: 'Mobile Money MTN' },
  { key: 'orange',    label: '🟠 Orange Money',      desc: 'Mobile Money Orange' },
  { key: 'resto',     label: '🍽️ Au restaurant',    desc: 'Règlement sur place' },
  { key: 'livraison', label: '🛵 Espèces livraison', desc: 'Cash à la livraison' },
]

export function parsePaiement(raw) {
  if (!raw) return raw
  if (Array.isArray(raw)) return raw
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch (_) {}
  return raw
}

export function buildReceiptHTML({ id, client, tel, mode, paiement, dateStr, items,
  sousTotal, reduction, remise = 0, remiseMotif = '', total, caissier, sessionId,
  note, renduMonnaie = 0, restaurantNom = 'CHEZ MAMAN BIYA',
  restaurantAdresse = 'Quartier Bastos, Yaoundé, Cameroun',
  restaurantTel = '+237 691 78 33 41', tableNumero = null, numeroFacture = null,
  logo = null, qrUrl = null }) {
  const lignesHTML = items.map(it =>
    `<div class="r"><span>${it.qty||1}× ${it.name}</span><span>${((it.price||0)*(it.qty||1)).toLocaleString('fr-FR')} FCFA</span></div>`
  ).join('')

  // Bug 2 — Logo base64 depuis /api/parametres/branding
  const logoHTML = logo
    ? `<div class="logo-img"><img src="${logo}" alt="Logo" style="max-height:60px;max-width:160px;object-fit:contain;margin-bottom:4px"></div>`
    : ''

  // Bug 3 — QR Code inline généré depuis lib/qrcode.js (synchrone, pas de dépendance externe)
  const qrTarget = qrUrl || `CMB:${id}`
  const qrSVG    = (() => {
    try { return generateQRSVG(qrTarget, { size: 200, fg: '#111111', bg: '#ffffff', quiet: 3 }) }
    catch (_) { return '' }
  })()
  const qrHTML = qrSVG
    ? `<div class="qr-block"><div class="qr-svg">${qrSVG}</div><div class="qr-label">Vérifier la facture</div></div>`
    : ''
  const reductionHTML = reduction > 0
    ? `<div class="r muted"><span>Sous-total</span><span>${sousTotal.toLocaleString('fr-FR')} FCFA</span></div>
       <div class="r green"><span>Réduction -10%</span><span>- ${reduction.toLocaleString('fr-FR')} FCFA</span></div>`
    : ''
  const remiseHTML = remise > 0
    ? `${reduction === 0 ? `<div class="r muted"><span>Sous-total</span><span>${sousTotal.toLocaleString('fr-FR')} FCFA</span></div>` : ''}
       <div class="r green"><span>🎟️ Remise${remiseMotif ? ' — ' + remiseMotif : ''}</span><span>- ${remise.toLocaleString('fr-FR')} FCFA</span></div>`
    : ''
  const paiementsHTML = Array.isArray(paiement)
    ? paiement.map(p => `<div class="r"><span>${p.label || p.mode}</span><span>${p.montant.toLocaleString('fr-FR')} FCFA</span></div>`).join('')
    : `<div class="r"><span>Règlement</span><span>${paiement}</span></div>`
  return `<!DOCTYPE html><html lang="fr"><head>
  <meta charset="UTF-8">
  <title>Reçu ${id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Courier New',Courier,monospace;max-width:320px;margin:0 auto;padding:24px 18px;font-size:12px;color:#111;background:#fff}
    .logo{text-align:center;margin-bottom:2px;font-size:16px;font-weight:900;letter-spacing:2px}
    .sub{text-align:center;font-size:10px;opacity:.55;line-height:1.6;margin-bottom:2px}
    .sep{border:none;border-top:1px dashed #999;margin:10px 0}
    .r{display:flex;justify-content:space-between;padding:3px 0;line-height:1.4}
    .r span:first-child{opacity:.6;flex-shrink:0;padding-right:6px}
    .r span:last-child{text-align:right;font-weight:600}
    .total{font-size:15px;font-weight:900;border-top:1px solid #333;border-bottom:1px solid #333;padding:6px 0;margin:6px 0}
    .muted{opacity:.55}
    .green{color:#16a34a;font-size:11px}
    .footer{text-align:center;margin-top:16px;font-size:10px;opacity:.55;line-height:1.8}
    .badge{display:inline-block;border:1px solid #333;border-radius:2px;padding:1px 5px;font-size:9px;letter-spacing:1px;text-transform:uppercase;margin:4px auto;opacity:.6}
    .logo-img{text-align:center;margin-bottom:6px}
    .qr-block{text-align:center;margin-top:14px}
    .qr-svg{display:inline-block;border:1px solid #ddd;padding:4px;background:#fff}
    .qr-label{font-size:9px;opacity:.45;margin-top:3px;letter-spacing:1px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head><body>
  ${logoHTML}
  <div class="logo">★ ${restaurantNom} ★</div>
  <div class="sub">${restaurantAdresse}<br>Tél : ${restaurantTel}</div>
  <div class="sub"><span class="badge">REÇU DE CAISSE</span></div>
  <hr class="sep">
  <div class="r"><span>N° Facture</span><span><b>${numeroFacture || id}</b></span></div>
  ${numeroFacture ? `<div class="r muted"><span>Réf. commande</span><span>${id}</span></div>` : ''}
  <div class="r"><span>Date</span><span>${dateStr}</span></div>
  <div class="r"><span>Caissier</span><span>${caissier || '-'}</span></div>
  ${sessionId ? `<div class="r"><span>Session</span><span>#${String(sessionId).slice(-6).toUpperCase()}</span></div>` : ''}
  <hr class="sep">
  <div class="r"><span>Mode</span><span>${mode || 'Sur place'}</span></div>
  ${paiementsHTML}
  ${(mode === 'livraison' || mode === 'emporter') && client && client !== 'Client sur place'
    ? `<div class="r"><span>Client</span><span>${client}</span></div>`
    : ''}
  ${tableNumero ? `<div class="r"><span>Table</span><span>N° ${tableNumero}</span></div>` : ''}
  <hr class="sep">
  ${lignesHTML}
  <hr class="sep">
  ${reductionHTML}
  ${remiseHTML}
  ${(reduction > 0 || remise > 0)
    ? `<div class="r muted"><span>Total HT</span><span>${sousTotal.toLocaleString('fr-FR')} FCFA</span></div>`
    : ''}
  <div class="r total"><span>TOTAL TTC</span><span>${total.toLocaleString('fr-FR')} FCFA</span></div>
  ${renduMonnaie > 0 ? `
  <hr class="sep">
  <div class="r" style="color:#ca8a04;font-weight:700"><span>Montant reçu</span><span>${(total + renduMonnaie).toLocaleString('fr-FR')} FCFA</span></div>
  <div class="r" style="color:#ca8a04;font-size:14px;font-weight:900"><span>💵 RENDU MONNAIE</span><span>${renduMonnaie.toLocaleString('fr-FR')} FCFA</span></div>` : ''}
  ${note ? `<div class="r muted" style="font-size:10px"><span>Note</span><span>${note}</span></div>` : ''}
  ${qrHTML}
  <div class="footer">
    Merci de votre visite !<br>
    Nous espérons vous revoir bientôt 🍽️<br>
    <br>
    Ce document tient lieu de reçu fiscal.<br>
    Conservation recommandée.<br>
    ★ ${restaurantNom} ★
  </div>
</body></html>`
}

export function totalCommande(cmd) {
  if (Array.isArray(cmd?.items)) return cmd.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0)
  return cmd?.total || 0
}
