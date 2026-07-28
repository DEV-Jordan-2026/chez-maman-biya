'use client'
// AdminClient.js — v13 Multi-site & RH · Chez Maman Biya

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSSE from '@/hooks/useSSE'
import dynamic          from 'next/dynamic'
import ErrorBoundary    from '@/components/ErrorBoundary'
import NotifAlert       from '@/components/NotifAlert'

// ── Skeleton affiché pendant le chargement d'un panel ─────────────────────────
function PanelSkeleton() {
  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Ligne titre */}
      <div style={{
        height: 28, width: '35%', borderRadius: 8, marginBottom: 28,
        background: 'linear-gradient(90deg, var(--ebony-2) 25%, var(--ebony-3) 50%, var(--ebony-2) 75%)',
        backgroundSize: '400% 100%', animation: 'shimmer 1.5s ease infinite',
      }} />
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            height: 100, borderRadius: 12,
            background: 'linear-gradient(90deg, var(--ebony-2) 25%, var(--ebony-3) 50%, var(--ebony-2) 75%)',
            backgroundSize: '400% 100%', animation: `shimmer 1.5s ease ${i * 0.1}s infinite`,
          }} />
        ))}
      </div>
      {/* Lignes de contenu */}
      {[80, 60, 70].map((w, i) => (
        <div key={i} style={{
          height: 16, width: `${w}%`, borderRadius: 6, marginBottom: 14,
          background: 'linear-gradient(90deg, var(--ebony-2) 25%, var(--ebony-3) 50%, var(--ebony-2) 75%)',
          backgroundSize: '400% 100%', animation: `shimmer 1.5s ease ${i * 0.15}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── Imports dynamiques — chaque panel est chargé à la demande ─────────────────
const CommandesPanel    = dynamic(() => import('@/components/panels/CommandesPanel'),    { loading: () => <PanelSkeleton />, ssr: false })
const ReservationsPanel = dynamic(() => import('@/components/panels/ReservationsPanel'), { loading: () => <PanelSkeleton />, ssr: false })
const MenuPanel         = dynamic(() => import('@/components/panels/MenuPanel'),         { loading: () => <PanelSkeleton />, ssr: false })
const FacturationPanel  = dynamic(() => import('@/components/panels/FacturationPanel'),  { loading: () => <PanelSkeleton />, ssr: false })
const ComptabilitePanel = dynamic(() => import('@/components/panels/ComptabilitePanel'), { loading: () => <PanelSkeleton />, ssr: false })
const StocksPanel       = dynamic(() => import('@/components/panels/StocksPanel'),       { loading: () => <PanelSkeleton />, ssr: false })
const EquipePanel       = dynamic(() => import('@/components/panels/EquipePanel'),       { loading: () => <PanelSkeleton />, ssr: false })
const PlanSallePanel    = dynamic(() => import('@/components/panels/PlanSallePanel'),    { loading: () => <PanelSkeleton />, ssr: false })
const CaissePanel       = dynamic(() => import('@/components/panels/CaissePanel'),       { loading: () => <PanelSkeleton />, ssr: false })
const AnalyticsPanel    = dynamic(() => import('@/components/panels/AnalyticsPanel'),    { loading: () => <PanelSkeleton />, ssr: false })
const FournisseursPanel = dynamic(() => import('@/components/panels/FournisseursPanel'), { loading: () => <PanelSkeleton />, ssr: false })
const AchatsPanel       = dynamic(() => import('@/components/panels/AchatsPanel'),       { loading: () => <PanelSkeleton />, ssr: false })
const RestaurantsPanel  = dynamic(() => import('@/components/panels/RestaurantsPanel'),  { loading: () => <PanelSkeleton />, ssr: false })
const RHPanel           = dynamic(() => import('@/components/panels/RHPanel'),           { loading: () => <PanelSkeleton />, ssr: false })
const LivreursPanel     = dynamic(() => import('@/components/panels/LivreursPanel'),     { loading: () => <PanelSkeleton />, ssr: false })
const MessageriePanel   = dynamic(() => import('@/components/panels/MessageriePanel'),   { loading: () => <PanelSkeleton />, ssr: false })
const JournalPanel      = dynamic(() => import('@/components/panels/JournalPanel'),      { loading: () => <PanelSkeleton />, ssr: false })
const ParametresPanel   = dynamic(() => import('@/components/panels/ParametresPanel'),   { loading: () => <PanelSkeleton />, ssr: false })
const ManagerDashboard  = dynamic(() => import('@/components/panels/ManagerDashboard'),  { loading: () => <PanelSkeleton />, ssr: false })
const BrandingPanel     = dynamic(() => import('@/components/panels/BrandingPanel'),     { loading: () => <PanelSkeleton />, ssr: false })
const ImagesPanel       = dynamic(() => import('@/components/panels/ImagesPanel'),       { loading: () => <PanelSkeleton />, ssr: false })

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none', strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  dashboard:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  commandes:    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  plan_salle:   'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  reservations: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  menu:         'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  facturation:  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  caisse:       'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  analytics:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  comptabilite: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  stocks:       'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  achats:       'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  rh:           'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  fournisseurs: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  livreurs:     'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z M5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm13 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  messagerie:   'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  journal:      'M9 12h6m-6 4h6M7 8h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  parametres:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  equipe:       'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  logout:       'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  refresh:      'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  branding:     'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343 M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485 M7 17h.01',
  images:        'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01 M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z',
  restaurants:  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
}

// ── Tabs config v13 ────────────────────────────────────────────────────────────
// Conventions des flags de visibilité :
//   superAdminOnly  → visible uniquement pour super_admin
//   managerAndUp    → visible pour manager ET super_admin (masqué pour les autres rôles)
//   (aucun flag)    → visible pour tous les rôles qui passent par AdminClient
const TABS = [
  { id: 'dashboard',    label: 'Tableau de bord',  managerAndUp: true,       group: 'Opérations' },
  { id: 'commandes',    label: 'Commandes',                                   group: 'Opérations' },
  { id: 'plan_salle',   label: 'Plan de salle',                               group: 'Opérations' },
  { id: 'reservations', label: 'Réservations',                                group: 'Opérations' },
  { id: 'menu',         label: 'Carte & Menu',                                group: 'Gestion' },
  { id: 'facturation',  label: 'Facturation',                                 group: 'Gestion' },
  { id: 'caisse',       label: 'Caisse',                                      group: 'Gestion' },
  { id: 'stocks',       label: 'Stocks',                                      group: 'Gestion' },
  { id: 'livreurs',     label: 'Livreurs',                                    group: 'Gestion' },
  { id: 'fournisseurs', label: 'Fournisseurs',      superAdminOnly: true,     group: 'Finance' },
  { id: 'achats',       label: 'Achats',                                      group: 'Finance' },
  { id: 'rh',           label: 'RH',               managerAndUp: true,       group: 'Équipe' },
  { id: 'analytics',    label: 'Analytics',         superAdminOnly: true,     group: 'Finance' },
  { id: 'comptabilite', label: 'Comptabilité',      superAdminOnly: true,     group: 'Finance' },
  { id: 'messagerie',   label: 'Messagerie',                                  group: 'Équipe' },
  { id: 'equipe',       label: 'Équipe',            managerAndUp: true,       group: 'Équipe' },
  { id: 'journal',      label: 'Journal activité',  superAdminOnly: true,     group: 'Système' },
  { id: 'parametres',   label: 'Paramètres',        superAdminOnly: true,     group: 'Système' },
  { id: 'branding',     label: 'Branding',          superAdminOnly: true,     group: 'Système' },
  { id: 'images',       label: 'Images du site',    superAdminOnly: true,     group: 'Système' },
  { id: 'restaurants',  label: 'Restaurants',       superAdminOnly: true,     group: 'Système' },
]

const ROLE_CONFIG = {
  super_admin: { label: 'Propriétaire', color: '#C9973C' },
  manager:     { label: 'Gérant',       color: '#8B5CF6' },
  caissier:    { label: 'Caissier',     color: '#10b981' },
  staff:       { label: 'Staff',        color: '#f59e0b' },
  serveur:     { label: 'Serveur',      color: '#06b6d4' },
  magasinier:  { label: 'Magasinier',   color: '#84cc16' },
}


export default function AdminClient({ user }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Fix: support ?tab=caisse (ex: depuis le lien "Ouvrir la caisse" de CaissierClient)
  const tabFromUrl = searchParams?.get('tab')
  const defaultTab = tabFromUrl || (['super_admin', 'manager'].includes(user.role) ? 'dashboard' : 'commandes')
  const [tab, setTab]               = useState(defaultTab)
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(user.restaurantId || null)
  const [restaurants, setRestaurants] = useState([])
  const [commandes, setCommandes]   = useState([])
  const [reservations, setReservations] = useState([])
  const [menu, setMenu]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [syncing, setSyncing]       = useState(false)
  const [objectifCA, setObjectifCA] = useState(150000)
  const [nbMsgNonLus, setNbMsgNonLus] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebar, setMobileSidebar] = useState(false)

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchCommandes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setSyncing(true)
    try {
      const params = new URLSearchParams()
      if (user.role === 'super_admin' && selectedRestaurantId) {
        params.set('restaurantId', selectedRestaurantId)
      }
      const url = `/api/commandes${params.size ? `?${params}` : ''}`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      const list = Array.isArray(data) ? data : (Array.isArray(data?.commandes) ? data.commandes : [])
      setCommandes(list)
      setLastRefresh(new Date())
    } catch (e) { console.error('[AdminClient] fetch commandes:', e) }
    finally { setLoading(false); setSyncing(false) }
  }, [user.role, selectedRestaurantId])

  const fetchReservations = useCallback(async () => {
    try {
      const res  = await fetch('/api/reservations', { cache: 'no-store' })
      const data = await res.json()
      setReservations(Array.isArray(data) ? data : [])
    } catch (e) { console.error('[AdminClient] fetch reservations:', e) }
  }, [])

  const fetchMenu = useCallback(async () => {
    try {
      const res  = await fetch('/api/menu', { cache: 'no-store' })
      const data = await res.json()
      setMenu(Array.isArray(data) ? data : [])
    } catch (e) { console.error('[AdminClient] fetch menu:', e) }
  }, [])

  useEffect(() => {
    fetchCommandes()
    fetchReservations()
    fetchMenu()
    fetch('/api/parametres').then(r => r.json()).then(p => {
      if (p.objectif_ca_jour) setObjectifCA(parseInt(p.objectif_ca_jour))
    }).catch(() => {})
    fetch('/api/messages?nonLus=1').then(r => r.json()).then(msgs => {
      setNbMsgNonLus(Array.isArray(msgs) ? msgs.length : 0)
    }).catch(() => {})
    // Charger la liste des restaurants (super_admin uniquement)
    if (user.role === 'super_admin') {
      fetch('/api/restaurants').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setRestaurants(d)
      }).catch(() => {})
    }

    // Polling de secours uniquement (SSE gère le temps réel)
    // Intervalle plus long — simple filet de sécurité si SSE tombe
    const ivCmd  = setInterval(() => fetchCommandes(true), 120_000)
    const ivResa = setInterval(() => fetchReservations(), 120_000)
    const ivMsg  = setInterval(() => {
      fetch('/api/messages?nonLus=1').then(r => r.json()).then(msgs => {
        setNbMsgNonLus(Array.isArray(msgs) ? msgs.length : 0)
      }).catch(() => {})
    }, 60_000)
    return () => { clearInterval(ivCmd); clearInterval(ivResa); clearInterval(ivMsg) }
  }, [fetchCommandes, fetchReservations, fetchMenu, user.role])

  // Re-charger les commandes quand le super_admin change de restaurant
  useEffect(() => {
    if (user.role === 'super_admin') fetchCommandes(true)
  }, [selectedRestaurantId, user.role, fetchCommandes])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function updateCommandeStatus(id, status) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    try {
      const res = await fetch(`/api/commandes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Erreur API')
      return true
    } catch (e) { console.error(e); fetchCommandes(true); return false }
  }

  // Mise à jour état React local uniquement — sans appel API
  // Utilisé quand l'API a déjà été appelée ailleurs (ex: ManagerDashboard → /valider)
  function localUpdateCommandeStatus(id, status) {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  async function updateReservationStatus(id, status) {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Erreur API')
    } catch { fetchReservations() }
  }

  // ── SSE : temps réel ─────────────────────────────────────────────────────────
  const { connected: sseConnected } = useSSE({
    onCommandeNouvelle: (commande) => {
      setCommandes(prev => {
        // Éviter les doublons si le polling de secours est passé avant
        if (prev.find(c => c.id === commande.id)) return prev
        return [commande, ...prev]
      })
      setSyncing(false)
    },
    onCommandeStatus: ({ id, status, paiement, updatedAt }) => {
      setCommandes(prev => prev.map(c =>
        c.id === id ? { ...c, status, ...(paiement && { paiement }), updatedAt } : c
      ))
    },
    onReservationNouvelle: (reservation) => {
      setReservations(prev => {
        if (prev.find(r => r.id === reservation.id)) return prev
        return [reservation, ...prev]
      })
    },
    onReservationStatus: ({ id, status }) => {
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    },
    onMessageNouveau: ({ nb }) => setNbMsgNonLus(nb),
  })

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const todayLocal    = new Date().toLocaleDateString('fr-CA')
  const cmdAujourdHui = commandes.filter(c => {
    const d = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-CA') : ''
    return d === todayLocal
  })
  const caAujourdHui = cmdAujourdHui.filter(c => c.status === 'livre').reduce((s, c) => s + (c.total || 0), 0)
  const enAttente    = commandes.filter(c => c.status === 'nouveau')
  const enPrep       = commandes.filter(c => ['en_cours','en_preparation'].includes(c.status))
  const prets        = commandes.filter(c => c.status === 'pret')
  const annulesJour  = cmdAujourdHui.filter(c => c.status === 'annule').length

  const charge = enAttente.length + enPrep.length
  const meteo = charge === 0
    ? { label: 'Calme',    color: '#6B7280', dot: '#9CA3AF' }
    : charge <= 3
    ? { label: 'Normal',   color: '#22C55E', dot: '#22C55E' }
    : charge <= 7
    ? { label: 'Chargé',   color: '#F59E0B', dot: '#F59E0B' }
    : { label: 'Critique', color: '#EF4444', dot: '#EF4444' }

  const progressCA = Math.min(100, Math.round((caAujourdHui / objectifCA) * 100))

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '–'

  // ── Filtered tabs ────────────────────────────────────────────────────────────

  const visibleTabs = TABS.filter(t => {
    if (t.superAdminOnly && user.role !== 'super_admin') return false
    if (t.managerAndUp && !['super_admin', 'manager'].includes(user.role)) return false
    return true
  })

  const groups = [...new Set(visibleTabs.map(t => t.group))]

  // ── Active tab info ──────────────────────────────────────────────────────────

  const activeTab = visibleTabs.find(t => t.id === tab)

  // ── Styles ───────────────────────────────────────────────────────────────────

  const S = {
    root: {
      minHeight: '100vh',
      background: 'var(--ebony)',
      color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      display: 'flex',
    },

    // Sidebar
    sidebar: {
      width: sidebarCollapsed ? 68 : 240,
      flexShrink: 0,
      background: 'var(--ebony-1)',
      borderRight: '1px solid var(--border-gold)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width .3s cubic-bezier(.22,1,.36,1)',
      zIndex: 40,
    },

    sidebarLogo: {
      padding: sidebarCollapsed ? '20px 14px' : '20px 20px',
      borderBottom: '1px solid var(--border-gold)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      overflow: 'hidden',
      flexShrink: 0,
    },

    sidebarNav: {
      flex: 1,
      padding: '12px 8px',
      overflowY: 'auto',
      overflowX: 'hidden',
    },

    sidebarBottom: {
      padding: '12px 8px',
      borderTop: '1px solid var(--border-gold)',
      flexShrink: 0,
    },

    // Main
    main: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    },

    // Header
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'rgba(8,6,5,.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-gold)',
      padding: '0 28px',
      height: 58,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    },

    content: {
      flex: 1,
      padding: '24px 28px',
      maxWidth: '100%',
      overflowX: 'hidden',
    },

    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 14,
      marginBottom: 18,
    },
  }

  // ── Sidebar item ─────────────────────────────────────────────────────────────

  function SideNavItem({ t }) {
    const isActive = tab === t.id
    const hasBadge = t.id === 'messagerie' && nbMsgNonLus > 0
    return (
      <button
        onClick={() => { setTab(t.id); if (t.id === 'messagerie') setNbMsgNonLus(0) }}
        className={`nav-item${isActive ? ' active' : ''}`}
        title={sidebarCollapsed ? t.label : undefined}
        style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '10px' : undefined, position: 'relative' }}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          {ICONS[t.id]?.split(' M').map((segment, i) => (
            <path key={i} d={i === 0 ? segment : `M${segment}`} />
          ))}
        </svg>
        {!sidebarCollapsed && (
          <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
        )}
        {hasBadge && (
          <span style={{
            marginLeft: sidebarCollapsed ? undefined : 'auto',
            position: sidebarCollapsed ? 'absolute' : undefined,
            top: sidebarCollapsed ? 4 : undefined,
            right: sidebarCollapsed ? 4 : undefined,
            background: 'var(--danger)', color: '#fff',
            borderRadius: '50%', minWidth: 17, height: 17,
            fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'badgePop .3s ease',
            flexShrink: 0,
          }}>
            {nbMsgNonLus > 9 ? '9+' : nbMsgNonLus}
          </span>
        )}
      </button>
    )
  }

  // ── KPI Card ─────────────────────────────────────────────────────────────────

  function KPICard({ label, value, sub, color, icon, index = 0 }) {
    const [vis, setVis] = useState(false)
    useEffect(() => { const t = setTimeout(() => setVis(true), index * 70); return () => clearTimeout(t) }, [index])
    return (
      <div style={{
        background: 'var(--ebony-2)',
        border: '1px solid var(--border-gold)',
        borderRadius: 'var(--r-lg)',
        padding: '18px 20px',
        opacity: vis ? 1 : 0,
        transform: vis ? 'none' : 'translateY(18px)',
        transition: `opacity .5s ${index*.07}s ease, transform .5s ${index*.07}s cubic-bezier(.22,1,.36,1), border-color .2s`,
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}50`; e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,.4)` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.boxShadow = 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              {icon?.split(' M').map((segment, i) => (
                <path key={i} d={i === 0 ? segment : `M${segment}`} />
              ))}
            </svg>
          </div>
        </div>
        <div key={String(value)} style={{
          fontSize: 26, fontWeight: 800, color,
          lineHeight: 1, letterSpacing: -.5,
          animation: vis ? 'countUp .45s cubic-bezier(.22,1,.36,1)' : 'none',
        }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color, opacity: .7, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
        <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginTop: 5, letterSpacing: .3 }}>{label}</div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      <style>{`
        @keyframes countUp { from{opacity:0;transform:translateY(14px) scale(.9)} to{opacity:1;transform:none} }
        @keyframes badgePop { 0%{transform:scale(0)} 70%{transform:scale(1.3)} 100%{transform:scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes glowPulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.8;transform:scale(1.12)} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-100%)} to{opacity:1;transform:translateX(0)} }
        .admin-sidebar-nav::-webkit-scrollbar { width:3px }
        .admin-sidebar-nav::-webkit-scrollbar-thumb { background:rgba(201,151,60,.2); border-radius:2px }
        @media (max-width:900px) {
          .admin-sidebar { display:none!important }
          .admin-hamburger { display:flex!important }
        }
        @media (min-width:901px) {
          .admin-hamburger { display:none!important }
        }
      `}</style>

      {/* ── Sidebar Desktop ─────────────────────────────────────────────────── */}
      <aside className="admin-sidebar" style={S.sidebar}>

        {/* Logo */}
        <div style={S.sidebarLogo}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(201,151,60,.25), rgba(201,151,60,.08))',
            border: '1px solid rgba(201,151,60,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🍽</div>
          {!sidebarCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 15, fontWeight: 700, color: 'var(--gold)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                Chez Maman Biya
              </div>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)', marginTop: 2 }}>
                Administration
              </div>
            </div>
          )}
        </div>

        {/* Météo opérationnelle */}
        {!sidebarCollapsed && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-gold)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: `${meteo.color}12`,
              border: `1px solid ${meteo.color}25`,
              borderRadius: 8, padding: '7px 12px',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: meteo.dot,
                animation: 'glowPulse 2s ease infinite',
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: meteo.color }}>
                {meteo.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cream-faint)' }}>
                {charge} en cours
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={S.sidebarNav} className="admin-sidebar-nav">
          {groups.map(group => {
            const groupTabs = visibleTabs.filter(t => t.group === group)
            return (
              <div key={group} style={{ marginBottom: 6 }}>
                {!sidebarCollapsed && (
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)', padding: '8px 8px 4px', fontWeight: 600 }}>
                    {group}
                  </div>
                )}
                {groupTabs.map(t => <SideNavItem key={t.id} t={t} />)}
              </div>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={S.sidebarBottom}>
          {/* User info */}
          {!sidebarCollapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 8px', marginBottom: 6,
              background: 'var(--border-subtle)',
              borderRadius: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${ROLE_CONFIG[user.role]?.color}20`,
                border: `1px solid ${ROLE_CONFIG[user.role]?.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: ROLE_CONFIG[user.role]?.color,
                flexShrink: 0,
              }}>
                {(user.name || user.login || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.name || user.login}
                </div>
                <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: ROLE_CONFIG[user.role]?.color, opacity: .8 }}>
                  {ROLE_CONFIG[user.role]?.label}
                </div>
              </div>
            </div>
          )}

          {/* Sélecteur de restaurant (super_admin uniquement) */}
          {!sidebarCollapsed && user.role === 'super_admin' && restaurants.length > 0 && (
            <div style={{ marginBottom: 8, padding: '0 2px' }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(201,151,60,0.5)', marginBottom: 4 }}>RESTAURANT ACTIF</div>
              <select
                value={selectedRestaurantId || ''}
                onChange={e => setSelectedRestaurantId(e.target.value || null)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(201,151,60,0.25)', borderRadius: 7,
                  color: 'var(--cream)', padding: '7px 10px', fontSize: 12,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="">— Tous les restaurants —</option>
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.nom} · {r.ville}</option>
                ))}
              </select>
            </div>
          )}

          {/* Signature développeur */}
          {!sidebarCollapsed && (
            <div style={{
              textAlign: 'center', marginBottom: 4, display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 9, letterSpacing: .6, color: 'rgba(201,151,60,.22)',
              fontFamily: 'inherit',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(201,151,60,.3)' }}>&lt;/&gt;</span>
              Jordan – full-Dev
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            style={{
              width: '100%', padding: '8px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border-subtle)',
              color: 'var(--cream-faint)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, gap: 6, fontFamily: 'inherit',
              transition: 'background .18s, border-color .18s',
              marginBottom: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,151,60,.06)'; e.currentTarget.style.borderColor = 'var(--border-gold)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
          >
            <span style={{ fontSize: 14, transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform .3s', display: 'inline-block' }}>◀</span>
            {!sidebarCollapsed && <span>Réduire</span>}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '9px', borderRadius: 8,
              background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
              color: '#EF4444', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, gap: 6, fontFamily: 'inherit', fontWeight: 600,
              transition: 'background .18s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,.06)'}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!sidebarCollapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ── Sidebar Mobile (drawer + overlay) ─────────────────────────────────── */}
      {mobileSidebar && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setMobileSidebar(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 49,
              background: 'rgba(0,0,0,.6)',
              backdropFilter: 'blur(3px)',
            }}
          />
          {/* Drawer */}
          <aside style={{
            ...S.sidebar,
            position: 'fixed', left: 0, top: 0, zIndex: 50,
            width: 260,
            boxShadow: '4px 0 32px rgba(0,0,0,.6)',
            animation: 'slideInLeft .25s cubic-bezier(.22,1,.36,1)',
          }}>
            {/* Logo */}
            <div style={S.sidebarLogo}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(201,151,60,.25), rgba(201,151,60,.08))',
                border: '1px solid rgba(201,151,60,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>🍽</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 15, fontWeight: 700, color: 'var(--gold)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  Chez Maman Biya
                </div>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)', marginTop: 2 }}>
                  Administration
                </div>
              </div>
              {/* Bouton fermer */}
              <button
                onClick={() => setMobileSidebar(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--cream-faint)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
              >✕</button>
            </div>

            {/* Navigation */}
            <nav style={S.sidebarNav} className="admin-sidebar-nav">
              {groups.map(group => {
                const groupTabs = visibleTabs.filter(t => t.group === group)
                return (
                  <div key={group} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)', padding: '8px 8px 4px', fontWeight: 600 }}>
                      {group}
                    </div>
                    {groupTabs.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setMobileSidebar(false); if (t.id === 'messagerie') setNbMsgNonLus(0) }}
                        className={`nav-item${tab === t.id ? ' active' : ''}`}
                        style={{ position: 'relative' }}
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          {ICONS[t.id]?.split(' M').map((segment, i) => (
                            <path key={i} d={i === 0 ? segment : `M${segment}`} />
                          ))}
                        </svg>
                        <span style={{ fontSize: 13 }}>{t.label}</span>
                        {t.id === 'messagerie' && nbMsgNonLus > 0 && (
                          <span style={{
                            marginLeft: 'auto',
                            background: 'var(--danger)', color: '#fff',
                            borderRadius: '50%', minWidth: 17, height: 17,
                            fontSize: 9, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {nbMsgNonLus > 9 ? '9+' : nbMsgNonLus}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )
              })}
            </nav>

            {/* User + logout */}
            <div style={S.sidebarBottom}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px', marginBottom: 8,
                background: 'var(--border-subtle)', borderRadius: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${ROLE_CONFIG[user.role]?.color}20`,
                  border: `1px solid ${ROLE_CONFIG[user.role]?.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: ROLE_CONFIG[user.role]?.color,
                  flexShrink: 0,
                }}>
                  {(user.name || user.login || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name || user.login}
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: ROLE_CONFIG[user.role]?.color, opacity: .8 }}>
                    {ROLE_CONFIG[user.role]?.label}
                  </div>
                </div>
              </div>
              <div style={{
                textAlign: 'center', marginBottom: 6, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 9, letterSpacing: .6, color: 'rgba(201,151,60,.22)',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(201,151,60,.3)' }}>&lt;/&gt;</span>
                Jordan – full-Dev
              </div>
              <button
                onClick={logout}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8,
                  background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                  color: '#EF4444', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, gap: 6, fontFamily: 'inherit', fontWeight: 600,
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Déconnexion</span>
              </button>
            </div>
          </aside>
        </>
      )}
      <div style={S.main}>

        {/* Header */}
        <header className="admin-header" style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Mobile hamburger */}
            <button
              className="admin-hamburger"
              onClick={() => setMobileSidebar(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--gold)' }}
            >
              ☰
            </button>

            {/* Breadcrumb */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)' }}>
                {activeTab?.group}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cream)', letterSpacing: -.2 }}>
                {activeTab?.label}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="admin-header-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {syncing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--cream-faint)' }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'spin 1s linear infinite', display: 'block' }}>
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="admin-sync-label">Synchronisation…</span>
              </div>
            )}

            {/* Badge connexion SSE */}
            <div title={sseConnected ? 'Temps réel actif' : 'Reconnexion en cours…'} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: sseConnected ? 'var(--success)' : 'var(--warning)', background: sseConnected ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)', border: `1px solid ${sseConnected ? 'rgba(16,185,129,.2)' : 'rgba(245,158,11,.25)'}`, borderRadius: 20, padding: '3px 9px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sseConnected ? 'var(--success)' : 'var(--warning)', display: 'inline-block', animation: sseConnected ? 'glowPulse 2s ease infinite' : 'none' }} />
              {sseConnected ? <span className="admin-sse-label">Temps réel</span> : <span className="admin-sse-label">Reconnexion…</span>}
            </div>

            <button
              onClick={() => fetchCommandes(true)}
              className="btn-ghost"
              style={{ padding: '7px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="admin-refresh-label">Actualiser</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content" style={S.content}>

          {/* KPIs — super_admin uniquement, masqués sur dashboard (ManagerDashboard a ses propres KPIs) */}
          {user.role === 'super_admin' && tab !== 'dashboard' && (
            <>
              <div style={S.kpiGrid}>
                <KPICard index={0} icon={ICONS.commandes} label="Commandes aujourd'hui" value={cmdAujourdHui.length} sub={annulesJour > 0 ? `${annulesJour} annulée${annulesJour > 1 ? 's' : ''}` : null} color="var(--gold)" />
                <KPICard index={1} icon={ICONS.caisse}    label="Chiffre d'affaires encaissé"           value={`${caAujourdHui.toLocaleString('fr-FR')} F`} color="var(--success)" />
                <KPICard index={2} icon={ICONS.facturation} label="À valider"            value={enAttente.length} sub={enPrep.length > 0 ? `${enPrep.length} en préparation` : null} color="var(--warning)" />
                <KPICard index={3} icon={ICONS.analytics} label="Prêts"                 value={prets.length} color="var(--info)" />
                <KPICard index={4} icon={ICONS.reservations} label="Réservations en attente" value={reservations.filter(r => r.status === 'en_attente').length} color="#8B5CF6" />
              </div>

              {/* Barre objectif CA */}
              <div style={{
                marginBottom: 22,
                background: 'var(--ebony-2)',
                border: '1px solid var(--border-gold)',
                borderRadius: 'var(--r-md)',
                padding: '14px 20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--cream-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    Objectif CA journalier
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: progressCA >= 100 ? 'var(--success)' : 'var(--gold)' }}>
                    {caAujourdHui.toLocaleString('fr-FR')} / {objectifCA.toLocaleString('fr-FR')} FCFA
                    <span style={{ marginLeft: 8, background: progressCA >= 100 ? 'rgba(34,197,94,.15)' : 'rgba(201,151,60,.15)', color: progressCA >= 100 ? 'var(--success)' : 'var(--gold)', padding: '2px 8px', borderRadius: 20, fontSize: 10 }}>
                      {progressCA}%{progressCA >= 100 && ' 🎉'}
                    </span>
                  </div>
                </div>
                <div style={{ background: 'rgba(240,232,216,.06)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${progressCA}%`,
                    background: progressCA >= 100
                      ? 'linear-gradient(90deg, var(--success), #16A34A)'
                      : progressCA >= 70
                      ? 'linear-gradient(90deg, var(--warning), #D97706)'
                      : 'linear-gradient(90deg, var(--gold), var(--gold-dark))',
                    transition: 'width 1s cubic-bezier(.22,1,.36,1)',
                    boxShadow: progressCA >= 100 ? '0 0 12px rgba(34,197,94,.4)' : '0 0 10px rgba(201,151,60,.3)',
                  }} />
                </div>
              </div>
            </>
          )}

          {/* Panel actif */}
          <ErrorBoundary>
            <div key={tab} style={{ animation: 'fadeIn .28s ease' }}>
              {tab === 'dashboard'    && user.role === 'manager' && <ManagerDashboard commandes={commandes} reservations={reservations} onUpdateStatus={updateCommandeStatus} onLocalUpdate={localUpdateCommandeStatus} />}
              {tab === 'dashboard'    && user.role === 'super_admin' && <ManagerDashboard commandes={commandes} reservations={reservations} onUpdateStatus={updateCommandeStatus} onLocalUpdate={localUpdateCommandeStatus} />}
              {tab === 'commandes'    && <CommandesPanel    commandes={commandes}    loading={loading}    onUpdateStatus={updateCommandeStatus} onRefresh={() => fetchCommandes(true)} />}
              {tab === 'plan_salle'   && <PlanSallePanel    user={user} menu={menu} />}
              {tab === 'reservations' && <ReservationsPanel reservations={reservations} onUpdateStatus={updateReservationStatus} />}
              {tab === 'menu'         && <MenuPanel         menu={menu} user={user} onRefresh={fetchMenu} />}
              {tab === 'facturation'  && <FacturationPanel  commandes={commandes} />}
              {tab === 'caisse'       && <CaissePanel user={{ ...user, restaurantId: selectedRestaurantId || user.restaurantId }} />}
              {tab === 'analytics'    && user.role === 'super_admin' && <AnalyticsPanel restaurantId={selectedRestaurantId} />}
              {tab === 'analytics'    && user.role !== 'super_admin' && <AccessDenied />}
              {tab === 'comptabilite' && user.role === 'super_admin' && <ComptabilitePanel commandes={commandes} />}
              {tab === 'comptabilite' && user.role !== 'super_admin' && <AccessDenied />}
              {tab === 'stocks'       && <StocksPanel user={{ ...user, restaurantId: selectedRestaurantId || user.restaurantId }} />}
              {tab === 'achats'       && <AchatsPanel user={{ ...user, restaurantId: selectedRestaurantId || user.restaurantId }} />}
              {tab === 'rh'          && ['super_admin','manager'].includes(user.role) && <RHPanel user={{ ...user, restaurantId: selectedRestaurantId || user.restaurantId }} />}
              {tab === 'rh'          && !['super_admin','manager'].includes(user.role) && <AccessDenied />}
              {tab === 'livreurs'     && <LivreursPanel commandes={commandes} />}
              {tab === 'fournisseurs' && user.role === 'super_admin' && <FournisseursPanel />}
              {tab === 'fournisseurs' && user.role !== 'super_admin' && <AccessDenied />}
              {tab === 'messagerie'   && <MessageriePanel user={user} />}
              {tab === 'journal'      && user.role === 'super_admin' && <JournalPanel />}
              {tab === 'parametres'   && user.role === 'super_admin' && <ParametresPanel />}
              {tab === 'branding'     && user.role === 'super_admin' && <BrandingPanel />}
          {tab === 'images'       && user.role === 'super_admin' && <ImagesPanel />}
              {tab === 'equipe'       && ['super_admin','manager'].includes(user.role) && <EquipePanel user={{ ...user, restaurantId: selectedRestaurantId || user.restaurantId }} />}
              {tab === 'equipe'       && !['super_admin','manager'].includes(user.role) && <AccessDenied />}
              {tab === 'restaurants'  && user.role === 'super_admin' && <RestaurantsPanel />}
              {tab === 'restaurants'  && user.role !== 'super_admin' && <AccessDenied />}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Alertes nouvelles commandes */}
      <NotifAlert commandes={commandes} />
    </div>
  )
}

function AccessDenied() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', textAlign: 'center',
      background: 'var(--ebony-2)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border-gold)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, marginBottom: 16,
      }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Accès restreint</div>
      <div style={{ fontSize: 13, color: 'var(--cream-faint)', maxWidth: 280 }}>
        Cette section est réservée au propriétaire de l'établissement.
      </div>
    </div>
  )
}
