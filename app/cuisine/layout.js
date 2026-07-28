// app/cuisine/layout.js
// Layout isolé pour la PWA cuisine — manifest + viewport optimisé tablette paysage
// Pas de chatbot, pas de WhatsApp, pas de bannière offline globale

import { DM_Sans, Cormorant_Garamond } from 'next/font/google'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm', display: 'swap' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin'], variable: '--font-cormorant', display: 'swap',
  weight: ['400','600','700'], style: ['normal'],
})

export const metadata = {
  title: 'Cuisine – Chez Maman Biya',
  description: 'Interface cuisine temps réel',
  robots: 'noindex, nofollow',
  manifest: '/cuisine/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cuisine CMB',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,          // Désactive le pinch-zoom — mode kiosque
  viewportFit: 'cover',         // Plein écran notch
  themeColor: '#080605',
}

export default function CuisineLayout({ children }) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${cormorant.variable}`}>
      <head>
        {/* iOS PWA full screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cuisine CMB" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Empêche le double-tap zoom sur iOS */}
        <style>{`* { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }`}</style>
      </head>
      <body style={{ margin: 0, padding: 0, background: '#080605', overscrollBehavior: 'none' }}>
        {children}
      </body>
    </html>
  )
}
