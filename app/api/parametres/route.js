import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'

// Paramètres par défaut (affichés si aucune ligne en base)
const DEFAULTS = {
  'objectif_ca_jour':         '150000',
  'annulation_delai_min':     '10',
  'arrhes_vip':               '5000',
  'arrhes_groupe':            '10000',
  'arrhes_seuil_personnes':   '8',
  'arrhes_standard':          '0',        // arrhes Salle/Terrasse hors groupe (0 = gratuit)
  'livraison_gratuite_de':    '5000',
  'taux_acompte_livraison':   '30',       // % d'acompte requis pour paiement livraison (0 = désactivé)
  'reduction_seuil':          '15000',
  'reduction_taux':           '10',
  'fidelite_seuil':           '5',
  'horaire_lun_ven_open':     '11',
  'horaire_lun_ven_close':    '22',
  'horaire_sam_open':         '10',
  'horaire_sam_close':        '23',
  'horaire_dim_open':         '11',
  'horaire_dim_close':        '21',
  'message_accueil':          'Bienvenue chez Maman Biya — cuisine camerounaise authentique',
  'telephone_resto':          '+237 677 000 000',
  'whatsapp_resto':           '+237 677 000 000',
  'adresse_resto':            'Quartier Bastos, Yaoundé, Cameroun',
}

export async function GET(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
    ? searchParams.get('restaurantId')
    : (session.restaurantId || '')

  try {
    // Charger les paramètres globaux (restaurantId = '') ET ceux du restaurant (si définis)
    const rows = await prisma.parametre.findMany({
      where: {
        OR: [
          { restaurantId: '' },           // paramètres globaux par défaut
          { restaurantId: rid },           // surcharges spécifiques au restaurant
        ],
      },
    })
    const result = { ...DEFAULTS }
    // Appliquer d'abord les globaux, ensuite les spécifiques (qui l'emportent)
    const globals  = rows.filter(r => r.restaurantId === '')
    const specific = rows.filter(r => r.restaurantId === rid && rid !== '')
    for (const r of globals)  result[r.id] = r.valeur
    for (const r of specific) result[r.id] = r.valeur
    return NextResponse.json(result)
  } catch (err) {
    // Si la table n'existe pas encore, retourner les défauts
    return NextResponse.json(DEFAULTS)
  }
}

export async function PATCH(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé au propriétaire' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const rid  = session.restaurantId || ''
    const updates = []

    for (const [id, valeur] of Object.entries(body)) {
      if (!(id in DEFAULTS)) continue
      updates.push(
        prisma.parametre.upsert({
          where:  { id_restaurantId: { id, restaurantId: rid } },
          update: { valeur: String(valeur), updatedBy: session.name || session.login },
          create: { id, restaurantId: rid, valeur: String(valeur), updatedBy: session.name || session.login },
        })
      )
    }

    await prisma.$transaction(updates)

    // Logger dans le journal
    await prisma.journalActivite.create({
      data: {
        restaurantId: session.restaurantId,
        auteur: session.name || session.login,
        action: `Paramètres mis à jour : ${Object.keys(body).join(', ')}`,
        type:   'parametres',
        meta:   body,
      },
    })

    return NextResponse.json({ ok: true, updated: Object.keys(body).length })
  } catch (err) {
    console.error('[PATCH /api/parametres]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
