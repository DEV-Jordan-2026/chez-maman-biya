import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import prisma from '@/lib/db'

const SYSTEM_PROMPT_BASE = `Tu es l'assistante virtuelle de "Chez Maman Biya", un restaurant camerounais traditionnel situé à Bastos, Yaoundé, Cameroun.

Tu t'appelles "Assistante Biya" et tu parles toujours en français, avec chaleur et hospitalité africaine.

INFOS DU RESTAURANT :
- Nom : Chez Maman Biya
- Adresse : Quartier Bastos, Yaoundé, Cameroun
- Téléphone : +237 677 000 000
- WhatsApp : +237 677 000 000
- Horaires : Lun-Ven 11h-22h | Sam 10h-23h | Dim 11h-21h
- Livraison : rayon 8km, frais 500 FCFA (gratuit dès 5 000 FCFA)
- Livraison estimée : 30-50 minutes

PAIEMENT : Espèces à la livraison ou au restaurant. Mobile Money disponible (MTN MoMo, Orange Money).

RÉSERVATION : Disponible en ligne sur /reservation ou par WhatsApp.

PROMOTIONS :
- Plat du jour à -15% chaque jour
- Livraison offerte dès 5 000 FCFA
- -10% dès 15 000 FCFA
- Programme fidélité : 5ème commande = dessert offert

RÈGLES :
- Toujours chaleureux, poli, concis (2-4 phrases max sauf demande contraire)
- Si info inconnue → inviter à appeler ou WhatsApp
- Ne jamais promettre des délais exacts
- Utiliser des emojis avec modération`

// Cache menu en mémoire 5 min pour ne pas interroger la BDD à chaque message
let menuCache = null
let menuCacheTs = 0
const MENU_CACHE_TTL = 5 * 60 * 1000

async function getMenuPrompt() {
  const now = Date.now()
  if (menuCache && now - menuCacheTs < MENU_CACHE_TTL) return menuCache

  try {
    const plats = await prisma.menuItem.findMany({
      where: { actif: true },
      orderBy: [{ cat: 'asc' }, { name: 'asc' }],
      select: { name: true, price: true, cat: true, desc: true, popular: true },
    })

    const parCat = {}
    for (const p of plats) {
      if (!parCat[p.cat]) parCat[p.cat] = []
      parCat[p.cat].push(p)
    }

    const lines = ['\nMENU ACTUEL (mis à jour en temps réel) :']
    for (const [cat, items] of Object.entries(parCat)) {
      lines.push(`\n${cat.toUpperCase()} :`)
      for (const p of items) {
        const pop = p.popular ? ' ⭐ Populaire' : ''
        lines.push(`- ${p.name} — ${p.price.toLocaleString('fr-FR')} FCFA${pop}${p.desc ? ` (${p.desc})` : ''}`)
      }
    }

    menuCache = lines.join('\n')
    menuCacheTs = now
    return menuCache
  } catch {
    return '\nMENU : Consultez notre site ou appelez-nous au +237 677 000 000'
  }
}

let anthropicClient = null

function getClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

export async function POST(request) {
  // Rate limiting : 30 messages / min par IP
  const ip = getClientIp(request)
  const rl = await rateLimit(`chatbot:${ip}`, { limit: 30, windowMs: 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { reponse: 'Je suis momentanément surchargée. Réessayez dans quelques secondes 🙏' },
      { status: 200 }
    )
  }

  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { reponse: 'Le chatbot est temporairement indisponible. Appelez-nous au +237 677 000 000 🙏' },
        { status: 200 }
      )
    }

    // ── FIX CRITIQUE : l'API Anthropic exige que le tableau commence
    //    par role:"user". On filtre tous les rôles invalides, on tronque
    //    à 20 messages, puis on supprime les messages assistant en tête
    //    de liste jusqu'à trouver le premier user. ──────────────────────
    let messagesFiltrés = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }))

    // N2 — Borner la taille totale de l'historique envoyé à l'API
    // Évite qu'un historique long (20 × 2000 chars) explose le coût en input tokens.
    // On supprime les messages les plus anciens jusqu'à passer sous 8 000 chars.
    let totalChars = messagesFiltrés.reduce((s, m) => s + m.content.length, 0)
    while (messagesFiltrés.length > 1 && totalChars > 8000) {
      const removed = messagesFiltrés.shift()
      totalChars -= removed.content.length
    }

    // Supprimer les messages assistant initiaux (message de bienvenue)
    // tant que le premier message n'est pas de type "user"
    while (messagesFiltrés.length > 0 && messagesFiltrés[0].role !== 'user') {
      messagesFiltrés.shift()
    }

    // S'il ne reste aucun message user, on ne peut pas appeler l'API
    if (messagesFiltrés.length === 0) {
      return NextResponse.json(
        { reponse: 'Bonjour ! Comment puis-je vous aider ? 😊' },
        { status: 200 }
      )
    }

    // L'API exige également une alternance user/assistant stricte.
    // On fusionne les messages consécutifs de même rôle pour éviter l'erreur.
    const messagesNormalisés = []
    for (const m of messagesFiltrés) {
      const dernier = messagesNormalisés[messagesNormalisés.length - 1]
      if (dernier && dernier.role === m.role) {
        // Fusionner avec le message précédent du même rôle
        dernier.content += '\n' + m.content
      } else {
        messagesNormalisés.push({ ...m })
      }
    }

    const menuPrompt = await getMenuPrompt()
    const systemPrompt = SYSTEM_PROMPT_BASE + menuPrompt

    const client = getClient()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: messagesNormalisés,
    })

    const reponse = response.content?.[0]?.text || 'Je n\'ai pas compris. Pouvez-vous reformuler ?'
    return NextResponse.json({ reponse })
  } catch (err) {
    console.error('[Chatbot] Erreur:', err.message)
    return NextResponse.json(
      { reponse: 'Service temporairement indisponible. Appelez-nous au +237 677 000 000 🙏' },
      { status: 200 }
    )
  }
}
