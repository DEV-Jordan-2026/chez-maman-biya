// app/api/whatsapp/route.js
// Route INTERNE — sécurisée par clé x-internal-key
// Ne jamais appeler depuis le front directement

import { NextResponse } from 'next/server'
import { verifyInternalKey } from '@/lib/auth'

const WA_TOKEN    = process.env.WHATSAPP_TOKEN
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID
const RESTO_WA    = process.env.WHATSAPP_RESTO_NUMBER
const API_URL     = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`

// ── Envoi WhatsApp ────────────────────────────────────────────────────────────
async function envoyerWA(to, message) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.warn('[WhatsApp] Variables non configurées — simulé:', { to, message: message.slice(0, 50) })
    return { simule: true }
  }

  const numero = to.replace(/[\s+\-()]/g, '')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:   numero,
      type: 'text',
      text: { body: message },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[WhatsApp] Erreur envoi:', err)
    throw new Error('Échec envoi WhatsApp')
  }

  return res.json()
}

// ── Messages ──────────────────────────────────────────────────────────────────
function msgNouvelleCommande(cmd) {
  const items = (Array.isArray(cmd.items) ? cmd.items : [])
    .map(it => `  • ${it.qty || 1}× ${it.name} — ${((it.price||0)*(it.qty||1)).toLocaleString('fr-FR')} FCFA`)
    .join('\n')

  return `🍽️ *Nouvelle commande — Chez Maman Biya*

📋 *${cmd.id}*
👤 ${cmd.client} · 📞 ${cmd.tel}
🚚 Mode : ${cmd.mode || 'Livraison'}
💳 Paiement : ${cmd.paiement === 'cinetpay' ? '✅ Payé en ligne' : cmd.paiement === 'resto' ? 'Au restaurant' : 'Espèces à la livraison'}
${cmd.addr ? `📍 Adresse : ${cmd.addr}` : ''}

*Commande :*
${items}

💰 *Total : ${(cmd.total||0).toLocaleString('fr-FR')} FCFA*
${cmd.note ? `\n📝 Note : ${cmd.note}` : ''}

_Chez Maman Biya · Bastos, Yaoundé_`
}

function msgAssignationLivreur(cmd) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const aEncaisser = (cmd.acompte > 0 && cmd.acompteStatut === 'paye')
    ? cmd.resteARegler
    : (cmd.paiement === 'livraison' ? cmd.total : 0)

  return `🛵 *Nouvelle livraison assignée*\n\n📋 Commande *${cmd.id}*\n👤 ${cmd.client} · 📞 ${cmd.tel}\n📍 ${cmd.addr || 'Adresse non précisée'}\n${aEncaisser > 0 ? `💵 À encaisser : ${aEncaisser.toLocaleString('fr-FR')} FCFA\n` : '✅ Déjà payée\n'}\nOuvrez votre app livreur pour les détails et confirmer la livraison :\n${baseUrl}/livraison\n\n_Chez Maman Biya_`
}

function msgConfirmationClient(cmd) {
  const statutPaiement = cmd.paiement === 'cinetpay'
    ? '✅ Paiement Mobile Money confirmé'
    : `💳 Paiement : ${cmd.paiement === 'resto' ? 'Au restaurant' : 'Espèces à la livraison'}`

  return `✅ *Commande confirmée !*

Bonjour ${cmd.client} 🙏

Votre commande *${cmd.id}* a bien été reçue chez Chez Maman Biya.

🕐 Livraison estimée : 30–50 minutes
💰 Total : *${(cmd.total||0).toLocaleString('fr-FR')} FCFA*
${statutPaiement}

Suivez votre commande 👇
${process.env.NEXT_PUBLIC_SITE_URL || 'https://chezmamanbiya.cm'}/suivi?id=${cmd.id}

Merci de votre confiance ! 🍽️`
}

function msgStatutCommande(cmd, nouveauStatut) {
  const msgs = {
    'en_preparation': '👨‍🍳 Votre commande est en préparation !',
    'en_livraison':   '🛵 Votre commande est en route !',
    'livre':          '✅ Commande livrée ! Bon appétit 🍽️',
    'annule':         '❌ Commande annulée. Contactez-nous au +237 677 000 000',
  }

  return `*Chez Maman Biya* — ${cmd.id}

${msgs[nouveauStatut] || `Statut : ${nouveauStatut}`}
${nouveauStatut === 'en_livraison' ? '\nPaiement espèces à la réception 💵' : ''}

Questions ? +237 677 000 000`
}

function msgNouvelleReservation(resa) {
  return `📅 *Nouvelle réservation — Chez Maman Biya*

👤 ${resa.nom} · 📞 ${resa.tel}
📅 ${resa.date} à ${resa.heure}
👥 ${resa.personnes} personne${resa.personnes > 1 ? 's' : ''}
${resa.notes ? `📝 ${resa.notes}` : ''}

ID : *${resa.id}*
_À confirmer au client_`
}

function msgConfirmationReservation(resa) {
  return `✅ *Réservation reçue !*

Bonjour ${resa.nom} 🙏

Votre réservation est bien enregistrée.

📅 *${resa.date}* à *${resa.heure}*
👥 ${resa.personnes} personne${resa.personnes > 1 ? 's' : ''}

Nous vous confirmons sous peu.
Questions : *+237 677 000 000*

À très bientôt ! 🍽️
_Chez Maman Biya · Bastos, Yaoundé_`
}

function msgPaiementConfirme(cmd) {
  return `✅ *Paiement confirmé !*

Bonjour ${cmd.client} 🙏

Votre paiement de *${(cmd.total||0).toLocaleString('fr-FR')} FCFA* a bien été reçu.
Commande : *${cmd.id}*

Votre commande est en cours de préparation 👨‍🍳
Livraison estimée : 30–50 minutes.

_Chez Maman Biya · Bastos, Yaoundé_`
}

// ── Route POST — INTERNE UNIQUEMENT ──────────────────────────────────────────
export async function POST(request) {
  // 🔒 Vérification de la clé interne — bloque tout appel externe
  if (!verifyInternalKey(request)) {
    return NextResponse.json(
      { error: 'Accès refusé — clé interne manquante ou invalide' },
      { status: 403 }
    )
  }

  // C-WA — Retour explicite si WhatsApp non configuré (pas d'erreur 5xx)
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.warn('[WhatsApp] Non configuré — WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID absent du .env')
    return NextResponse.json({ ok: false, raison: 'WhatsApp non configuré' }, { status: 200 })
  }

  try {
    const { type, data } = await request.json()

    if (!type || !data) {
      return NextResponse.json({ error: 'type et data requis' }, { status: 400 })
    }

    const resultats = []

    switch (type) {
      case 'nouvelle_commande':
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA, msgNouvelleCommande(data)))
        if (data.tel)  resultats.push(await envoyerWA(data.tel, msgConfirmationClient(data)))
        break

      case 'assignation_livreur':
        if (data.livreurTel) resultats.push(await envoyerWA(data.livreurTel, msgAssignationLivreur(data)))
        break

      case 'statut_commande':
        if (data.tel) resultats.push(await envoyerWA(data.tel, msgStatutCommande(data, data.nouveauStatut)))
        break

      case 'nouvelle_reservation':
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA, msgNouvelleReservation(data)))
        if (data.tel)  resultats.push(await envoyerWA(data.tel, msgConfirmationReservation(data)))
        break

      case 'paiement_confirme':
        if (data.tel) resultats.push(await envoyerWA(data.tel, msgPaiementConfirme(data)))
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA, `✅ Paiement reçu — ${data.id} — ${(data.total||0).toLocaleString('fr-FR')} FCFA`))
        break

      case 'fidelite_recompense':
        if (data.tel) resultats.push(await envoyerWA(data.tel,
          `🎉 *Chez Maman Biya — Programme Fidélité*\n\nFélicitations ${data.client || ''} ! C'est votre ${data.nbCommandes}ème commande chez nous 🥳\n\nEn remerciement de votre fidélité, vous avez droit à *un dessert offert* sur votre prochaine commande !\n\nMentionnez ce message lors de votre prochaine commande.\n\nMerci de nous faire confiance 🙏\n_Chez Maman Biya_`
        ))
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA,
          `⭐ Fidélité — ${data.client} (${data.tel}) : ${data.nbCommandes}ème commande → dessert offert à notifier`
        ))
        break

      case 'commande_annulee':
        if (data.tel) resultats.push(await envoyerWA(data.tel,
          `❌ *Commande annulée — ${data.id}*\n\nVotre commande a été annulée${data.annulePar === 'staff' ? ' par le restaurant' : ''}.\n\n${data.messageRemb || ''}\n\nPour toute question : +237 677 000 000\n_Chez Maman Biya_`
        ))
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA,
          `❌ Commande annulée — ${data.id} — ${data.client || ''} (${data.tel || ''})${data.rembInfo?.ok === false ? '\n⚠️ REMBOURSEMENT MANUEL REQUIS : ' + (data.total || 0).toLocaleString('fr-FR') + ' FCFA' : ''}`
        ))
        break

      case 'commande_refusee':
        if (data.tel) resultats.push(await envoyerWA(data.tel,
          `⚠️ *Commande refusée — ${data.id}*\n\nNous sommes désolés, nous ne pouvons pas traiter votre commande pour la raison suivante :\n\n*${data.motifRefus || 'Non précisé'}*\n\n${data.messageRemb || ''}\n\nVous pouvez repasser commande sur notre site ou nous appeler au +237 677 000 000.\n\n_Chez Maman Biya_`
        ))
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA,
          `🚫 Commande refusée par ${data.refusePar} — ${data.id} — Motif : ${data.motifRefus}`
        ))
        break

      case 'reservation_confirmee':
        if (data.tel) resultats.push(await envoyerWA(data.tel,
          `✅ *Réservation confirmée — Chez Maman Biya*\n\nBonjour ${data.nom} ! Votre réservation est confirmée :\n\n📅 Date : ${data.date} à ${data.heure}\n👥 ${data.personnes} personne${data.personnes>1?'s':''}\n${data.zone ? `🪑 Espace : ${data.zone === 'vip' ? 'VIP ⭐' : data.zone === 'terrasse' ? 'Terrasse 🌿' : 'Salle 🏠'}\n` : ''}${data.arrhes > 0 && data.arrhesPaie ? `💳 Arrhes reçues : ${data.arrhes.toLocaleString('fr-FR')} FCFA ✓\n` : ''}\nNous vous attendons avec plaisir !\n\nPour annuler (>24h avant) : +237 677 000 000\n_Chez Maman Biya_`
        ))
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA,
          `✅ Réservation confirmée — ${data.id} — ${data.nom} — ${data.date} ${data.heure} — ${data.personnes} pers.${data.zone ? ` — ${data.zone}` : ''}`
        ))
        break

      case 'reservation_annulee':
        if (data.tel) resultats.push(await envoyerWA(data.tel,
          `❌ *Réservation annulée — Chez Maman Biya*\n\nBonjour ${data.nom}, votre réservation du ${data.date} à ${data.heure} a été annulée.\n\n${data.arrhesRembStatut === 'rembourse' ? `💳 Remboursement des arrhes (${data.arrhes?.toLocaleString('fr-FR')} FCFA) en cours — délai 24-72h.` : data.arrhesRembStatut === 'forfait' ? `⚠️ Annulation tardive — les arrhes sont retenues selon nos conditions.` : ''}\n\nPour toute question : +237 677 000 000\n_Chez Maman Biya_`
        ))
        if (RESTO_WA) resultats.push(await envoyerWA(RESTO_WA,
          `❌ Réservation annulée — ${data.id} — ${data.nom} (${data.tel}) — ${data.date} ${data.heure}`
        ))
        break

      default:
        return NextResponse.json({ error: `Type inconnu : ${type}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, resultats })
  } catch (err) {
    console.error('[WhatsApp API]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
