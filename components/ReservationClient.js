'use client'
// components/ReservationClient.js — v11
// Animations : scroll reveal, step transitions, focus states, feedback bouton

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CRENEAUX = [
  '11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30',
  '18:00','18:30','19:00','19:30',
  '20:00','20:30','21:00','21:30',
]

function validerTel(tel) {
  const clean = tel.replace(/[\s\-()]/g, '')
  // Cameroun (défaut) : 6XX XXX XXX ou +237 6XX XXX XXX
  const isCM   = /^(\+?237)?[679]\d{7}$/.test(clean)
  // International (touristes) : +XX... format E.164
  const isIntl = /^\+[1-9]\d{5,14}$/.test(clean)
  return isCM || isIntl
}

// ── Scroll reveal hook ────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect() }
    }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, vis]
}

function Reveal({ children, delay = 0 }) {
  const [ref, vis] = useScrollReveal()
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'none' : 'translateY(22px)',
      transition: `opacity .6s ${delay}s ease, transform .6s ${delay}s cubic-bezier(.22,1,.36,1)`,
    }}>
      {children}
    </div>
  )
}

export default function ReservationClient() {
  const router = useRouter()

  // Retour intelligent : revient à la page précédente (accueil OU menu,
  // selon l'origine de navigation) plutôt que de forcer systématiquement /.
  // Repli sur / si aucun historique (accès direct / nouvel onglet).
  const handleRetour = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const [form, setForm] = useState({
    nom:'', tel:'', date:'', heure:'', personnes:2, zone:'salle', note:'',
  })
  const [loading,     setLoading]     = useState(false)
  const [erreur,      setErreur]      = useState('')
  const [telErreur,   setTelErreur]   = useState('')
  const [confirmation,setConfirmation]= useState(null)
  const [focused,     setFocused]     = useState(null)
  const [btnPulse,    setBtnPulse]    = useState(false) // feedback clic
  const [heroVis,     setHeroVis]     = useState(false)
  // Paramètres arrhes — lus depuis l'API au montage, fallback sur les valeurs par défaut
  const [paramsArrhes, setParamsArrhes] = useState({
    arrhes_vip:             5000,
    arrhes_groupe:          10000,
    arrhes_seuil_personnes: 8,
    arrhes_standard:        0,
  })

  const today = new Date().toISOString().split('T')[0]
  const maxDate = new Date(); maxDate.setFullYear(maxDate.getFullYear() + 3)
  const dateMax = maxDate.toISOString().split('T')[0]

  useEffect(() => { setTimeout(() => setHeroVis(true), 60) }, [])

  // Charger les paramètres arrhes depuis l'API publique
  useEffect(() => {
    fetch('/api/parametres/public')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setParamsArrhes({
          arrhes_vip:             Number(data.arrhes_vip)             || 5000,
          arrhes_groupe:          Number(data.arrhes_groupe)          || 10000,
          arrhes_seuil_personnes: Number(data.arrhes_seuil_personnes) || 8,
          arrhes_standard:        Number(data.arrhes_standard)        || 0,
        })
      })
      .catch(() => { /* fallback silencieux sur les valeurs par défaut */ })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Calcul des arrhes selon les paramètres admin
  // Priorité : groupe (≥ seuil, toutes zones) > VIP > Salle/Terrasse standard
  const seuil     = paramsArrhes.arrhes_seuil_personnes
  const estGroupe = form.personnes >= seuil
  const estVip    = form.zone === 'vip'

  const montantArrhes = estGroupe
    ? paramsArrhes.arrhes_groupe
    : estVip
      ? paramsArrhes.arrhes_vip
      : paramsArrhes.arrhes_standard

  const arrheRequises = montantArrhes > 0

  const valid = form.nom.trim() && form.tel.trim()
    && form.date && form.heure && form.personnes >= 1

  const soumettre = useCallback(async () => {
    if (!valid || loading) return
    if (!validerTel(form.tel)) {
      setTelErreur('Numéro invalide — Ex : +237 677 123 456 (Cameroun) ou +33 6 12 34 56 78 (étranger)')
      return
    }
    setTelErreur('')
    setErreur('')

    // Feedback visuel immédiat
    setBtnPulse(true)
    setTimeout(() => setBtnPulse(false), 400)

    setLoading(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom.trim(), tel: form.tel.trim(),
          date: form.date, heure: form.heure,
          personnes: form.personnes, zone: form.zone,
          note: form.note.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErreur(data.error || 'Erreur lors de la réservation'); return }

      if (arrheRequises) {
        const payRes  = await fetch(`/api/reservations/${data.id}/arrhes`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'initier' }),
        })
        const payData = await payRes.json()
        if (payData.paymentUrl) { window.location.href = payData.paymentUrl; return }
        setConfirmation({ ...data, ...form, arrhes: montantArrhes, arrhesPaie: !!payData.demo })
      } else {
        setConfirmation({ ...data, ...form, arrhes: 0 })
      }
    } catch { setErreur('Problème de connexion. Veuillez réessayer.')
    } finally { setLoading(false) }
  }, [valid, loading, form, arrheRequises, montantArrhes])

  if (confirmation) return <EcranConfirmation c={confirmation} />

  // Styles input avec focus dynamique
  const I = (name) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px',
    background:   focused === name ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)',
    border: `1px solid ${
      (name === 'tel' && telErreur) ? 'rgba(239,68,68,.5)' :
      focused === name ? 'rgba(201,151,60,.65)' : 'rgba(201,151,60,.22)'
    }`,
    borderRadius: 10, color: 'var(--cream)',
    fontSize: 14, outline: 'none',
    fontFamily: 'var(--font-dm)',
    boxShadow: focused === name ? '0 0 0 3px rgba(201,151,60,.1)' : 'none',
    transition: 'border-color .18s, background .18s, box-shadow .18s',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ebony)',
      color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      paddingTop: 80,
    }}>

      {/* ── Hero ── */}
      <div style={{
        padding: '48px 24px 40px', textAlign: 'center',
        borderBottom: '1px solid rgba(201,151,60,.1)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(201,151,60,.07) 0%, transparent 65%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Fond image floutée */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=60')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'brightness(.07) saturate(.5)',
          pointerEvents: 'none',
        }} />
        <button onClick={handleRetour} style={{
          position: 'fixed', top: 16, left: 16, zIndex: 60,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--cream-dim)', background: 'var(--ebony-1)',
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
          fontSize: 13, padding: '6px 10px', borderRadius: 8,
          border: '1px solid rgba(201,151,60,0.2)',
          cursor: 'pointer', font: 'inherit',
        }}>
          ← Retour
        </button>
        <div style={{ position: 'relative' }}>
          <div style={{
            fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
            opacity: heroVis ? .38 : 0, marginBottom: 14,
            transition: 'opacity .6s .05s ease',
          }}>
            Réservation en ligne
          </div>
          <h1 style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: 'clamp(26px, 4.5vw, 42px)',
            fontWeight: 700, color: 'var(--gold)',
            margin: '0 0 12px',
            opacity: heroVis ? 1 : 0,
            transform: heroVis ? 'none' : 'translateY(18px)',
            transition: 'opacity .7s .12s, transform .7s .12s cubic-bezier(.22,1,.36,1)',
          }}>
            Réserver une table
          </h1>
          <p style={{
            opacity: heroVis ? .42 : 0,
            fontSize: 14, maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.7,
            transform: heroVis ? 'none' : 'translateY(12px)',
            transition: 'opacity .7s .22s, transform .7s .22s cubic-bezier(.22,1,.36,1)',
          }}>
            Confirmation WhatsApp immédiate · Aucun appel nécessaire
          </p>

          {/* Indicateurs de confiance */}
          <div style={{
            display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap',
            opacity: heroVis ? 1 : 0,
            transition: 'opacity .7s .34s ease',
          }}>
            {[
              { icon: '📅', label: 'Réservation gratuite' },
              { icon: '💬', label: 'Confirmation WhatsApp' },
              { icon: '✏️', label: 'Modifiable jusqu\'à J-1' },
            ].map(b => (
              <div key={b.label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, opacity: .55,
              }}>
                <span>{b.icon}</span>{b.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* ── Formulaire card ── */}
        <Reveal>
          <div style={{
            background: 'var(--ebony-2)',
            border: '1px solid rgba(201,151,60,.15)',
            borderRadius: 20, padding: '32px 28px',
            display: 'flex', flexDirection: 'column', gap: 22,
          }}>

            {/* Nom */}
            <div>
              <label style={L}>Votre nom complet *</label>
              <input type="text" value={form.nom}
                onChange={e => set('nom', e.target.value)}
                onFocus={() => setFocused('nom')}
                onBlur={() => setFocused(null)}
                placeholder="Ex : Marie Essono"
                style={I('nom')} />
            </div>

            {/* Téléphone */}
            <div>
              <label style={L}>Numéro de téléphone *</label>
              <input type="tel" value={form.tel}
                onChange={e => { set('tel', e.target.value); if (telErreur) setTelErreur('') }}
                onFocus={() => setFocused('tel')}
                onBlur={() => setFocused(null)}
                placeholder="+237 6XX XXX XXX ou +33 6 12 34 56 78"
                style={I('tel')} />
              {telErreur
                ? <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 5 }}>⚠️ {telErreur}</div>
                : <div style={{ fontSize: 11, opacity: .3, marginTop: 5 }}>Confirmation envoyée par WhatsApp</div>
              }
            </div>

            {/* Date + Heure */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={L}>Date *</label>
                <input type="date" value={form.date} min={today} max={dateMax}
                  onChange={e => set('date', e.target.value)}
                  onFocus={() => setFocused('date')}
                  onBlur={() => setFocused(null)}
                  style={{ ...I('date'), colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={L}>Heure *</label>
                <select value={form.heure}
                  onChange={e => set('heure', e.target.value)}
                  onFocus={() => setFocused('heure')}
                  onBlur={() => setFocused(null)}
                  style={{ ...I('heure'), appearance: 'none', colorScheme: 'dark', cursor: 'pointer',
                    background: focused === 'heure' ? 'rgba(20,16,8,.98)' : 'rgba(16,12,6,.95)' }}>
                  <option value="">Choisir…</option>
                  {CRENEAUX.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            {/* Personnes */}
            <div>
              <label style={L}>Nombre de personnes *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
                <button onClick={() => form.personnes > 1 && set('personnes', form.personnes - 1)}
                  disabled={form.personnes <= 1}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: '1px solid rgba(201,151,60,.35)',
                    background: 'rgba(201,151,60,.08)',
                    color: 'var(--gold)', fontSize: 22, fontWeight: 700,
                    cursor: form.personnes > 1 ? 'pointer' : 'not-allowed',
                    opacity: form.personnes > 1 ? 1 : .3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity .18s, transform .15s',
                  }}
                  onMouseDown={e => form.personnes > 1 && (e.currentTarget.style.transform = 'scale(.9)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >−</button>

                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div key={form.personnes} style={{
                    fontSize: 32, fontWeight: 900, color: 'var(--gold)', lineHeight: 1,
                    animation: 'countUp .22s cubic-bezier(.22,1,.36,1)',
                  }}>
                    {form.personnes}
                  </div>
                  <div style={{ fontSize: 11, opacity: .35, marginTop: 2 }}>
                    {form.personnes === 1 ? 'personne' : 'personnes'}
                  </div>
                </div>

                <button onClick={() => form.personnes < 20 && set('personnes', form.personnes + 1)}
                  disabled={form.personnes >= 20}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: 'none', background: 'var(--gold)',
                    color: '#fff', fontSize: 22, fontWeight: 700,
                    cursor: form.personnes < 20 ? 'pointer' : 'not-allowed',
                    opacity: form.personnes < 20 ? 1 : .3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity .18s, transform .15s',
                    boxShadow: '0 4px 12px rgba(201,151,60,.3)',
                  }}
                  onMouseDown={e => form.personnes < 20 && (e.currentTarget.style.transform = 'scale(.9)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >+</button>
              </div>
              {form.personnes > 10 && (
                <div style={{
                  fontSize: 12, color: '#f59e0b', marginTop: 8, opacity: .85,
                  animation: 'fadeIn .3s ease',
                }}>
                  ⚠️ Pour plus de 10 personnes, nous vous recommandons d'appeler directement.
                </div>
              )}
            </div>

            {/* Zone */}
            <div>
              <label style={L}>Espace souhaité</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
                {[
                  { id: 'salle',    icon: '🏠', label: 'Salle',    sub: 'Climatisé' },
                  { id: 'terrasse', icon: '🌿', label: 'Terrasse', sub: 'Ombragé' },
                  { id: 'vip',      icon: '⭐', label: 'VIP',      sub: 'Privé' },
                ].map(z => (
                  <button key={z.id} onClick={() => set('zone', z.id)} style={{
                    padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${form.zone === z.id ? 'var(--gold)' : 'rgba(201,151,60,.18)'}`,
                    background: form.zone === z.id ? 'rgba(201,151,60,.1)' : 'rgba(255,255,255,.02)',
                    color: form.zone === z.id ? 'var(--cream)' : 'var(--cream-faint)',
                    textAlign: 'center',
                    transform: form.zone === z.id ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: form.zone === z.id ? '0 4px 16px rgba(201,151,60,.2)' : 'none',
                    transition: 'all .2s cubic-bezier(.22,1,.36,1)',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{z.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: form.zone === z.id ? 700 : 400 }}>{z.label}</div>
                    <div style={{ fontSize: 10, opacity: .4, marginTop: 2 }}>{z.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label style={L}>
                Demandes spéciales{' '}
                <span style={{ opacity: .35, textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
              </label>
              <textarea value={form.note}
                onChange={e => set('note', e.target.value)}
                onFocus={() => setFocused('note')}
                onBlur={() => setFocused(null)}
                placeholder="Anniversaire, allergies, chaise bébé…"
                rows={3}
                style={{ ...I('note'), resize: 'vertical' }} />
            </div>

            {/* Erreur API */}
            {erreur && (
              <div style={{
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
                borderRadius: 10, padding: '12px 16px', color: '#fca5a5', fontSize: 13,
                animation: 'scaleIn .22s cubic-bezier(.22,1,.36,1)',
              }}>
                ⚠️ {erreur}
              </div>
            )}

            {/* Info arrhes */}
            {arrheRequises && (
              <div style={{
                background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.28)',
                borderRadius: 12, padding: '14px 16px', fontSize: 12, lineHeight: 1.6,
                animation: 'fadeIn .35s ease',
              }}>
                <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>
                  💳 Arrhes requises : {montantArrhes.toLocaleString('fr-FR')} FCFA
                </div>
                <div style={{ opacity: .65 }}>
                  {estGroupe
                    ? `Les réservations de ${seuil} personnes et plus`
                    : estVip
                      ? 'Les réservations VIP'
                      : 'Cette réservation'
                  } nécessitent des arrhes.<br />
                  • Annulation &gt;24h : remboursement intégral<br />
                  • Annulation &lt;24h ou no-show : arrhes retenues
                </div>
              </div>
            )}

            {!arrheRequises && form.date && (
              <div style={{
                background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)',
                borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#10b981',
                animation: 'fadeIn .3s ease',
              }}>
                ✅ Réservation gratuite — aucun paiement requis
              </div>
            )}

            {/* Bouton CTA */}
            <button
              onClick={soumettre}
              disabled={!valid || loading}
              style={{
                padding: '16px',
                background: (!valid || loading)
                  ? 'rgba(201,151,60,.25)'
                  : 'linear-gradient(135deg, var(--gold), #a85f28)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 700, letterSpacing: .5,
                cursor: (!valid || loading) ? 'not-allowed' : 'pointer',
                transition: 'all .22s cubic-bezier(.22,1,.36,1)',
                boxShadow: (!valid || loading) ? 'none' : '0 6px 24px rgba(201,151,60,.3)',
                transform: btnPulse ? 'scale(.97)' : (!valid || loading) ? 'none' : 'scale(1)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span className="spin" style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,.3)',
                    borderTopColor: '#fff', display: 'inline-block',
                  }} />
                  Traitement…
                </span>
              ) : arrheRequises
                ? `📅 Réserver & payer ${montantArrhes.toLocaleString('fr-FR')} FCFA d'arrhes`
                : '📅 Réserver ma table'}
            </button>

            <div style={{ textAlign: 'center', fontSize: 11, opacity: .22 }}>
              Lun – Dim · 11h – 22h · Bastos, Yaoundé
            </div>
          </div>
        </Reveal>

        {/* ── Infos pratiques ── */}
        <Reveal delay={0.1}>
          <div style={{
            marginTop: 24,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            {[
              { icon: '📞', titre: 'Téléphone', val: '+237 691 78 33 41', href: 'tel:+237691783341' },
              { icon: '💬', titre: 'WhatsApp',  val: 'Écrire maintenant', href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '237691783341'}` },
              { icon: '📍', titre: 'Adresse',   val: 'Bastos, Yaoundé' },
              { icon: '🕐', titre: 'Horaires',  val: 'Lun–Ven 11h–22h' },
            ].map(info => (
              <div key={info.titre} style={{
                background: 'rgba(255,255,255,.02)',
                border: '1px solid rgba(201,151,60,.1)',
                borderRadius: 12, padding: '14px 16px',
                transition: 'border-color .2s, background .2s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(201,151,60,.3)'
                  e.currentTarget.style.background = 'rgba(201,151,60,.04)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(201,151,60,.1)'
                  e.currentTarget.style.background = 'rgba(255,255,255,.02)'
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 6 }}>{info.icon}</div>
                <div style={{ fontSize: 11, opacity: .35, marginBottom: 3 }}>{info.titre}</div>
                {info.href
                  ? <a href={info.href} style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>{info.val}</a>
                  : <div style={{ fontSize: 13, opacity: .65 }}>{info.val}</div>
                }
              </div>
            ))}
          </div>
          {/* Mention démo : le restaurant est fictif, le téléphone et WhatsApp mènent au développeur */}
          <p style={{ marginTop: 14, fontSize: 12, opacity: .5, lineHeight: 1.6, textAlign: 'center' }}>
            Site de démonstration : restaurant fictif. Le téléphone et WhatsApp mènent à Steve Jordan Tankoua, développeur du site.
          </p>
        </Reveal>
      </div>
    </div>
  )
}

// ── Écran de confirmation ─────────────────────────────────────────
function EcranConfirmation({ c }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { setTimeout(() => setVis(true), 60) }, [])

  const dateFormatée = c.date
    ? new Date(c.date + 'T12:00:00').toLocaleDateString('fr-FR', {
        weekday:'long', day:'numeric', month:'long', year:'numeric',
      })
    : c.date

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--ebony)', color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(100px,12vh,140px) 24px 40px',
    }}>
      <div style={{
        maxWidth: 460, width: '100%',
        background: 'var(--ebony-2)',
        border: '1px solid rgba(201,151,60,.2)',
        borderRadius: 20, padding: '48px 32px',
        textAlign: 'center',
        opacity: vis ? 1 : 0,
        transform: vis ? 'none' : 'translateY(24px) scale(.97)',
        transition: 'opacity .6s ease, transform .6s cubic-bezier(.22,1,.36,1)',
      }}>
        <div style={{
          fontSize: 52, marginBottom: 16,
          animation: vis ? 'countUp .5s .2s cubic-bezier(.22,1,.36,1) both' : 'none',
        }}>🪑</div>
        <h2 style={{ fontFamily:'var(--font-playfair)', fontSize:24, color:'var(--gold)', marginBottom:8 }}>
          Table réservée !
        </h2>
        <p style={{ opacity:.45, fontSize:14, marginBottom:28, lineHeight:1.6 }}>
          Votre réservation est confirmée. Nous vous attendons avec plaisir.
        </p>

        <div style={{
          background:'rgba(201,151,60,.06)', border:'1px solid rgba(201,151,60,.2)',
          borderRadius:12, padding:'20px', marginBottom:20,
          textAlign:'left', display:'flex', flexDirection:'column', gap:10,
        }}>
          {[
            ['Nom',       c.nom,          false],
            ['Téléphone', c.tel,          false],
            ['Date',      dateFormatée,   true],
            ['Heure',     c.heure,        true],
            ['Personnes', `${c.personnes} ${c.personnes > 1 ? 'personnes' : 'personne'}`, false],
            c.zone ? ['Espace', c.zone === 'vip' ? '⭐ VIP' : c.zone === 'terrasse' ? '🌿 Terrasse' : '🏠 Salle', false] : null,
            c.note ? ['Note', c.note, false] : null,
          ].filter(Boolean).map(([label, value, accent]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', fontSize:13 }}>
              <span style={{ opacity:.4 }}>{label}</span>
              <span style={{ fontWeight: accent ? 700 : 500, color: accent ? 'var(--gold)' : 'var(--cream)', textAlign:'right', maxWidth:'60%' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{
          background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.2)',
          borderRadius:10, padding:'12px 16px', fontSize:13, color:'#6ee7b7',
          marginBottom:24, lineHeight:1.5,
        }}>
          📱 Confirmation WhatsApp sur le <strong>{c.tel}</strong>
        </div>

        {/* Statut arrhes VIP */}
        {c.arrhes > 0 && (
          <div style={{
            background: c.arrhesPaie ? 'rgba(34,197,94,.06)' : 'rgba(245,158,11,.06)',
            border: `1px solid ${c.arrhesPaie ? 'rgba(34,197,94,.25)' : 'rgba(245,158,11,.3)'}`,
            borderRadius: 10, padding: '14px 16px', fontSize: 13,
            color: c.arrhesPaie ? '#6ee7b7' : 'var(--warning)',
            marginBottom: 20, lineHeight: 1.6, textAlign: 'left',
          }}>
            {c.arrhesPaie ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Arrhes confirmées</div>
                <div style={{ opacity: .75 }}>
                  Paiement de <strong>{c.arrhes.toLocaleString('fr-FR')} FCFA</strong> enregistré.
                  Votre table VIP est garantie.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>⏳ Paiement des arrhes en attente</div>
                <div style={{ opacity: .8, marginBottom: 8 }}>
                  Des arrhes de <strong>{c.arrhes.toLocaleString('fr-FR')} FCFA</strong> sont requises pour confirmer votre table {c.zone === 'vip' ? 'VIP' : 'de groupe'}.
                </div>
                <div style={{ fontSize: 12, opacity: .65, lineHeight: 1.6 }}>
                  Le restaurant vous contactera pour finaliser le paiement mobile.<br />
                  ⚠️ La réservation ne sera définitivement confirmée qu'à réception des arrhes.
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Link href="/menu" style={{
            background:'rgba(201,151,60,.1)', border:'1px solid rgba(201,151,60,.3)',
            color:'var(--gold)', textDecoration:'none',
            padding:'13px', borderRadius:8, fontSize:13, fontWeight:600,
            transition:'background .18s, transform .18s',
            display:'block', textAlign:'center',
          }}>
            Voir le menu →
          </Link>
          <Link href="/" style={{
            color:'rgba(245,239,230,.25)', textDecoration:'none',
            fontSize:12, padding:'8px', textAlign:'center', display:'block',
          }}>
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

const L = {
  display:'block', marginBottom:7,
  fontSize:11, letterSpacing:1.5, textTransform:'uppercase',
  opacity:.45, color:'var(--cream)',
}
