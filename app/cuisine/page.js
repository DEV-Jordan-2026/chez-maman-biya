// @author TSJORDAN - Dev
// app/cuisine/page.js
// Page d'entrée de la PWA Cuisine — auth serveur + rendu du client

import { cookies }  from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import CuisineApp from '@/components/CuisineApp'

export const metadata = {
  title: 'Cuisine – Chez Maman Biya',
  robots: 'noindex, nofollow',
}

export default async function CuisinePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) redirect('/admin/login?next=/cuisine')

  const session = await verifyToken(token)
  if (!session) redirect('/admin/login?next=/cuisine')

  // Seuls les rôles autorisés à accéder à l'interface cuisine
  const ROLES_AUTORISES = ['staff', 'manager', 'super_admin']
  if (!ROLES_AUTORISES.includes(session.role)) redirect('/admin')

  return <CuisineApp user={session} />
}
