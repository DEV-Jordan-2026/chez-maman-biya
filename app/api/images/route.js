// app/api/images/route.js
// GET  (public)  → retourne la config images du site avec fallbacks Unsplash
// PATCH (admin)  → sauvegarde le JSON dans la table Parametre
//
// Stockage : Parametre { id: 'site_images', valeur: JSON, restaurantId: '' }
// Aucune migration nécessaire — utilise la table existante.

import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import prisma           from '@/lib/db'
import { requireAuth }  from '@/lib/auth'

// ── Fallbacks Unsplash (identiques aux constantes actuelles de HeroClient) ───
export const SITE_IMAGES_DEFAULTS = {
  hero_bg: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1800&q=85',
  cta_bg:  'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1400&q=80',
  menu_bg: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b5?w=1200&q=60',
  galerie: [
    { url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=90',  label: 'Ambiance salle' },
    { url: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b5?w=500&q=85', label: 'Marché de Mokolo' },
    { url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=500&q=85', label: 'Ndolé maison' },
    { url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=85', label: 'Préparation' },
    { url: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=500&q=85', label: 'Plantain doré' },
  ],
}

const PARAM_KEY = 'site_images'

// ── Helper : charger depuis DB ───────────────────────────────────────────────
async function loadSiteImages(restaurantId = '') {
  try {
    const row = await prisma.parametre.findFirst({
      where: {
        id: PARAM_KEY,
        OR: [
          { restaurantId: restaurantId },
          { restaurantId: '' },
        ],
      },
      orderBy: { restaurantId: 'desc' }, // restaurant-specific > global
    })
    if (!row) return SITE_IMAGES_DEFAULTS

    const parsed = JSON.parse(row.valeur)

    // Deep merge : garder les defaults pour les clés absentes
    return {
      hero_bg: parsed.hero_bg || SITE_IMAGES_DEFAULTS.hero_bg,
      cta_bg:  parsed.cta_bg  || SITE_IMAGES_DEFAULTS.cta_bg,
      menu_bg: parsed.menu_bg || SITE_IMAGES_DEFAULTS.menu_bg,
      galerie: Array.isArray(parsed.galerie) && parsed.galerie.length === 5
        ? parsed.galerie.map((g, i) => ({
            url:   g.url   || SITE_IMAGES_DEFAULTS.galerie[i].url,
            label: g.label || SITE_IMAGES_DEFAULTS.galerie[i].label,
          }))
        : SITE_IMAGES_DEFAULTS.galerie,
    }
  } catch {
    return SITE_IMAGES_DEFAULTS
  }
}

// ── GET — public ─────────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const restaurantId = searchParams.get('restaurantId') || ''

  const images = await loadSiteImages(restaurantId)
  return NextResponse.json(images, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}

// ── PATCH — admin seulement ───────────────────────────────────────────────────
export async function PATCH(request) {
  // FIX #1 — requireAuth attend un cookieStore, pas un Request
  const cookieStore = await cookies()
  const session     = await requireAuth(cookieStore)
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!['super_admin', 'manager'].includes(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const restaurantId = session.restaurantId || ''

    // Valider la structure
    const sanitized = {
      hero_bg: typeof body.hero_bg === 'string' ? body.hero_bg.trim() : SITE_IMAGES_DEFAULTS.hero_bg,
      cta_bg:  typeof body.cta_bg  === 'string' ? body.cta_bg.trim()  : SITE_IMAGES_DEFAULTS.cta_bg,
      menu_bg: typeof body.menu_bg === 'string' ? body.menu_bg.trim() : SITE_IMAGES_DEFAULTS.menu_bg,
      galerie: Array.isArray(body.galerie)
        ? body.galerie.slice(0, 5).map((g, i) => ({
            url:   typeof g.url   === 'string' ? g.url.trim()   : SITE_IMAGES_DEFAULTS.galerie[i]?.url || '',
            label: typeof g.label === 'string' ? g.label.trim() : SITE_IMAGES_DEFAULTS.galerie[i]?.label || '',
          }))
        : SITE_IMAGES_DEFAULTS.galerie,
    }

    await prisma.parametre.upsert({
      where:  { id_restaurantId: { id: PARAM_KEY, restaurantId } },
      update: { valeur: JSON.stringify(sanitized) },
      create: { id: PARAM_KEY, valeur: JSON.stringify(sanitized), restaurantId },
    })

    return NextResponse.json({ ok: true, data: sanitized })
  } catch (err) {
    console.error('[PATCH /api/images]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
