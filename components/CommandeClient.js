'use client'
// components/CommandeClient.js — v11
// Corrections : focus states, validation tél, REDUCTION_TAUX, padding confirmation, safe-area mobile

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Recu from '@/components/Recu'

const PAIEMENTS = [
  { id: 'cinetpay',  label: 'Mobile Money (MTN / Orange)', emoji: '📱', color: '#f59e0b',
    desc: 'Paiement sécurisé en ligne — MTN MoMo, Orange Money, Express Union' },
  { id: 'livraison', label: 'Espèces à la livraison',       emoji: '💵', color: '#10b981',
    desc: 'Payez le livreur à la réception de votre commande' },
  { id: 'resto',     label: 'Paiement au restaurant',       emoji: '🏠', color: 'var(--gold)',
    desc: 'Payez directement à la caisse du restaurant' },
]

const ZONES_LIVRAISON = {
  'Bastos':       { frais: 0,    delai: '10–20 min', emoji: '🟢' },
  'Nlongkak':     { frais: 300,  delai: '15–25 min', emoji: '🟢' },
  'Tsinga':       { frais: 300,  delai: '15–25 min', emoji: '🟢' },
  'Mvog-Ada':     { frais: 500,  delai: '20–30 min', emoji: '🟡' },
  'Centre-ville': { frais: 500,  delai: '20–35 min', emoji: '🟡' },
  'Melen':        { frais: 500,  delai: '25–35 min', emoji: '🟡' },
  'Biyem-Assi':   { frais: 700,  delai: '30–45 min', emoji: '🟡' },
  'Omnisports':   { frais: 700,  delai: '30–40 min', emoji: '🟡' },
  'Nkol-Afeme':   { frais: 800,  delai: '35–50 min', emoji: '🟠' },
  'Mvog-Mbi':     { frais: 800,  delai: '35–50 min', emoji: '🟠' },
  'Essos':        { frais: 900,  delai: '35–50 min', emoji: '🟠' },
  'Nkoldongo':    { frais: 1000, delai: '40–55 min', emoji: '🔴' },
  'Mendong':      { frais: 1200, delai: '45–60 min', emoji: '🔴' },
  'Autre zone':   { frais: 1500, delai: '45–70 min', emoji: '🔴' },
}
const ZONES_LISTE          = Object.keys(ZONES_LIVRAISON)
const LIVRAISON_GRATUITE_DE = 5000
// FIX: taux centralisé, utilisé partout
const REDUCTION_SEUIL = 15000
const REDUCTION_TAUX  = 0.10

function validerTel(tel) {
  const clean = tel.replace(/[\s\-()]/g, '')
  // Cameroun (défaut) : 6XX XXX XXX ou +237 6XX XXX XXX
  const isCM   = /^(\+?237)?[679]\d{7}$/.test(clean)
  // International (touristes) : +XX... format E.164
  const isIntl = /^\+[1-9]\d{5,14}$/.test(clean)
  return isCM || isIntl
}

export default function CommandeClient() {
  const router = useRouter()

  // Retour intelligent à 2 niveaux :
  //  1) Étape 2 (formulaire) -> revient à l'étape 1 (sélection), SANS quitter /commande
  //  2) Étape 1 (sélection)  -> revient à la page précédente (accueil OU menu,
  //     selon l'origine de navigation). Repli sur /menu si aucun historique.
  const handleRetour = () => {
    if (etape !== 'selection') {
      setEtape('selection')
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/menu')
    }
  }

  const [menu,        setMenu]        = useState([])
  const [panier,      setPanier]      = useState({})
  const [etape,       setEtape]       = useState('selection')
  const [form,        setForm]        = useState({
    client: '', tel: '', mode: 'livraison',
    addr: '', zone: 'Bastos', paiement: 'livraison', note: '',
  })
  const [loading,          setLoading]          = useState(false)
  const [erreurPaiement,   setErreurPaiement]   = useState('')
  const [confirmation,     setConfirmation]     = useState(null)
  const [menuLoading,      setMenuLoading]      = useState(true)
  const [telErreur,        setTelErreur]        = useState('')
  // v22 — taux d'acompte chargé depuis /api/config (défaut 30%)
  const [tauxAcompte,      setTauxAcompte]      = useState(30)

  // [v18 branding] Snapshot panier capturé avant setPanier({}) — nécessaire car
  // lignes est recalculé depuis panier, qui est vide après reset
  const [snapLignes,  setSnapLignes]  = useState([])
  const [snapTotaux,  setSnapTotaux]  = useState({ sousTotal: 0, fraisLiv: 0, reduction: 0, total: 0 })

  useEffect(() => {
    fetch('/api/menu')
      .then(r => r.json())
      .then(data => setMenu(Array.isArray(data) ? data.filter(p => p.actif) : []))
      .catch(() => setMenu([]))
      .finally(() => setMenuLoading(false))
  }, [])

  // v22 — Charger le taux d'acompte depuis la config publique
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        const t = parseInt(cfg.taux_acompte_livraison)
        if (!isNaN(t) && t >= 0 && t <= 100) setTauxAcompte(t)
      })
      .catch(() => {}) // silencieux — défaut 30% reste en place
  }, [])

  function ajouter(id) {
    setPanier(p => ({ ...p, [id]: (p[id] || 0) + 1 }))
  }

  function retirer(id) {
    setPanier(p => {
      const q = (p[id] || 0) - 1
      if (q <= 0) { const n = { ...p }; delete n[id]; return n }
      return { ...p, [id]: q }
    })
  }

  // FIX: comparaison robuste — convertir les deux en string
  const lignes = Object.entries(panier)
    .map(([id, qte]) => ({ plat: menu.find(p => String(p.id) === String(id)), qte }))
    .filter(l => l.plat)

  const sousTotal = lignes.reduce((s, l) => s + l.plat.price * l.qte, 0)
  const zoneInfo  = form.mode === 'livraison' ? (ZONES_LIVRAISON[form.zone] || ZONES_LIVRAISON['Autre zone']) : null
  const fraisLiv  = form.mode === 'livraison'
    ? (sousTotal >= LIVRAISON_GRATUITE_DE ? 0 : (zoneInfo?.frais || 0))
    : 0
  // FIX: utiliser REDUCTION_TAUX au lieu de 0.10 codé en dur
  const reduction = sousTotal >= REDUCTION_SEUIL ? Math.round(sousTotal * REDUCTION_TAUX) : 0
  const total     = sousTotal + fraisLiv - reduction
  const nbArticles = Object.values(panier).reduce((s, q) => s + q, 0)

  // v22 — Acompte prévisualisé côté client (source de vérité = serveur)
  const acompteReqis = form.mode === 'livraison' && form.paiement === 'livraison' && tauxAcompte > 0
  const acomptePreview = acompteReqis ? Math.round(total * tauxAcompte / 100) : 0
  const restePreview   = acompteReqis ? total - acomptePreview : 0

  // FIX: validation téléphone à la soumission
  const soumettre = useCallback(async () => {
    if (!form.client.trim() || !form.tel.trim()) return
    if (form.mode === 'livraison' && !form.addr.trim()) return
    if (lignes.length === 0) return

    // Valider téléphone avant envoi
    if (!validerTel(form.tel)) {
      setTelErreur('Numéro invalide. Ex : +237 677 123 456 (Cameroun) ou +33 6 12 34 56 78 (étranger)')
      return
    }
    setTelErreur('')

    setLoading(true)
    setErreurPaiement('')

    try {
      const itemsPayload = lignes.map(l => ({
        id: l.plat.id, name: l.plat.name,
        price: l.plat.price, qty: l.qte,
      }))

      const res = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client:   form.client.trim(),
          tel:      form.tel.trim(),
          mode:     form.mode === 'livraison' ? 'Livraison' : 'À emporter',
          items:    itemsPayload,
          total,
          addr:     form.mode === 'livraison' ? form.addr.trim() : null,
          zone:     form.mode === 'livraison' ? form.zone : null,
          paiement: form.paiement,
          note:     form.note.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErreurPaiement(data.error || 'Erreur lors de la commande')
        return
      }

      if (data._doublon) {
        if (form.paiement === 'cinetpay' && data.paiement === 'cinetpay_confirme') {
          setSnapLignes([...lignes]); setSnapTotaux({ sousTotal, fraisLiv, reduction, total })
          setConfirmation(data); setEtape('confirmation'); setPanier({})
          return
        }
        if (form.paiement === 'cinetpay') {
          const payRes  = await fetch('/api/paiement/initier', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandeId: data.id }),
          })
          const payData = await payRes.json()
          if (payRes.ok && payData.paymentUrl) { setPanier({}); window.location.href = payData.paymentUrl; return }
        }
        // v22 — Doublon acompte non encore payé → réinitier le paiement
        if (form.paiement === 'livraison' && form.mode === 'livraison' && data.acompteStatut === 'requis') {
          const payRes  = await fetch('/api/paiement/initier', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commandeId: data.id, type: 'acompte' }),
          })
          const payData = await payRes.json()
          if (payRes.ok && payData.paymentUrl) { setPanier({}); window.location.href = payData.paymentUrl; return }
        }
        setSnapLignes([...lignes]); setSnapTotaux({ sousTotal, fraisLiv, reduction, total })
        setConfirmation(data); setEtape('confirmation'); setPanier({})
        return
      }

      if (form.paiement === 'cinetpay') {
        const payRes  = await fetch('/api/paiement/initier', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandeId: data.id }),
        })
        const payData = await payRes.json()
        if (payRes.ok && payData.paymentUrl) { setPanier({}); window.location.href = payData.paymentUrl; return }
        if (payData.demo) {
          setSnapLignes([...lignes]); setSnapTotaux({ sousTotal, fraisLiv, reduction, total })
          setConfirmation({ ...data, _demo: true }); setEtape('confirmation'); setPanier({}); return
        }
        setErreurPaiement(payData.error || "Impossible d'initier le paiement Mobile Money")
        return
      }

      // v22 — Paiement livraison avec acompte requis → CinetPay pour le dépôt partiel
      if (form.paiement === 'livraison' && form.mode === 'livraison' && data.acompteStatut === 'requis') {
        const payRes  = await fetch('/api/paiement/initier', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandeId: data.id, type: 'acompte' }),
        })
        const payData = await payRes.json()
        if (payRes.ok && payData.paymentUrl) { setPanier({}); window.location.href = payData.paymentUrl; return }
        setErreurPaiement(payData.error || "Impossible d'initier le paiement de l'acompte")
        return
      }

      setSnapLignes([...lignes]); setSnapTotaux({ sousTotal, fraisLiv, reduction, total })
      setConfirmation(data); setEtape('confirmation'); setPanier({})
    } catch (e) {
      console.error(e)
      setErreurPaiement('Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }, [form, lignes, total])

  if (etape === 'confirmation' && confirmation) {
    return (
      <EcranConfirmation
        cmd={confirmation}
        form={form}
        lignes={snapLignes}
        sousTotal={snapTotaux.sousTotal}
        fraisLiv={snapTotaux.fraisLiv}
        reduction={snapTotaux.reduction}
        total={snapTotaux.total}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ebony)', color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      paddingTop: 80,
      // FIX: espace pour barre panier + safe area mobile
      paddingBottom: nbArticles > 0 ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : 40,
    }}>
      {/* Header */}
      <div style={{
        padding: '40px 24px 32px', textAlign: 'center',
        borderBottom: '1px solid rgba(201,151,60,0.12)',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(201,151,60,0.06) 0%, transparent 70%)',
        position: 'relative',
      }}>
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
        <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.35, marginBottom: 10 }}>
          Commande en ligne
        </div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: 'var(--gold)', margin: 0 }}>
          Votre commande
        </h1>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Étapes */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, alignItems: 'center' }}>
          {[
            { id: 'selection', n: '1', label: 'Plats' },
            { id: 'form',      n: '2', label: 'Vos infos' },
          ].map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <div style={{ width: 24, height: 1, background: 'rgba(201,151,60,0.3)' }} />}
              <button
                onClick={() => etape === 'form' && e.id === 'selection' && setEtape('selection')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: etape === e.id ? 'rgba(201,151,60,0.12)' : 'transparent',
                  border: `1px solid ${etape === e.id ? 'var(--gold)' : 'rgba(201,151,60,0.2)'}`,
                  color: etape === e.id ? 'var(--gold)' : 'rgba(245,239,230,0.35)',
                  padding: '6px 14px', borderRadius: 20,
                  fontSize: 12, fontWeight: etape === e.id ? 700 : 400,
                  cursor: etape === 'form' && e.id === 'selection' ? 'pointer' : 'default',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: etape === e.id ? 'var(--gold)' : 'rgba(201,151,60,0.15)',
                  color: etape === e.id ? '#fff' : 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{e.n}</span>
                {e.label}
              </button>
            </div>
          ))}
        </div>

        {etape === 'selection' && (
          <SelectionEtape
            menu={menu} menuLoading={menuLoading}
            panier={panier} onAjouter={ajouter} onRetirer={retirer}
            lignes={lignes} sousTotal={sousTotal}
            onSuivant={() => setEtape('form')}
          />
        )}

        {etape === 'form' && (
          <FormulaireEtape
            form={form} setForm={setForm}
            lignes={lignes} sousTotal={sousTotal}
            fraisLiv={fraisLiv} zoneInfo={zoneInfo}
            reduction={reduction} total={total}
            loading={loading}
            erreurPaiement={erreurPaiement}
            telErreur={telErreur} setTelErreur={setTelErreur}
            onSoumettre={soumettre}
            onRetour={() => setEtape('selection')}
            acomptePreview={acomptePreview}
            restePreview={restePreview}
            tauxAcompte={tauxAcompte}
          />
        )}
      </div>

      {/* Barre panier flottante */}
      {etape === 'selection' && nbArticles > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          padding: 'clamp(12px,2vh,16px) 24px',
          // FIX: safe area iPhone
          paddingBottom: 'calc(clamp(12px,2vh,16px) + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(13,10,7,0.97)',
          borderTop: '1px solid rgba(201,151,60,0.25)',
          backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{nbArticles} article{nbArticles > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, opacity: 0.5 }}>{sousTotal.toLocaleString('fr-FR')} FCFA</div>
            {sousTotal > 0 && sousTotal < REDUCTION_SEUIL && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                + {(REDUCTION_SEUIL - sousTotal).toLocaleString('fr-FR')} FCFA → -10% 🎉
              </div>
            )}
            {reduction > 0 && (
              <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>
                ✓ -{Math.round(REDUCTION_TAUX * 100)}% appliqué ({reduction.toLocaleString('fr-FR')} FCFA économisés)
              </div>
            )}
          </div>
          <button onClick={() => setEtape('form')} style={{
            background: 'linear-gradient(135deg, var(--gold), #a85f28)',
            color: '#fff', border: 'none',
            padding: '13px 28px', borderRadius: 8,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
          }}>
            Continuer → Mes infos
          </button>
        </div>
      )}
    </div>
  )
}

// ── Étape 1 ───────────────────────────────────────────────────────────────────

function SelectionEtape({ menu, menuLoading, panier, onAjouter, onRetirer, lignes, sousTotal, onSuivant }) {
  const cats = [...new Set(menu.map(p => p.cat))]
  const [catActive, setCatActive] = useState('Tous')
  const affichés = catActive === 'Tous' ? menu : menu.filter(p => p.cat === catActive)

  if (menuLoading) return (
    <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>Chargement du menu…</div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {['Tous', ...cats].map(cat => (
          <button key={cat} onClick={() => setCatActive(cat)} style={{
            flexShrink: 0,
            padding: '6px 16px', borderRadius: 20,
            border: `1px solid ${catActive === cat ? 'var(--gold)' : 'rgba(201,151,60,0.2)'}`,
            background: catActive === cat ? 'rgba(201,151,60,0.12)' : 'transparent',
            color: catActive === cat ? 'var(--gold)' : 'rgba(245,239,230,0.4)',
            fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{cat}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {affichés.map(plat => {
          const qte = panier[plat.id] || 0
          return (
            <div key={plat.id} style={{
              background: qte > 0 ? 'rgba(201,151,60,0.06)' : 'rgba(255,255,255,0.025)',
              border: `1px solid ${qte > 0 ? 'rgba(201,151,60,0.35)' : 'rgba(201,151,60,0.1)'}`,
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>{plat.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {plat.name}
                  {plat.popular && <span style={{ fontSize: 10, color: 'var(--gold)', opacity: 0.7 }}>⭐</span>}
                </div>
                <div style={{ fontSize: 12, opacity: 0.45, lineHeight: 1.4 }}>{plat.desc}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>
                  {plat.price.toLocaleString('fr-FR')} FCFA
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {qte > 0 ? (
                  <>
                    <button onClick={() => onRetirer(plat.id)} style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1px solid rgba(201,151,60,0.4)',
                      background: 'rgba(201,151,60,0.1)',
                      color: 'var(--gold)', fontSize: 18, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qte}</span>
                    <button onClick={() => onAjouter(plat.id)} style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: 'none', background: 'var(--gold)',
                      color: '#fff', fontSize: 18, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>+</button>
                  </>
                ) : (
                  <button onClick={() => onAjouter(plat.id)} style={{
                    padding: '8px 16px', borderRadius: 6,
                    border: '1px solid rgba(201,151,60,0.3)',
                    background: 'transparent', color: 'var(--gold)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>+ Ajouter</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {Object.keys(panier).length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.35, fontSize: 14 }}>
          Sélectionnez vos plats ci-dessus
        </div>
      )}
    </div>
  )
}

// ── Étape 2 ───────────────────────────────────────────────────────────────────

function FormulaireEtape({ form, setForm, lignes, sousTotal, fraisLiv, zoneInfo, reduction, total, loading, erreurPaiement, telErreur, setTelErreur, onSoumettre, onRetour, acomptePreview = 0, restePreview = 0, tauxAcompte = 30 }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const valid = form.client.trim() && form.tel.trim()
    && (form.mode !== 'livraison' || form.addr.trim())
    && lignes.length > 0

  // FIX: focus state dynamique via state
  const [focused, setFocused] = useState(null)
  const inputStyle = (name) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px',
    background: focused === name ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${
      name === 'tel' && telErreur ? 'rgba(239,68,68,0.5)' :
      focused === name ? 'rgba(201,151,60,0.6)' : 'rgba(201,151,60,0.25)'
    }`,
    borderRadius: 9, color: 'var(--cream)',
    fontSize: 14, outline: 'none',
    fontFamily: 'var(--font-dm)',
    transition: 'border-color 0.18s, background 0.18s',
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>

      {/* Récapitulatif panier */}
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(201,151,60,0.15)',
        borderRadius: 14, padding: '20px',
      }}>
        <h3 style={{ fontFamily: 'var(--font-playfair)', fontSize: 15, color: 'var(--gold)', marginBottom: 14 }}>
          🛒 Votre panier
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {lignes.map(l => (
            <div key={l.plat.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{l.plat.emoji} {l.plat.name} <span style={{ opacity: 0.5 }}>×{l.qte}</span></span>
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                {(l.plat.price * l.qte).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(201,151,60,0.15)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.5 }}>
            <span>Sous-total</span><span>{sousTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          {fraisLiv > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.5 }}>
              <span>Livraison</span><span>{fraisLiv.toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {fraisLiv === 0 && form.mode === 'livraison' && (
            <div style={{ fontSize: 11, color: '#10b981', opacity: 0.8 }}>✓ Livraison offerte</div>
          )}
          {reduction > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#10b981' }}>
              <span>🎉 Réduction -10% (dès 15 000 FCFA)</span>
              <span>− {reduction.toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>
            <span>Total</span><span>{total.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>
        <button onClick={onRetour} style={{
          marginTop: 12, background: 'none', border: 'none',
          color: 'rgba(245,239,230,0.4)', fontSize: 12, cursor: 'pointer', padding: 0,
        }}>
          ← Modifier ma sélection
        </button>
      </div>

      {/* Formulaire */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Nom */}
        <div>
          <label style={L}>Votre prénom *</label>
          <input type="text" value={form.client}
            onChange={e => set('client', e.target.value)}
            onFocus={() => setFocused('client')}
            onBlur={() => setFocused(null)}
            placeholder="Ex : Paul"
            style={inputStyle('client')}
          />
        </div>

        {/* Téléphone — FIX: validation */}
        <div>
          <label style={L}>Numéro de téléphone *</label>
          <input type="tel" value={form.tel}
            onChange={e => { set('tel', e.target.value); if (telErreur) setTelErreur('') }}
            onFocus={() => setFocused('tel')}
            onBlur={() => setFocused(null)}
            placeholder="+237 677 XXX XXX"
            style={inputStyle('tel')}
          />
          {telErreur ? (
            <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 4 }}>⚠️ {telErreur}</div>
          ) : (
            <div style={{ fontSize: 11, opacity: 0.35, marginTop: 4 }}>
              Pour le suivi WhatsApp de votre commande
            </div>
          )}
        </div>

        {/* Mode livraison / emporter */}
        <div>
          <label style={L}>Mode de récupération *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            {[
              { id: 'livraison', label: '🛵 Livraison', sub: '+ frais selon zone (gratuit dès 5 000 FCFA)' },
              { id: 'emporter',  label: '🏠 À emporter', sub: 'Récupérer sur place à Bastos' },
            ].map(m => (
              <button key={m.id} onClick={() => set('mode', m.id)} style={{
                padding: '12px', borderRadius: 10,
                border: `1px solid ${form.mode === m.id ? 'var(--gold)' : 'rgba(201,151,60,0.2)'}`,
                background: form.mode === m.id ? 'rgba(201,151,60,0.1)' : 'rgba(255,255,255,0.02)',
                color: form.mode === m.id ? 'var(--cream)' : 'rgba(245,239,230,0.5)',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Zone + adresse (livraison) */}
        {form.mode === 'livraison' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={L}>Zone de livraison *</label>
              <select value={form.zone} onChange={e => set('zone', e.target.value)}
                onFocus={() => setFocused('zone')} onBlur={() => setFocused(null)}
                style={{ ...inputStyle('zone'), background: 'rgba(20,16,8,.95)', cursor: 'pointer' }}>
                {ZONES_LISTE.map(z => {
                  const info  = ZONES_LIVRAISON[z]
                  const frais = sousTotal >= LIVRAISON_GRATUITE_DE ? 0 : info.frais
                  return (
                    <option key={z} value={z}>
                      {info.emoji} {z} — {frais === 0 ? 'Livraison offerte' : `${frais} FCFA`} · {info.delai}
                    </option>
                  )
                })}
              </select>
              {zoneInfo && (
                <div style={{ fontSize: 11, marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, opacity: .7 }}>
                  <span>{zoneInfo.emoji}</span>
                  <span>Délai estimé : <strong>{zoneInfo.delai}</strong></span>
                  {fraisLiv === 0
                    ? <span style={{ color: '#10b981' }}>• Livraison offerte ✓</span>
                    : <span>• Frais : <strong>{fraisLiv.toLocaleString('fr-FR')} FCFA</strong></span>}
                </div>
              )}
            </div>
            <div>
              <label style={L}>Adresse précise *</label>
              <input type="text" value={form.addr}
                onChange={e => set('addr', e.target.value)}
                onFocus={() => setFocused('addr')} onBlur={() => setFocused(null)}
                placeholder="Rue, bâtiment, repère visible…"
                style={inputStyle('addr')}
              />
            </div>
          </div>
        )}

        {/* Paiement */}
        <div>
          <label style={L}>Mode de paiement *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {PAIEMENTS.map(p => (
              <button key={p.id} onClick={() => set('paiement', p.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10,
                border: `1px solid ${form.paiement === p.id ? p.color : 'rgba(201,151,60,0.15)'}`,
                background: form.paiement === p.id ? `${p.color}12` : 'rgba(255,255,255,0.02)',
                color: form.paiement === p.id ? 'var(--cream)' : 'rgba(245,239,230,0.5)',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: form.paiement === p.id ? 600 : 400 }}>{p.label}</span>
                {form.paiement === p.id && (
                  <span style={{ marginLeft: 'auto', color: p.color, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>

          {/* v22 — Notice acompte : uniquement pour livraison + espèces */}
          {form.paiement === 'livraison' && form.mode === 'livraison' && acomptePreview > 0 && (
            <div style={{
              marginTop: 10,
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>
                💳 Acompte de {tauxAcompte}% requis pour confirmer
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ opacity: 0.7 }}>Maintenant (Mobile Money)</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                  {acomptePreview.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 3 }}>
                <span style={{ opacity: 0.7 }}>À la livraison (espèces)</span>
                <span style={{ color: 'var(--cream)', fontWeight: 600 }}>
                  {restePreview.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div style={{ fontSize: 10, opacity: 0.45, marginTop: 8, lineHeight: 1.5 }}>
                L'acompte garantit votre commande. Le reste est réglé directement au livreur.
              </div>
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <label style={L}>Instructions spéciales <span style={{ opacity: 0.4, textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span></label>
          <textarea value={form.note}
            onChange={e => set('note', e.target.value)}
            onFocus={() => setFocused('note')} onBlur={() => setFocused(null)}
            placeholder="Allergies, préférences, instructions de livraison…"
            rows={3}
            style={{ ...inputStyle('note'), resize: 'vertical' }}
          />
        </div>

        {/* Erreur API */}
        {erreurPaiement && (
          <div style={{
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
            borderRadius: 10, padding: '12px 16px', color: '#fca5a5', fontSize: 14,
          }}>
            ⚠️ {erreurPaiement}
          </div>
        )}

        {/* Bouton soumettre */}
        <button
          type="button"
          onClick={onSoumettre}
          disabled={!valid || loading}
          style={{
            padding: '16px',
            background: (!valid || loading) ? 'rgba(201,151,60,0.3)' : 'linear-gradient(135deg, var(--gold), #a85f28)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, letterSpacing: 1,
            cursor: (!valid || loading) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: (!valid || loading) ? 'none' : '0 4px 20px rgba(201,151,60,.25)',
          }}
        >
          {loading
            ? '⏳ Envoi en cours…'
            : acomptePreview > 0
              ? `📱 Payer l'acompte · ${acomptePreview.toLocaleString('fr-FR')} FCFA`
              : `✅ Confirmer · ${total.toLocaleString('fr-FR')} FCFA`
          }
        </button>
        <div style={{ fontSize: 11, opacity: 0.3, textAlign: 'center' }}>
          Pas de compte requis · Suivi par WhatsApp
        </div>
      </div>
    </div>
  )
}

// ── Confirmation ──────────────────────────────────────────────────────────────

// [v18 branding] Reçoit le snapshot du panier pour l'impression du reçu
function EcranConfirmation({ cmd, form, lignes, sousTotal, fraisLiv, reduction, total }) {
  const paiement = PAIEMENTS.find(p => p.id === form.paiement)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ebony)', color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // FIX: padding unifié (paddingTop et padding ne se chevauchent plus)
      padding: 'clamp(100px,12vh,140px) 24px 40px',
    }}>
      <div style={{
        maxWidth: 480, width: '100%',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(201,151,60,0.2)',
        borderRadius: 20, padding: '48px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 24, color: 'var(--gold)', marginBottom: 8 }}>
          Commande confirmée !
        </h2>
        <p style={{ opacity: 0.5, fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
          Votre commande a bien été reçue. Nous vous contactons sur WhatsApp pour confirmer.
        </p>

        <div style={{
          background: 'rgba(201,151,60,0.08)', border: '1px solid rgba(201,151,60,0.2)',
          borderRadius: 12, padding: '20px', marginBottom: 24,
          textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <InfoRow label="N° commande" value={cmd.id}          accent />
          <InfoRow label="Client"      value={form.client} />
          <InfoRow label="Téléphone"   value={form.tel} />
          <InfoRow label="Mode"        value={cmd.mode} />
          {cmd.addr && <InfoRow label="Adresse" value={cmd.addr} />}
          <InfoRow label="Paiement"    value={paiement?.label || form.paiement} />
          <div style={{ borderTop: '1px solid rgba(201,151,60,0.15)', paddingTop: 10 }}>
            <InfoRow label="Total" value={`${(cmd.total || 0).toLocaleString('fr-FR')} FCFA`} accent />
          </div>
        </div>

        <div style={{
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 10, padding: '14px 16px',
          fontSize: 13, color: '#6ee7b7', marginBottom: 24, lineHeight: 1.5,
        }}>
          📱 Vous recevrez un message WhatsApp sur le <strong>{form.tel}</strong> pour le suivi.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href={`/suivi?ref=${encodeURIComponent(cmd.id)}`} style={{
            background: 'linear-gradient(135deg, var(--gold), #a85f28)',
            color: '#fff', textDecoration: 'none',
            padding: '13px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            textAlign: 'center', display: 'block',
          }}>
            🔍 Suivre ma commande en temps réel
          </Link>
          <Link href="/menu" style={{
            background: 'rgba(201,151,60,0.1)', border: '1px solid rgba(201,151,60,0.3)',
            color: 'var(--gold)', textDecoration: 'none',
            padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            textAlign: 'center', display: 'block',
          }}>
            ← Retour au menu
          </Link>
          {/* [v18 branding] Bouton reçu imprimable avec logo + détail articles */}
          <Recu
            cmd={cmd} form={form}
            lignes={lignes} sousTotal={sousTotal}
            fraisLiv={fraisLiv} reduction={reduction} total={total}
          />
          <Link href="/" style={{
            color: 'rgba(245,239,230,0.3)', textDecoration: 'none',
            fontSize: 12, padding: '8px', textAlign: 'center', display: 'block',
          }}>
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ opacity: 0.45 }}>{label}</span>
      <span style={{ fontWeight: accent ? 700 : 500, color: accent ? 'var(--gold)' : 'var(--cream)' }}>{value}</span>
    </div>
  )
}

const L = {
  display: 'block', marginBottom: 7,
  fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
  opacity: 0.5, color: 'var(--cream)',
}
