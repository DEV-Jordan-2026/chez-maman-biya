// app/api/cron/keepalive/route.js
// Tâche planifiée Vercel (vercel.json → crons) : une requête par jour sur la base,
// pour que Supabase (plan gratuit) ne mette pas le projet en pause après une
// semaine sans activité — c'est ce qui a mis le site hors ligne en octobre 2026.
//
// Si CRON_SECRET est défini dans les variables Vercel, seule la tâche planifiée
// peut appeler cette route : Vercel envoie alors « Authorization: Bearer <CRON_SECRET> ».
// Sans CRON_SECRET, la route reste appelable par tous, mais elle ne lit rien
// et ne renvoie aucune donnée (un simple SELECT 1).

import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, at: new Date().toISOString() })
  } catch (err) {
    console.error('[cron/keepalive] base injoignable :', err.message)
    return NextResponse.json({ ok: false, error: 'Base injoignable' }, { status: 503 })
  }
}
