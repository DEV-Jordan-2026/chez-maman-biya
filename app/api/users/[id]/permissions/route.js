// app/api/users/[id]/permissions/route.js — v13
// POST   → accorder une permission
// DELETE → révoquer une permission

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/db'

async function check(cookieStore) {
  const session = await requireAuth(cookieStore)
  if (!session || !['super_admin','manager'].includes(session.role)) return null
  return session
}

export async function POST(req, { params }) {
  const session = await check(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const { permissionCode } = await req.json()

  if (!permissionCode) return NextResponse.json({ error: 'Code permission requis' }, { status: 400 })

  // Trouver ou créer la permission dans le catalogue
  let perm = await prisma.permission.findUnique({ where: { code: permissionCode } })
  if (!perm) {
    // Chercher dans le catalogue en mémoire
    const { PERMISSIONS_CATALOGUE } = await import('@/lib/auth')
    const entry = PERMISSIONS_CATALOGUE.find(p => p.code === permissionCode)
    if (!entry) return NextResponse.json({ error: 'Permission inconnue' }, { status: 400 })
    perm = await prisma.permission.create({
      data: { code: entry.code, label: entry.label, groupe: entry.groupe },
    })
  }

  const up = await prisma.userPermission.upsert({
    where:  { userId_permissionId: { userId: id, permissionId: perm.id } },
    create: { userId: id, permissionId: perm.id, accordePar: session.name },
    update: { accordePar: session.name, accordeAt: new Date() },
  })

  return NextResponse.json(up, { status: 201 })
}

export async function DELETE(req, { params }) {
  const session = await check(await cookies())
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await params
  const { permissionCode } = await req.json()

  const perm = await prisma.permission.findUnique({ where: { code: permissionCode } })
  if (!perm) return NextResponse.json({ ok: true }) // déjà inexistant

  await prisma.userPermission.deleteMany({
    where: { userId: id, permissionId: perm.id },
  })

  return NextResponse.json({ ok: true })
}
