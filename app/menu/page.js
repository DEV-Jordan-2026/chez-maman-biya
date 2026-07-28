// @author TSJORDAN - Dev
// app/menu/page.js — SERVER COMPONENT
// Les plats sont chargés côté serveur → Google voit "Ndolé 3500 FCFA" ✅
// force-dynamic : empêche la génération statique au build (menu = données live DB)

import { getMenu, getSiteImages } from '@/lib/data'
import MenuClient from '@/components/MenuClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Menu | Chez Maman Biya',
  description: 'Découvrez notre carte : Ndolé, Poulet DG, Eru, Poisson braisé… Prix en FCFA. Commande en ligne disponible.',
}

export default async function MenuPage() {
  const [menu, siteImages] = await Promise.all([
    getMenu(),
    getSiteImages(),
  ])
  return <MenuClient initialMenu={menu} siteImages={siteImages} />
}
