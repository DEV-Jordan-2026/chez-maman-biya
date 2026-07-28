import { Playfair_Display, DM_Sans, Cormorant_Garamond } from 'next/font/google'
import OfflineBanner from '@/components/OfflineBanner'
import { ToastProvider } from '@/components/Toast'
import WhatsAppButton from '@/components/WhatsAppButton'
import ChatbotWidget from '@/components/ChatbotWidget'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400','500','600','700','800'],
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['300','400','500','600','700'],
  style: ['normal','italic'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  display: 'swap',
})

const NOM      = process.env.RESTAURANT_NOM      || 'Chez Maman Biya'
const TAGLINE  = process.env.RESTAURANT_TAGLINE  || 'Restaurant camerounais · Yaoundé'
const ADRESSE  = process.env.RESTAURANT_ADRESSE  || 'Quartier Bastos, Yaoundé, Cameroun'
const TEL      = process.env.RESTAURANT_TEL      || '+237677000000'
const EMAIL    = process.env.RESTAURANT_EMAIL    || 'contact@chezmamanbiya.cm'
const URL_SITE = process.env.RESTAURANT_URL      || 'https://chezmamanbiya.cm'
const LAT      = process.env.RESTAURANT_LAT      || '3.8812'
const LNG      = process.env.RESTAURANT_LNG      || '11.5021'

export const metadata = {
  title: {
    default: `${NOM} | ${TAGLINE}`,
    template: `%s | ${NOM}`,
  },
  description: `Cuisine camerounaise traditionnelle à Bastos, Yaoundé. Ndolé, Poulet DG, Eru… Réservez en ligne ou commandez en livraison. Ouvert 7j/7.`,
  keywords: 'restaurant camerounais, Yaoundé, Bastos, ndolé, poulet DG, cuisine africaine, livraison, commande en ligne, Mobile Money',
  authors: [{ name: NOM }],
  creator: NOM,
  metadataBase: new URL(URL_SITE),
  openGraph: {
    title: `${NOM} – Cuisine camerounaise authentique`,
    description: 'Réservez votre table ou commandez en livraison. Yaoundé, Bastos. Ndolé, Poulet DG, Eru, Poisson braisé.',
    type: 'website',
    locale: 'fr_FR',
    url: URL_SITE,
    siteName: NOM,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${NOM} – Restaurant camerounais à Yaoundé`,
    description: 'Commandez en ligne ou réservez votre table. Cuisine traditionnelle camerounaise.',
  },
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: NOM,
  description: `Restaurant camerounais traditionnel à Yaoundé. Ndolé, Poulet DG, Eru, Poisson braisé et plus.`,
  image: `${URL_SITE}/images/restaurant.jpg`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: ADRESSE.split(',')[0] || 'Quartier Bastos',
    addressLocality: 'Yaoundé',
    addressCountry: 'CM',
  },
  geo: { '@type': 'GeoCoordinates', latitude: parseFloat(LAT), longitude: parseFloat(LNG) },
  telephone: TEL,
  email: EMAIL,
  url: URL_SITE,
  servesCuisine: ['Camerounaise', 'Africaine'],
  priceRange: '2000-5000 FCFA',
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'], opens: '11:00', closes: '22:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '10:00', closes: '23:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '11:00', closes: '21:00' },
  ],
  hasMenu: { '@type': 'Menu', url: `${URL_SITE}/menu` },
  acceptsReservations: true,
  paymentAccepted: 'Cash, Mobile Money (MTN MoMo, Orange Money)',
  currenciesAccepted: 'XAF',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${dmSans.variable} ${cormorant.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <ToastProvider>
          <OfflineBanner />
          {children}
          <WhatsAppButton />
          <ChatbotWidget />
        </ToastProvider>
      </body>
    </html>
  )
}
