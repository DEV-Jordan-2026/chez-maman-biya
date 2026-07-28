// lib/qrcode.js
// Génération de QR Code — s'appuie sur la bibliothèque éprouvée `qrcode` (npm)
// au lieu d'un encodeur maison (Reed-Solomon/masques) qui produisait des QR
// non décodables (testé : 0/3 avec un détecteur QR standard, finder patterns
// présents mais données illisibles — d'où le "scan = recherche Google Lens").
//
// ⚠️ Nouvelle dépendance à installer avant déploiement :
//     npm install qrcode
//
// L'API publique (generateQRSVG) est INCHANGÉE — aucun appelant à modifier :
//   - app/api/tables/[id]/qr/route.js
//   - components/Recu.jsx
//   - components/caisse/constants.js
//
// Usage :
//   import { generateQRSVG } from '@/lib/qrcode'
//   const svg = generateQRSVG('https://example.com', { size: 200, fg: '#000', bg: '#fff' })

import QRCode from 'qrcode'

/**
 * Génère un QR Code sous forme de SVG string (synchrone, hors-ligne).
 * @param {string} text      URL ou texte à encoder
 * @param {object} opts
 * @param {number} opts.size  Taille en pixels (default: 200)
 * @param {string} opts.fg    Couleur modules (default: '#000000')
 * @param {string} opts.bg    Couleur fond   (default: '#ffffff')
 * @param {number} opts.quiet Quiet zone en modules (default: 4)
 * @returns {string}  SVG complet (viewBox carré, prêt à inliner)
 */
export function generateQRSVG(text, { size = 200, fg = '#000000', bg = '#ffffff', quiet = 4 } = {}) {
  // QRCode.create() est SYNCHRONE et ne fait aucun accès réseau/disque :
  // il calcule uniquement la matrice de modules (encodage, correction
  // d'erreur, sélection du masque) — c'est le cœur éprouvé de `qrcode`.
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n            = modules.size
  const totalModules = n + quiet * 2
  const moduleSize   = size / totalModules

  const rects = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules.get(r, c)) {
        const x = ((c + quiet) * moduleSize).toFixed(2)
        const y = ((r + quiet) * moduleSize).toFixed(2)
        const s = (moduleSize + 0.5).toFixed(2) // +0.5 anti sub-pixel gaps
        rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`)
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g fill="${fg}">${rects.join('')}</g>
</svg>`
}
