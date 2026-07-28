// lib/zones.js
// Zones de livraison — Yaoundé par défaut, configurable par restaurant
// En SaaS multi-tenant : chaque restaurant peut définir ses propres zones
// dans restaurant.parametres.zones (champ JSON en base)

// ── Zones par défaut — Yaoundé, depuis Bastos ─────────────────────────────────
export const ZONES_LIVRAISON = {
  'Bastos':           { frais: 0,    delai: '10–20 min', emoji: '🟢' },
  'Nlongkak':         { frais: 300,  delai: '15–25 min', emoji: '🟢' },
  'Mvog-Ada':         { frais: 500,  delai: '20–30 min', emoji: '🟡' },
  'Centre-ville':     { frais: 500,  delai: '20–35 min', emoji: '🟡' },
  'Melen':            { frais: 500,  delai: '25–35 min', emoji: '🟡' },
  'Biyem-Assi':       { frais: 700,  delai: '30–45 min', emoji: '🟡' },
  'Omnisports':       { frais: 700,  delai: '30–40 min', emoji: '🟡' },
  'Nkol-Afeme':       { frais: 800,  delai: '35–50 min', emoji: '🟠' },
  'Mvog-Mbi':         { frais: 800,  delai: '35–50 min', emoji: '🟠' },
  'Essos':            { frais: 900,  delai: '35–50 min', emoji: '🟠' },
  'Nkoldongo':        { frais: 1000, delai: '40–55 min', emoji: '🔴' },
  'Mendong':          { frais: 1200, delai: '45–60 min', emoji: '🔴' },
  'Autre zone':       { frais: 1500, delai: '45–70 min', emoji: '🔴' },
}

export const ZONES_LISTE = Object.keys(ZONES_LIVRAISON)

export function getZoneInfo(quartier) {
  return ZONES_LIVRAISON[quartier] || ZONES_LIVRAISON['Autre zone']
}

// Frais gratuits si commande >= ce montant (valeur par défaut)
export const LIVRAISON_GRATUITE_DE = 5000 // FCFA

/**
 * Retourne les zones de livraison d'un restaurant.
 * Si le restaurant a défini ses propres zones dans `parametres.zones`,
 * celles-ci prennent la priorité sur les zones Yaoundé par défaut.
 * Permet à un restaurant à Douala ou Bafoussam de configurer ses propres quartiers.
 *
 * @param {string|null} restaurantId
 * @returns {Promise<Record<string, { frais: number, delai: string, emoji: string }>>}
 */
export async function getZonesRestaurant(restaurantId) {
  if (!restaurantId) return ZONES_LIVRAISON

  try {
    const { default: prisma } = await import('@/lib/db')
    const restaurant = await prisma.restaurant.findUnique({
      where:  { id: restaurantId },
      select: { parametres: true },
    })

    const zonesCustom = restaurant?.parametres?.zones
    if (zonesCustom && typeof zonesCustom === 'object' && Object.keys(zonesCustom).length > 0) {
      return zonesCustom
    }
  } catch (err) {
    console.warn('[zones] Impossible de charger les zones du restaurant — fallback par défaut:', err.message)
  }

  return ZONES_LIVRAISON
}
