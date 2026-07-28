// @author TSJORDAN - Dev
'use client'
// app/facture/verify/page.js
// Page publique — s'ouvre quand le client scanne le QR code de sa facture.
// Affiche : ✅ Authentique ou ❌ Invalide + détails de la transaction.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams }               from 'next/navigation'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatMontant(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR') + ' FCFA'
}

const PAIEMENT_LABELS = {
  especes:    'Espèces',
  mtn:        'MTN Mobile Money',
  mtn_paye:   'MTN Mobile Money',
  orange:     'Orange Money',
  orange_paye:'Orange Money',
  cinetpay:   'CinetPay',
  livraison:  'Espèces à la livraison',
  resto:      'Paiement au restaurant',
}

// ── Composant interne (lit les searchParams) ──────────────────────────────────
function VerifyContent() {
  const searchParams = useSearchParams()
  const id   = searchParams.get('id')
  const hash = searchParams.get('h')

  const [state, setState] = useState('loading') // 'loading' | 'valid' | 'invalid' | 'error'
  const [data,  setData]  = useState(null)
  const [msg,   setMsg]   = useState('')

  useEffect(() => {
    if (!id || !hash) {
      setState('error')
      setMsg('Lien QR incomplet ou corrompu.')
      return
    }

    fetch(`/api/facture/verify?id=${encodeURIComponent(id)}&h=${encodeURIComponent(hash)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          setState('valid')
          setData(d)
        } else {
          setState('invalid')
          setMsg(d.error || 'Signature invalide')
        }
      })
      .catch(() => {
        setState('error')
        setMsg('Impossible de joindre le serveur. Vérifiez votre connexion.')
      })
  }, [id, hash])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const page = {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#f5efe6',
    fontFamily: "'Inter', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px 48px',
  }

  const card = {
    width: '100%',
    maxWidth: 420,
    background: '#12121a',
    border: '1px solid rgba(201,151,60,.2)',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 16,
  }

  const row = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '10px 20px',
    borderBottom: '1px solid rgba(255,255,255,.04)',
    fontSize: 14,
  }

  // ── Rendu loading ──────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={page}>
        <div style={{ marginTop: 80, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            border: '4px solid rgba(201,151,60,.2)',
            borderTopColor: '#C9973C',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(245,239,230,.5)', fontSize: 14 }}>Vérification en cours…</p>
        </div>
      </div>
    )
  }

  // ── Rendu invalide / erreur ────────────────────────────────────────────────
  if (state === 'invalid' || state === 'error') {
    return (
      <div style={page}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 32 }}>🍲</div>
          <div style={{ fontSize: 13, color: 'rgba(245,239,230,.4)', marginTop: 4 }}>
            Chez Maman Biya
          </div>
        </div>

        <div style={{ ...card, borderColor: 'rgba(239,68,68,.3)' }}>
          <div style={{
            background: 'rgba(239,68,68,.08)',
            padding: '28px 20px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(239,68,68,.15)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#ef4444', marginBottom: 6 }}>
              {state === 'error' ? 'Erreur de vérification' : 'Document non valide'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(239,68,68,.8)', lineHeight: 1.6 }}>
              {msg}
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: 'rgba(245,239,230,.4)', lineHeight: 1.7, textAlign: 'center' }}>
              Si vous pensez qu'il s'agit d'une erreur, contactez le restaurant
              directement avec votre numéro de commande.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Rendu valide ───────────────────────────────────────────────────────────
  const { restaurant, numeroFacture, date, total, paiement, mode } = data

  return (
    <div style={page}>
      {/* Logo restaurant */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 36 }}>🍲</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#f5efe6', marginTop: 4 }}>
          {restaurant.nom}
        </div>
        {restaurant.adresse && (
          <div style={{ fontSize: 11, color: 'rgba(245,239,230,.4)', marginTop: 2 }}>
            📍 {restaurant.adresse}
          </div>
        )}
      </div>

      {/* Badge authentique */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(16,185,129,.1)',
        border: '1px solid rgba(16,185,129,.35)',
        borderRadius: 50,
        padding: '10px 22px',
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#10b981' }}>
            Facture authentique
          </div>
          <div style={{ fontSize: 11, color: 'rgba(16,185,129,.7)', marginTop: 1 }}>
            Signature vérifiée · Document fiscal valide
          </div>
        </div>
      </div>

      {/* Carte principale */}
      <div style={card}>

        {/* Numéro + date */}
        <div style={{
          background: 'rgba(201,151,60,.06)',
          borderBottom: '1px solid rgba(201,151,60,.15)',
          padding: '16px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1.5, marginBottom: 4 }}>
            NUMÉRO DE FACTURE
          </div>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#C9973C', letterSpacing: 1 }}>
            {numeroFacture}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,239,230,.45)', marginTop: 4 }}>
            {formatDate(date)}
          </div>
        </div>

        {/* Détails */}
        <div>
          <div style={row}>
            <span style={{ color: 'rgba(245,239,230,.45)' }}>Montant total</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#C9973C' }}>
              {formatMontant(total)}
            </span>
          </div>
          <div style={row}>
            <span style={{ color: 'rgba(245,239,230,.45)' }}>Mode de commande</span>
            <span style={{ fontWeight: 600 }}>{mode || '—'}</span>
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={{ color: 'rgba(245,239,230,.45)' }}>Paiement</span>
            <span style={{ fontWeight: 600 }}>
              {PAIEMENT_LABELS[paiement] || paiement || '—'}
            </span>
          </div>
        </div>

        {/* Infos fiscales si disponibles */}
        {(restaurant.niu || restaurant.rccm) && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,.06)',
            padding: '12px 20px',
            background: 'rgba(0,0,0,.15)',
          }}>
            <div style={{
              fontSize: 9, color: 'rgba(245,239,230,.3)',
              letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase',
            }}>
              Informations fiscales
            </div>
            {restaurant.niu && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'rgba(245,239,230,.4)' }}>NIU</span>
                <span style={{ fontFamily: 'monospace', color: 'rgba(245,239,230,.7)' }}>
                  {restaurant.niu}
                </span>
              </div>
            )}
            {restaurant.rccm && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'rgba(245,239,230,.4)' }}>RCCM</span>
                <span style={{ fontFamily: 'monospace', color: 'rgba(245,239,230,.7)' }}>
                  {restaurant.rccm}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact */}
      {restaurant.tel && (
        <a
          href={`tel:${restaurant.tel}`}
          style={{
            marginTop: 16,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(6,182,212,.08)',
            border: '1px solid rgba(6,182,212,.25)',
            borderRadius: 10,
            padding: '10px 20px',
            color: '#06b6d4',
            textDecoration: 'none',
            fontSize: 13, fontWeight: 600,
          }}
        >
          📞 Contacter le restaurant
        </a>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 28,
        fontSize: 11,
        color: 'rgba(245,239,230,.2)',
        textAlign: 'center',
        lineHeight: 1.7,
        maxWidth: 320,
      }}>
        Ce document est certifié par le système de caisse CMB.<br />
        La signature cryptographique garantit son authenticité.
      </div>
    </div>
  )
}

// ── Export principal — Suspense requis par useSearchParams ────────────────────
export default function FactureVerifyPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'rgba(245,239,230,.4)', fontSize: 14 }}>Chargement…</div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
