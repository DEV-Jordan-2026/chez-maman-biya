// @author TSJORDAN - Dev
// app/reservation/page.js
import ReservationClient from '@/components/ReservationClient'

export const metadata = {
  title: 'Réserver une table | Chez Maman Biya',
  description: 'Réservez votre table en ligne chez Maman Biya à Yaoundé. Sans appel téléphonique, confirmation immédiate.',
}

export default function ReservationPage() {
  return <ReservationClient />
}
