// @author TSJORDAN - Dev
// app/commande/page.js
import CommandeClient from '@/components/CommandeClient'

export const metadata = {
  title: 'Commander en ligne | Chez Maman Biya',
  description: 'Commandez vos plats camerounais en livraison ou à emporter. Paiement MTN Mobile Money, Orange Money ou espèces.',
}

export default function CommandePage() {
  return <CommandeClient />
}
