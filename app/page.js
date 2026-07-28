// @author TSJORDAN - Dev
// app/page.js — Server Component (SEO ✅)
// force-dynamic : plat du jour + images = données live, pas de cache statique
import HeroClient from '@/components/HeroClient'
import { getPlatDuJour, getSiteImages, getPlatsVedettes } from '@/lib/data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Chez Maman Biya | Restaurant camerounais · Yaoundé',
  alternates: { canonical: 'https://chezmamanbiya.cm' },
}

export default async function HomePage() {
  const [platDuJour, siteImages, platsVedettes] = await Promise.all([
    getPlatDuJour(),
    getSiteImages(),
    getPlatsVedettes(),
  ])
  return <HeroClient platDuJour={platDuJour} siteImages={siteImages} platsVedettes={platsVedettes} />
}
