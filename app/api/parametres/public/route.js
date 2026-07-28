import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

// Clés autorisées côté public — ne jamais exposer de données sensibles ici
const PUBLIC_KEYS = [
  'arrhes_vip',
  'arrhes_groupe',
  'arrhes_seuil_personnes',
  'arrhes_standard',
  'reduction_seuil',
  'reduction_taux',
  'livraison_gratuite_de',
  'taux_acompte_livraison',
  'message_accueil',
  'telephone_resto',
  'whatsapp_resto',
  'adresse_resto',
  'horaire_lun_ven_open',
  'horaire_lun_ven_close',
  'horaire_sam_open',
  'horaire_sam_close',
  'horaire_dim_open',
  'horaire_dim_close',
]

const DEFAULTS = {
  arrhes_vip:               '5000',
  arrhes_groupe:            '10000',
  arrhes_seuil_personnes:   '8',
  arrhes_standard:          '0',
  reduction_seuil:          '15000',
  reduction_taux:           '10',
  livraison_gratuite_de:    '5000',
  taux_acompte_livraison:   '30',
  message_accueil:          'Bienvenue chez Maman Biya — cuisine camerounaise authentique',
  telephone_resto:          '+237 677 000 000',
  whatsapp_resto:           '+237 677 000 000',
  adresse_resto:            'Quartier Bastos, Yaoundé, Cameroun',
  horaire_lun_ven_open:     '11',
  horaire_lun_ven_close:    '22',
  horaire_sam_open:         '10',
  horaire_sam_close:        '23',
  horaire_dim_open:         '11',
  horaire_dim_close:        '21',
}

export async function GET() {
  try {
    const rows = await prisma.parametre.findMany({
      where: {
        id:          { in: PUBLIC_KEYS },
        restaurantId: '',           // paramètres globaux uniquement côté public
      },
    })

    const result = { ...DEFAULTS }
    for (const r of rows) {
      if (PUBLIC_KEYS.includes(r.id)) result[r.id] = r.valeur
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch {
    // Si la table n'existe pas encore, retourner les défauts — jamais de 500 côté public
    return NextResponse.json(DEFAULTS, {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    })
  }
}
