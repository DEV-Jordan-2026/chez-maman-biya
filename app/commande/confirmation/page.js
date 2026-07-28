// @author TSJORDAN - Dev
// app/commande/confirmation/page.js
// Page de retour après paiement CinetPay (paiement complet ou acompte livraison)
// CinetPay redirige ici avec ?id=CMD-XXXXXX

'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams }               from 'next/navigation'
import Link                              from 'next/link'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const commandeId   = searchParams.get('id')

  const [commande, setCommande] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [erreur,   setErreur]   = useState(null)
  const [verifying, setVerifying] = useState(true)

  // C9 — Polling jusqu'à confirmation ou timeout 30 s
  useEffect(() => {
    if (!commandeId) { setErreur('ID de commande manquant'); setLoading(false); setVerifying(false); return }

    let tentatives = 0
    const MAX = 10 // 10 × 3 s = 30 s max

    const verifier = async () => {
      try {
        const r    = await fetch(`/api/suivi/${commandeId}`)
        const data = await r.json()
        if (data.error) { setErreur(data.error); setLoading(false); setVerifying(false); return }
        setCommande(data)
        setLoading(false)
        // Arrêter le polling si paiement complet confirmé OU acompte payé OU timeout
        if (data.paiement === 'cinetpay_confirme' || data.acompteStatut === 'paye' || tentatives >= MAX) {
          setVerifying(false)
          return
        }
        tentatives++
        setTimeout(verifier, 3000)
      } catch {
        setErreur('Impossible de charger la commande')
        setLoading(false)
        setVerifying(false)
      }
    }
    verifier()
  }, [commandeId])

  const style = {
    page: {
      minHeight: '100vh', background: 'var(--ebony)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-dm)', padding: 24,
    },
    card: {
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(201,151,60,.2)',
      borderRadius: 20, padding: '48px 40px',
      textAlign: 'center', maxWidth: 480, width: '100%',
    },
  }

  if (loading) return (
    <div style={style.page}>
      <div style={{ color: '#f5efe6', opacity: .4 }}>Vérification du paiement…</div>
    </div>
  )

  if (erreur || !commande) return (
    <div style={style.page}>
      <div style={style.card}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ color: '#ef4444', fontFamily: 'var(--font-playfair)', fontSize: 24, marginBottom: 12 }}>
          Commande introuvable
        </h1>
        <p style={{ color: 'rgba(245,239,230,.5)', marginBottom: 24 }}>
          {erreur || 'Vérifiez votre référence de commande.'}
        </p>
        <Link href="/commande" style={{
          background: 'var(--gold)', color: '#fff', textDecoration: 'none',
          padding: '12px 28px', borderRadius: 8, fontSize: 13, fontWeight: 700,
        }}>
          Retour à la commande
        </Link>
      </div>
    </div>
  )

  // ── Déterminer le type de confirmation ───────────────────────────────────
  const estPaiementComplet = commande.paiement === 'cinetpay_confirme'
  const estAcompte         = commande.acompteStatut === 'paye' && !estPaiementComplet

  const couleur   = (estPaiementComplet || estAcompte) ? '#10b981' : '#f59e0b'
  const icone     = (estPaiementComplet || estAcompte) ? '✅' : '⏳'

  const titre = estAcompte
    ? 'Acompte confirmé !'
    : estPaiementComplet
      ? 'Paiement confirmé !'
      : 'Commande reçue'

  const sousTitre = estAcompte
    ? `Votre acompte Mobile Money a bien été reçu. Votre commande est en préparation.`
    : estPaiementComplet
      ? 'Votre paiement Mobile Money a bien été reçu.'
      : 'Votre commande a été enregistrée. Le paiement sera confirmé sous peu.'

  return (
    <div style={style.page}>
      <div style={style.card}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>{icone}</div>

        <h1 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 28, fontWeight: 900, color: couleur, marginBottom: 12,
        }}>
          {titre}
        </h1>

        <p style={{ color: 'rgba(245,239,230,.6)', lineHeight: 1.7, marginBottom: 24 }}>
          {sousTitre}
        </p>

        {/* M5 — Indicateur de vérification webhook (2–10 s après redirection) */}
        {verifying && !estPaiementComplet && !estAcompte && (
          <div style={{ fontSize: 12, color: '#F59E0B', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>⏳</span> Vérification du paiement en cours…
          </div>
        )}

        {/* Référence */}
        <div style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(201,151,60,.15)',
          borderRadius: 10, padding: '14px 20px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, opacity: .4, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            Référence commande
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)' }}>
            {commande.id}
          </div>
        </div>

        {/* Détails paiement */}
        <div style={{ textAlign: 'left', marginBottom: 20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, opacity:.6, marginBottom:8 }}>
            <span>Mode</span><span>{commande.mode}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, opacity:.6, marginBottom:8 }}>
            <span>Total commande</span>
            <span style={{ color:'var(--gold)', fontWeight:800 }}>
              {(commande.total||0).toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          {/* v22 — Ligne acompte + reste (uniquement si acompte requis/payé) */}
          {commande.acompte > 0 && (
            <>
              <div style={{
                display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4,
                color: estAcompte ? '#10b981' : 'rgba(245,239,230,.5)',
              }}>
                <span>Acompte Mobile Money</span>
                <span style={{ fontWeight:700 }}>
                  {estAcompte ? '✓ ' : ''}{(commande.acompte||0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div style={{
                display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8,
                color: 'rgba(245,239,230,.7)',
              }}>
                <span>À régler au livreur</span>
                <span style={{ fontWeight:700, color:'var(--gold)' }}>
                  {(commande.resteARegler||0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              {/* Rappel visuel "reste à payer" */}
              {estAcompte && commande.resteARegler > 0 && (
                <div style={{
                  background: 'rgba(245,158,11,.08)',
                  border: '1px solid rgba(245,158,11,.25)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12,
                  color: '#f59e0b', marginTop: 4,
                }}>
                  💵 Préparez {(commande.resteARegler||0).toLocaleString('fr-FR')} FCFA en espèces pour le livreur.
                </div>
              )}
            </>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, opacity:.6, marginTop:8 }}>
            <span>Statut</span>
            <span style={{
              background: 'rgba(16,185,129,.12)', color: '#10b981',
              padding: '2px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            }}>
              {commande.status === 'nouveau' ? '⏳ En préparation' : commande.status}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 12, opacity: .35, marginBottom: 24, lineHeight: 1.6 }}>
          Vous recevrez une confirmation WhatsApp. Temps de livraison estimé : 30–50 min.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={`/suivi?id=${commande.id}`} style={{
            background: 'rgba(201,151,60,.12)',
            border: '1px solid rgba(201,151,60,.3)',
            color: 'var(--gold)', textDecoration: 'none',
            padding: '11px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          }}>
            Suivre ma commande
          </Link>
          <Link href="/" style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.1)',
            color: 'rgba(245,239,230,.6)', textDecoration: 'none',
            padding: '11px 22px', borderRadius: 8, fontSize: 13,
          }}>
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'var(--ebony)', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(245,239,230,.3)' }}>
        Chargement…
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
