/** @type {import('next').NextConfig} */
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV !== 'production'

// Domaines d'images autorisés (remotePatterns + CSP img-src)
// Ajoutez votre cloud Cloudinary ici si différent du défaut
const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '*'

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol:'https', hostname:'images.unsplash.com',          pathname:'/**' },
      { protocol:'https', hostname:'res.cloudinary.com',           pathname:'/**' },
      { protocol:'https', hostname:'i.imgur.com',                  pathname:'/**' },
      { protocol:'https', hostname:'lh3.googleusercontent.com',    pathname:'/**' },
      { protocol:'https', hostname:'drive.google.com',             pathname:'/**' },
    ],
  },

  serverExternalPackages: ['@prisma/client'],

  // ── Alias @/ pour middleware Edge ────────────────────────────────────────
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return config
  },

  // ── Headers sécurité HTTP ────────────────────────────────────────────────
  async headers() {
    // img-src étendu pour les CDN d'images de plats
    const imgSrc = [
      "img-src 'self' data: blob:",
      'https://images.unsplash.com',
      'https://res.cloudinary.com',        // Cloudinary (photos de plats)
      'https://i.imgur.com',               // Imgur (alternative gratuite)
      'https://lh3.googleusercontent.com', // Google Photos
      'https://api.qrserver.com',          // QR code facture (fallback externe)
    ].join(' ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key:'X-Frame-Options',           value:'SAMEORIGIN' },
          { key:'X-Content-Type-Options',    value:'nosniff' },
          { key:'Referrer-Policy',           value:'strict-origin-when-cross-origin' },
          { key:'Strict-Transport-Security', value:'max-age=31536000; includeSubDomains' },
          { key:'Permissions-Policy',        value:'camera=(), microphone=(), geolocation=(self), payment=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              isDev
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              imgSrc,
              "connect-src 'self' https://api.anthropic.com https://graph.facebook.com https://api-checkout.cinetpay.com https://api.cloudinary.com /api/events",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
