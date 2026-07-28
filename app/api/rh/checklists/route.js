import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

// Templates par défaut si aucun en base
const TEMPLATES_DEFAUT = {
  staff: {
    ouverture: [
      { id: 'f01', label: 'Vérifier les stocks frigo (température < 4°C)', obligatoire: true },
      { id: 'f02', label: 'Nettoyer et désinfecter les plans de travail',   obligatoire: true },
      { id: 'f03', label: 'Vérifier les commandes en attente',              obligatoire: true },
      { id: 'f04', label: 'Allumer les équipements de cuisson',             obligatoire: false },
      { id: 'f05', label: 'Préparer les sauces et condiments de base',     obligatoire: false },
    ],
    fermeture: [
      { id: 'f06', label: 'Nettoyer tous les équipements de cuisson',       obligatoire: true },
      { id: 'f07', label: 'Emballer et étiqueter les restes (date/heure)',  obligatoire: true },
      { id: 'f08', label: 'Vérifier les stocks pour le lendemain',          obligatoire: true },
      { id: 'f09', label: 'Éteindre tous les équipements',                  obligatoire: true },
      { id: 'f10', label: 'Sortir les poubelles',                           obligatoire: false },
    ],
  },
  magasinier: {
    ouverture: [
      { id: 'm01', label: 'Inventaire rapide des stocks critiques',          obligatoire: true },
      { id: 'm02', label: 'Vérifier les bons de livraison du jour',         obligatoire: true },
      { id: 'm03', label: 'Vérifier les températures des chambres froides', obligatoire: true },
      { id: 'm04', label: 'Mettre à jour le registre des entrées/sorties',  obligatoire: false },
    ],
    fermeture: [
      { id: 'm05', label: 'Saisir les mouvements de stock du jour',         obligatoire: true },
      { id: 'm06', label: 'Verrouiller les zones de stockage',              obligatoire: true },
      { id: 'm07', label: 'Signaler les ruptures pour commande urgente',    obligatoire: false },
    ],
  },
  caissier: {
    ouverture: [
      { id: 'c01', label: 'Vérifier le fond de caisse',                     obligatoire: true },
      { id: 'c02', label: 'Tester le terminal de paiement mobile money',    obligatoire: true },
      { id: 'c03', label: 'Imprimer le rapport de la veille',               obligatoire: false },
    ],
    fermeture: [
      { id: 'c04', label: 'Compter et vérifier la caisse',                  obligatoire: true },
      { id: 'c05', label: 'Imprimer le rapport journalier',                 obligatoire: true },
      { id: 'c06', label: 'Saisir les éventuels écarts',                    obligatoire: true },
    ],
  },
}

export async function GET(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId') || session.restaurantId
  const role    = searchParams.get('role')    || session.role
  const date    = searchParams.get('date')    || new Date().toISOString().split('T')[0]
  const moment  = searchParams.get('moment')

  // Templates pour ce rôle
  let templates = await prisma.checklistTemplate.findMany({
    where: { role, actif: true, OR: [{ restaurantId }, { restaurantId: null }] },
  })

  // Si aucun template en base, retourner les défauts en mémoire
  if (templates.length === 0) {
    const roleKey   = role === 'staff' ? 'staff' : role === 'magasinier' ? 'magasinier' : role === 'caissier' ? 'caissier' : 'staff'
    const defauts   = TEMPLATES_DEFAUT[roleKey] || TEMPLATES_DEFAUT.staff
    templates = Object.entries(defauts).map(([mom, items]) => ({
      id: `defaut_${roleKey}_${mom}`, role, moment: mom, titre: mom === 'ouverture' ? 'Checklist ouverture' : 'Checklist fermeture',
      items, actif: true, restaurantId: null, createdAt: new Date(), isDefault: true,
    }))
  }

  // Complétion du jour pour cet utilisateur
  const completions = await prisma.checklistCompletion.findMany({
    where: { userId: session.userId || session.login, date, ...(moment && { moment }) },
  })

  return NextResponse.json({ templates, completions, date, role })
}

export async function POST(req) {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { templateId, date, moment, itemsCoches, restaurantId } = await req.json()
  if (!templateId || !date || !moment || !Array.isArray(itemsCoches))
    return NextResponse.json({ error: 'Données incomplètes' }, { status: 400 })

  const complet = itemsCoches.filter(i => i.coche).length === itemsCoches.length
  const restoId = restaurantId || session.restaurantId || ''

  // Pour les templates par défaut (non en base), on crée quand même la complétion
  const completion = await prisma.checklistCompletion.upsert({
    where: { templateId_userId_date_moment: { templateId, userId: session.userId || session.login, date, moment } },
    update: { itemsCoches, complet, signature: `Validé le ${new Date().toLocaleString('fr-FR')}` },
    create: { templateId, userId: session.userId || session.login, userName: session.name, restaurantId: restoId, date, moment, itemsCoches, complet, signature: `Validé le ${new Date().toLocaleString('fr-FR')}` },
  }).catch(async () => {
    // Si templateId fictif (défaut), on crée sans la contrainte
    return prisma.checklistCompletion.create({
      data: { templateId: 'defaut', userId: session.userId || session.login, userName: session.name, restaurantId: restoId, date, moment, itemsCoches, complet, signature: `Validé le ${new Date().toLocaleString('fr-FR')}` },
    })
  })
  return NextResponse.json(completion, { status: 201 })
}
