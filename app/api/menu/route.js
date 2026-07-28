import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'
import { sanitize } from '@/lib/validate'
import { cookies } from 'next/headers'

// GET est public (menu visible par les clients) mais filtré par restaurantId
// si l'appelant est authentifié, le restaurantId vient de la session.
// Sinon, il peut être passé en ?restaurantId= (QR code client, etc.).
export async function GET(request) {
  const { searchParams } = new URL(request.url)

  // Tenter d'identifier le restaurant depuis la session ou le query param
  let rid = searchParams.get('restaurantId') || null
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const session = await verifyToken(token)
    if (session) {
      rid = (session.role === 'super_admin' && searchParams.get('restaurantId'))
        ? searchParams.get('restaurantId')
        : session.restaurantId
    }
  } catch {}

  try {
    const where = rid ? { restaurantId: rid } : {}
    const menu = await prisma.menuItem.findMany({
      where,
      orderBy: [{ cat: 'asc' }, { name: 'asc' }],
      take: 300,
    })
    return NextResponse.json(menu)
  } catch (err) {
    console.error('[GET /api/menu]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, price, cat, emoji, desc, image, tempsPrep, popular, poste } = body

    if (!name || !price || !cat) {
      return NextResponse.json({ error: 'Champs requis : name, price, cat' }, { status: 400 })
    }
    if (!Number.isInteger(Number(price)) || Number(price) <= 0) {
      return NextResponse.json({ error: 'Prix invalide' }, { status: 400 })
    }

    const plat = await prisma.menuItem.create({
      data: {
        restaurantId: session.restaurantId,
        cat:      sanitize(cat, 50),
        name:     sanitize(name, 100),
        price:    Number(price),
        emoji:    emoji    ? sanitize(emoji, 10)   : null,
        desc:     desc     ? sanitize(desc, 500)   : null,
        image:    image    ? sanitize(image, 300)  : null,
        tempsPrep: Number(tempsPrep) || 20,
        popular:  Boolean(popular),
        actif:    true,
        ...(body.poste ? { poste: body.poste } : {}),
      },
    })

    // Journal d'activité (non-bloquant)
    prisma.journalActivite.create({ data: {
      restaurantId: session.restaurantId,
      auteur: session.name || session.login,
      action: `Plat créé : ${plat.name}`,
      type: 'menu', ref: String(plat.id),
    }}).catch(err => console.error('[journal]', err.message))

    return NextResponse.json(plat, { status: 201 })
  } catch (err) {
    console.error('[POST /api/menu]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const cookieStore = await cookies()
  const token   = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Vérifier ownership avant update
    const existing = await prisma.menuItem.findFirst({
      where: { id: Number(id), restaurantId: session.restaurantId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Plat introuvable ou accès refusé' }, { status: 404 })
    }

    const CHAMPS = ['name', 'price', 'cat', 'emoji', 'desc', 'image', 'tempsPrep', 'popular', 'actif', 'poste']
    const data   = {}
    for (const champ of CHAMPS) {
      if (body[champ] !== undefined) {
        data[champ] = typeof body[champ] === 'string' ? body[champ].trim().slice(0, 500) : body[champ]
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide à modifier' }, { status: 400 })
    }

    const plat = await prisma.menuItem.update({
      where: { id: Number(id) },
      data,
    })
    return NextResponse.json(plat)
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Plat introuvable' }, { status: 404 })
    }
    console.error('[PATCH /api/menu]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
