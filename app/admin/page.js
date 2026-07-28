// app/admin/page.js — Router de rôles v13
// @author TSJORDAN - Dev
// super_admin     → AdminClient        (tous les onglets)
// manager         → AdminClient        (onglets restreints via ROLES_PERMISSIONS)
// caissier        → CaissierClient     (commandes à encaisser + facturation)
// staff           → StaffClient        (cuisine uniquement)
// serveur         → ServeurClient      (commandes + réservations + tables)
// magasinier      → MagasinierClient   (stocks + achats + réceptions)

import { Suspense }            from 'react'
import { cookies }             from 'next/headers'
import { redirect }            from 'next/navigation'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import AdminClient             from '@/components/AdminClient'
import StaffClient             from '@/components/StaffClient'
import CaissierClient          from '@/components/CaissierClient'
import ServeurClient           from '@/components/ServeurClient'
import MagasinierClient        from '@/components/MagasinierClient'

export const metadata = {
  title: 'Administration | Chez Maman Biya',
  robots: 'noindex, nofollow',
}
export const dynamic = 'force-dynamic'

// Fallback pendant le rendu SSR des composants qui utilisent useSearchParams
const PageFallback = () => (
  <div style={{ minHeight: '100vh', background: '#080605' }} />
)

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)

  if (!session) redirect('/admin/login')

  switch (session.role) {
    case 'super_admin':
    case 'manager':
      return (
        <Suspense fallback={<PageFallback />}>
          <AdminClient user={session} />
        </Suspense>
      )
    case 'caissier':
      return (
        <Suspense fallback={<PageFallback />}>
          <CaissierClient user={session} />
        </Suspense>
      )
    case 'staff':
      return (
        <Suspense fallback={<PageFallback />}>
          <StaffClient user={session} />
        </Suspense>
      )
    case 'serveur':
    case 'receptionniste':
      return (
        <Suspense fallback={<PageFallback />}>
          <ServeurClient user={session} />
        </Suspense>
      )
    case 'magasinier':
      return (
        <Suspense fallback={<PageFallback />}>
          <MagasinierClient user={session} />
        </Suspense>
      )
    default:
      return (
        <div style={{ minHeight:'100vh', background:'#080605', color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div>Rôle non reconnu : <code style={{ color:'#f87171' }}>{session.role}</code></div>
          <a href="/api/auth/logout" style={{ color:'#c9973c', fontSize:13 }}>Se déconnecter</a>
        </div>
      )
  }
}
