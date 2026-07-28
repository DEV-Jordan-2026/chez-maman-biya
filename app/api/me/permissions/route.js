// app/api/me/permissions/route.js — v14
// GET → retourne les permissions effectives de la session courante
// Combine : flags natifs du rôle + permissions granulaires en base
// Utilisé par les interfaces (ServeurClient, StaffClient…) pour
// afficher/masquer les onglets conditionnels (ex: "📦 Réception")

import { NextResponse }    from 'next/server'
import { cookies }         from 'next/headers'
import { requireAuth, ROLES_PERMISSIONS, PERMISSIONS_CATALOGUE } from '@/lib/auth'
import prisma              from '@/lib/db'

const FLAG_MAP = {
  receptionner_marchandises: 'canReceptionnerMarchandises',
  creer_demande_achat:       'canCreateDemandeAchat',
  valider_demande_achat:     'canValiderDemandeAchat',
  voir_analytics:            'canSeeFinances',
  voir_comptabilite:         'canSeeFinances',
  modifier_menu:             'canManageMenu',
  gerer_equipe:              'canManageEquipe',
}

export async function GET() {
  const session = await requireAuth(await cookies())
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const active = new Set()

  // 1 — super_admin a toutes les permissions
  if (session.role === 'super_admin') {
    PERMISSIONS_CATALOGUE.forEach(p => active.add(p.code))
    return NextResponse.json({ permissions: [...active] })
  }

  // 2 — flags natifs du rôle
  const rolePerms = ROLES_PERMISSIONS[session.role] || {}
  for (const [code, flag] of Object.entries(FLAG_MAP)) {
    if (rolePerms[flag]) active.add(code)
  }

  // 3 — permissions granulaires affectées manuellement
  if (session.userId) {
    try {
      const rows = await prisma.userPermission.findMany({
        where:   { userId: session.userId },
        include: { permission: true },
      })
      rows.forEach(r => active.add(r.permission.code))
    } catch { /* silencieux */ }
  }

  return NextResponse.json({ permissions: [...active] })
}
