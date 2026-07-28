// app/api/tables/[id]/qr/route.js
// GET /api/tables/[id]/qr?size=200&format=svg
// Retourne le QR code de la table (SVG ou HTML imprimable)
// Accessible publiquement (pas d'auth — le QR est affiché dans la salle)

import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'
import { generateQRSVG } from '@/lib/qrcode'

export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  const { id }          = await context.params
  const { searchParams } = new URL(request.url)
  const size   = Math.min(1000, Math.max(50, parseInt(searchParams.get('size') || '280')))
  const format = searchParams.get('format') || 'svg' // 'svg' | 'print'
  const dark   = searchParams.get('dark') === '1'    // mode sombre

  try {
    const table = await prisma.table.findUnique({
      where: { id },
      include: { restaurant: { select: { nom: true, id: true } } },
    })

    if (!table) {
      return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const url     = `${baseUrl}/table/${table.id}`

    if (format === 'print') {
      // Page HTML autonome pour l'impression A4/thermique
      const svg = generateQRSVG(url, { size: 220, fg: '#000000', bg: '#ffffff' })
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>QR Table ${table.numero} — ${table.restaurant?.nom || 'Restaurant'}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: system-ui, sans-serif; background: #fff; }
    .card {
      width: 8cm; margin: 0 auto; padding: 1cm;
      border: 2px solid #c9973c; border-radius: 12px;
      text-align: center; page-break-inside: avoid;
    }
    .resto { font-size: 13px; font-weight: 800; color: #8B6820; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .table-num { font-size: 32px; font-weight: 900; color: #0d0a07; margin-bottom: 4px; }
    .zone  { font-size: 11px; color: #999; margin-bottom: 12px; }
    .qr    { margin: 0 auto 12px; display: block; }
    .cta   { font-size: 12px; color: #c9973c; font-weight: 700; margin-bottom: 4px; }
    .url   { font-size: 9px; color: #bbb; word-break: break-all; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="resto">${table.restaurant?.nom || 'Chez Maman Biya'}</div>
    <div class="table-num">Table ${table.numero}</div>
    <div class="zone">${table.zone} · ${table.capacite} couverts</div>
    ${svg}
    <div class="cta">📱 Scannez pour commander</div>
    <div class="url">${url}</div>
  </div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // Format SVG direct
    const fg = dark ? '#f0e8d8' : '#0d0a07'
    const bg = dark ? '#0d0a07' : '#ffffff'
    const svg = generateQRSVG(url, { size, fg, bg })

    return new Response(svg, {
      headers: {
        'Content-Type':  'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // Cache 24h — le QR ne change pas
      },
    })
  } catch (err) {
    console.error('[GET /api/tables/[id]/qr]', err)
    return NextResponse.json({ error: 'Erreur génération QR' }, { status: 500 })
  }
}
