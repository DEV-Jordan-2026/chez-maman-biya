// @author TSJORDAN - Dev
'use client'
// app/suivi/page.js
// Utilise GET /api/suivi/[id] — endpoint PUBLIC avec champs filtrés
// (ne plus appeler GET /api/commandes qui est protégé)

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams }               from 'next/navigation'
import Link   from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const STATUS_INFO = {
  nouveau        : { label: 'Commande reçue',   emoji: '📥', color: '#3b82f6', step: 1, desc: "Votre commande a été reçue et va être transmise en cuisine." },
  en_cours       : { label: 'En préparation',   emoji: '👨‍🍳', color: '#f59e0b', step: 2, desc: 'Nos cuisiniers préparent vos plats avec soin.' },
  en_preparation : { label: 'En préparation',   emoji: '👨‍🍳', color: '#f59e0b', step: 2, desc: 'Nos cuisiniers préparent vos plats avec soin.' },
  pret           : { label: 'Prêt !',            emoji: '✅', color: '#10b981', step: 3, desc: 'Votre commande est prête. Le livreur part bientôt.' },
  en_livraison   : { label: 'En route',          emoji: '🛵', color: '#8b5cf6', step: 3, desc: 'Votre livreur est en chemin vers vous !' },
  livre          : { label: 'Livré / Récupéré', emoji: '🎉', color: '#8b5cf6', step: 4, desc: "Bon appétit ! Merci d'avoir choisi Chez Maman Biya." },
}

const ETAPES = [
  { key: 'nouveau',  label: 'Reçue',       emoji: '📥' },
  { key: 'en_cours', label: 'Cuisine',     emoji: '👨‍🍳' },
  { key: 'pret',     label: 'Prête',       emoji: '✅' },
  { key: 'livre',    label: 'Livrée',      emoji: '🎉' },
]

function SuiviContent() {
  const searchParams = useSearchParams()
  const refParam = searchParams.get('ref') || searchParams.get('id') || ''
  const [numero,   setNumero]   = useState(refParam.toUpperCase())
  const [commande, setCommande] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [erreur,   setErreur]   = useState('')
  const [annulModal,  setAnnulModal]  = useState(false)
  const [annulTel,    setAnnulTel]    = useState('')
  const [annulBusy,   setAnnulBusy]   = useState(false)
  const [annulResult, setAnnulResult] = useState(null)

  // Auto-chercher si ref ou id est en query param
  useEffect(() => {
    const q = (searchParams.get('ref') || searchParams.get('id') || '').toUpperCase()
    if (q) chercher(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // v29 — Rafraîchissement automatique tant que la commande n'est pas terminée
  useEffect(() => {
    if (!commande || ['livre', 'annule'].includes(commande.status)) return
    const iv = setInterval(async () => {
      try {
        const res  = await fetch(`/api/suivi/${encodeURIComponent(commande.id)}`)
        const data = await res.json()
        if (res.ok) setCommande(data)
      } catch {
        // silencieux — on retentera au prochain intervalle
      }
    }, 15_000)
    return () => clearInterval(iv)
  }, [commande?.id, commande?.status])

  async function chercher(id) {
    const q = (id || numero).trim().toUpperCase()
    if (!q) return
    setLoading(true)
    setErreur('')
    setCommande(null)
    try {
      const res  = await fetch(`/api/suivi/${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) {
        setErreur(data.error || 'Commande introuvable. Vérifiez le numéro.')
      } else {
        setCommande(data)
      }
    } catch {
      setErreur('Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  async function annulerCommande() {
    if (!commande || !annulTel.trim()) return
    setAnnulBusy(true)
    setErreur('')
    try {
      const res  = await fetch(`/api/commandes/${commande.id}/annuler`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tel: annulTel.trim(), motif: 'Annulation client via suivi' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErreur(data.error || 'Annulation impossible')
      } else {
        setAnnulResult(data)
        setCommande(prev => ({ ...prev, status: 'annule', rembStatut: data.rembStatut, rembMontant: data.rembMontant }))
      }
      setAnnulModal(false)
    } catch {
      setErreur('Erreur de connexion. Réessayez.')
    }
    setAnnulBusy(false)
  }

  const s = commande ? (STATUS_INFO[commande.status] || STATUS_INFO.nouveau) : null

  return (
    <div style={{ background: 'var(--ebony)', minHeight: '100vh', color: '#f5efe6', fontFamily: 'var(--font-dm)' }}>
      <Navbar />

      {/* Header */}
      <div style={{
        padding: '140px 24px 48px', textAlign: 'center',
        borderBottom: '1px solid rgba(201,151,60,0.1)',
        background: 'radial-gradient(ellipse at 50% 30%,rgba(201,151,60,.06) 0%,transparent 70%)',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', opacity: .35, marginBottom: 12 }}>
          Suivi de commande
        </div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>
          Où en est ma commande ? 📦
        </h1>
        <p style={{ fontSize: 14, opacity: .45, maxWidth: 420, margin: '0 auto' }}>
          Entrez votre numéro (ex : CMD-A1B2C3D4) pour suivre en temps réel.
        </p>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>

        {/* Recherche */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          <input
            type="text"
            value={numero}
            onChange={e => setNumero(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && chercher()}
            placeholder="CMD-XXXXXXXX"
            style={{
              flex: 1, padding: '14px 18px',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(201,151,60,.25)',
              borderRadius: 10, color: '#f5efe6',
              fontSize: 16, fontWeight: 600, letterSpacing: 2,
              outline: 'none', fontFamily: 'var(--font-dm)',
              textTransform: 'uppercase',
            }}
          />
          <button
            onClick={() => chercher()}
            disabled={loading || !numero.trim()}
            style={{
              padding: '14px 20px', borderRadius: 10, border: 'none',
              background: (!numero.trim() || loading) ? 'rgba(201,151,60,.3)' : 'linear-gradient(135deg,var(--gold),#a85f28)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: (!numero.trim() || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳' : '🔍'}
          </button>
        </div>

        {/* Erreur */}
        {erreur && (
          <div style={{
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 10, padding: '14px 18px', color: '#fca5a5', fontSize: 14, marginBottom: 24,
          }}>
            ⚠️ {erreur}
          </div>
        )}

        {/* Résultat */}
        {commande && s && (
          <div style={{
            background: 'rgba(255,255,255,.025)',
            border: `1px solid ${s.color}30`,
            borderRadius: 18, padding: '28px 24px',
          }}>
            {/* Barre de progression */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                {ETAPES.map((e, i) => {
                  const info  = STATUS_INFO[e.key] || STATUS_INFO.nouveau
                  const done  = info.step <= s.step
                  const actif = info.step === s.step
                  return (
                    <div key={e.key} style={{ flex: 1, textAlign: 'center', opacity: done ? 1 : .25 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', margin: '0 auto 6px',
                        background: done ? `${info.color}25` : 'rgba(255,255,255,.05)',
                        border: `2px solid ${done ? info.color : 'rgba(255,255,255,.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700,
                      }}>
                        {done && !actif ? '✓' : e.emoji}
                      </div>
                      <div style={{ fontSize: 9, letterSpacing: .5, opacity: .7 }}>{e.label}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: s.color,
                  width: `${((s.step - 1) / 3) * 100}%`,
                  transition: 'width .5s ease',
                }} />
              </div>
            </div>

            {/* Statut */}
            <div style={{
              background: `${s.color}10`, border: `1px solid ${s.color}25`,
              borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 13, opacity: .55 }}>{s.desc}</div>
              {!['livre', 'annule'].includes(commande.status) && (
                <div style={{ fontSize: 10, opacity: .35, marginTop: 8, letterSpacing: .3 }}>
                  🔄 Cette page se met à jour automatiquement
                </div>
              )}
            </div>

            {/* Détails — champs non sensibles uniquement */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="N° commande" value={commande.id}    accent />
              <Row label="Mode"        value={commande.mode} />
              <Row label="Total"       value={`${(commande.total || 0).toLocaleString('fr-FR')} FCFA`} accent />
              <Row label="Commandé"    value={commande.createdAt ? new Date(commande.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'} />
            </div>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '237677000000')}?text=Bonjour,%20je%20veux%20un%20update%20sur%20ma%20commande%20${commande.id}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'block', marginTop: 20, textAlign: 'center',
                background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.2)',
                borderRadius: 10, padding: '12px', color: '#25D366',
                textDecoration: 'none', fontSize: 13, fontWeight: 600,
              }}
            >
              📱 Contacter le restaurant sur WhatsApp
            </a>

            {/* Résultat annulation */}
            {annulResult && (
              <div style={{ marginTop: 16, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', marginBottom: 8 }}>❌ Commande annulée</div>
                {annulResult.messageRemb && <div style={{ fontSize: 13, opacity: .7, lineHeight: 1.6 }}>{annulResult.messageRemb}</div>}
                {annulResult.rembStatut === 'rembourse' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#10b981' }}>
                    ✅ Remboursement de {annulResult.rembMontant?.toLocaleString('fr-FR')} FCFA initié — délai 24-72h sur votre Mobile Money.
                  </div>
                )}
                {annulResult.rembStatut === 'echec' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b' }}>
                    ⚠️ Le restaurant vous contactera pour le remboursement manuel.
                  </div>
                )}
              </div>
            )}

            {/* Bouton annulation — seulement si commande non annulée/livrée */}
            {commande && !['annule', 'livre'].includes(commande.status) && !annulResult && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => setAnnulModal(true)}
                  style={{ width: '100%', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px', color: 'rgba(239,68,68,.8)', fontSize: 12, cursor: 'pointer' }}
                >
                  ✕ Annuler ma commande
                </button>
                <div style={{ fontSize: 10, opacity: .3, textAlign: 'center', marginTop: 6 }}>
                  Annulation possible dans les 10 minutes après commande uniquement
                </div>
              </div>
            )}

            {/* Modale annulation */}
            {annulModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                   onClick={e => e.target === e.currentTarget && setAnnulModal(false)}>
                <div style={{ background: '#141008', border: '1px solid rgba(239,68,68,.3)', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#ef4444', marginBottom: 8 }}>✕ Annuler la commande</div>
                  <div style={{ fontSize: 13, opacity: .6, marginBottom: 18, lineHeight: 1.6 }}>
                    Pour confirmer votre identité, entrez le numéro de téléphone utilisé lors de la commande.
                    <br /><strong style={{ color: '#f59e0b' }}>⚠️ Annulation possible dans les 10 premières minutes uniquement.</strong>
                  </div>
                  <input
                    type="tel"
                    value={annulTel}
                    onChange={e => setAnnulTel(e.target.value)}
                    placeholder="+237 6XX XXX XXX"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#f5efe6', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', marginBottom: 16 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setAnnulModal(false)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(201,151,60,.2)', color: 'rgba(245,239,230,.4)', padding: 10, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Retour</button>
                    <button onClick={annulerCommande} disabled={annulBusy || !annulTel.trim()} style={{ flex: 2, background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: annulBusy ? 'default' : 'pointer', opacity: !annulTel.trim() ? .5 : 1 }}>
                      {annulBusy ? '⏳ Annulation…' : '✕ Confirmer l\'annulation'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!commande && !erreur && (
          <div style={{ textAlign: 'center', opacity: .3, fontSize: 13, marginTop: 40, lineHeight: 1.8 }}>
            <p>💡 Votre numéro de commande vous a été communiqué lors de la confirmation.</p>
            <p style={{ marginTop: 8 }}>
              Besoin d'aide ?{' '}
              <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '237677000000'}`} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--gold)', textDecoration: 'none' }}>
                WhatsApp
              </a>
            </p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ opacity: .4 }}>{label}</span>
      <span style={{ fontWeight: accent ? 700 : 500, color: accent ? 'var(--gold)' : '#f5efe6' }}>{value}</span>
    </div>
  )
}

export default function SuiviPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--ebony)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(245,239,230,.3)' }}>
        Chargement…
      </div>
    }>
      <SuiviContent />
    </Suspense>
  )
}
