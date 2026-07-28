'use client'

import { useState, useEffect, useCallback } from 'react'

const SECTIONS = [
  { id: 'general',   label: '🏠 Général' },
  { id: 'horaires',  label: '🕐 Horaires' },
  { id: 'livraison', label: '🛵 Livraison' },
  { id: 'promos',    label: '🎁 Promotions' },
  { id: 'arrhes',    label: '💳 Arrhes' },
]

export default function ParametresPanel() {
  const [params,        setParams]        = useState({})
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [modified,      setModified]      = useState({})
  const [feedback,      setFb]            = useState('')
  const [section,       setSection]       = useState('general')
  const [erreur,        setErreur]        = useState('')
  // Zones de livraison — éditeur N3-FIX
  const [zones,         setZones]         = useState([])  // [{ quartier, frais, delai, emoji }]
  const [zonesLoading,  setZonesLoading]  = useState(false)
  const [newZone,       setNewZone]       = useState({ quartier: '', frais: '', delai: '', emoji: '🟡' })
  // Toggle ouvert/fermé — C7-FIX : liste complète + sélecteur multi-restaurant
  const [restaurants,   setRestaurants]   = useState([])
  const [restaurantId,  setRestaurantId]  = useState(null)
  const [toggleOuvert,  setToggleOuvert]  = useState(true)
  const [toggleLoading, setToggleLoading] = useState(false)

  const fb = msg => { setFb(msg); setTimeout(() => setFb(''), 3500) }

  const fetchParams = useCallback(async () => {
    try {
      const res = await fetch('/api/parametres')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setParams(data)
    } catch (e) {
      setErreur('Impossible de charger les paramètres. Vérifiez votre connexion.')
      console.error('[ParametresPanel]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // N3-FIX — Charger les zones depuis restaurant.parametres.zones
  const fetchZones = useCallback(async () => {
    try {
      const res  = await fetch('/api/restaurants')
      if (!res.ok) return
      const data = await res.json()
      const r    = Array.isArray(data) ? data[0] : null
      if (!r) return
      const zonesObj = r.parametres?.zones || {}
      setZones(
        Object.entries(zonesObj).map(([quartier, info]) => ({
          quartier,
          frais:  info.frais ?? 0,
          delai:  info.delai ?? '',
          emoji:  info.emoji ?? '🟡',
        }))
      )
    } catch (e) {
      console.error('[ParametresPanel zones]', e)
    }
  }, [])

  // Sauvegarder les zones dans restaurant.parametres.zones
  async function sauvegarderZones(zonesArray) {
    setZonesLoading(true)
    try {
      // Reconstruire l'objet zones attendu par lib/zones.js
      const zonesObj = {}
      for (const z of zonesArray) {
        if (z.quartier.trim()) {
          zonesObj[z.quartier.trim()] = {
            frais: parseInt(z.frais) || 0,
            delai: z.delai.trim() || '30–45 min',
            emoji: z.emoji || '🟡',
          }
        }
      }
      // Lire le restaurantId depuis les restaurants chargés
      const res = await fetch('/api/restaurants')
      const data = await res.json()
      const r = Array.isArray(data) ? data[0] : null
      if (!r) throw new Error('Restaurant introuvable')

      const currentParams = r.parametres || {}
      await fetch(`/api/restaurants/${r.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ parametres: { ...currentParams, zones: zonesObj } }),
      })
      setZones(zonesArray)
      fb('✅ Zones sauvegardées')
    } catch (e) {
      fb('❌ Erreur lors de la sauvegarde des zones.')
      console.error('[ParametresPanel zones save]', e)
    } finally {
      setZonesLoading(false)
    }
  }

  function ajouterZone() {
    if (!newZone.quartier.trim() || newZone.frais === '') return
    const updated = [...zones, { ...newZone }]
    setZones(updated)
    setNewZone({ quartier: '', frais: '', delai: '', emoji: '🟡' })
    sauvegarderZones(updated)
  }

  function supprimerZone(idx) {
    const updated = zones.filter((_, i) => i !== idx)
    setZones(updated)
    sauvegarderZones(updated)
  }

  // C7-FIX — Charger TOUS les restaurants du super_admin, pas seulement data[0]
  const fetchToggle = useCallback(async () => {
    try {
      const res = await fetch('/api/restaurants')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setRestaurants(data)
        // Sélectionner le premier par défaut
        setRestaurantId(data[0].id)
        setToggleOuvert(data[0].ouvert !== false)
      }
    } catch (e) {
      console.error('[ParametresPanel toggle]', e)
    }
  }, [])

  // C7-FIX — Changer de restaurant sélectionné dans le sélecteur
  function selectRestaurant(id) {
    const found = restaurants.find(r => r.id === id)
    if (!found) return
    setRestaurantId(found.id)
    setToggleOuvert(found.ouvert !== false)
  }

  useEffect(() => {
    fetchParams()
    fetchToggle()
    fetchZones()
  }, [fetchParams, fetchToggle, fetchZones])

  async function basculerOuvert() {
    if (!restaurantId || toggleLoading) return
    setToggleLoading(true)
    const nouvelEtat = !toggleOuvert
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ouvert: nouvelEtat }),
      })
      if (!res.ok) throw new Error(await res.text())
      setToggleOuvert(nouvelEtat)
      fb(nouvelEtat ? '✅ Restaurant marqué comme ouvert' : '🔴 Restaurant marqué comme fermé')
    } catch (e) {
      fb('❌ Impossible de changer l\'état du restaurant.')
      console.error('[ParametresPanel toggle]', e)
    } finally {
      setToggleLoading(false)
    }
  }

  function change(key, val) {
    setParams(p => ({ ...p, [key]: val }))
    setModified(m => ({ ...m, [key]: val }))
  }

  async function sauvegarder() {
    if (Object.keys(modified).length === 0) { fb('Aucune modification'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/parametres', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modified),
      })
      if (!res.ok) throw new Error(await res.text())
      setModified({})
      fb('✅ Paramètres sauvegardés')
    } catch (e) {
      fb('❌ Erreur lors de la sauvegarde. Vérifiez votre connexion.')
      console.error('[ParametresPanel save]', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', opacity: .3 }}>Chargement…</div>
  if (erreur)  return <div style={{ padding: 40, color: '#f87171', textAlign: 'center' }}>{erreur}</div>

  const nb = Object.keys(modified).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${section === s.id ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`,
              background: section === s.id ? 'rgba(201,151,60,.1)' : 'transparent',
              color: section === s.id ? 'var(--gold)' : 'var(--cream-faint)',
            }}>{s.label}</button>
          ))}
        </div>
        <button onClick={sauvegarder} disabled={saving || nb === 0} style={{
          background: nb > 0 ? 'linear-gradient(135deg,var(--gold),#a85f28)' : 'rgba(201,151,60,.2)',
          border: 'none', color: '#fff', padding: '9px 22px', borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: nb > 0 ? 'pointer' : 'not-allowed',
        }}>
          {saving ? '⏳…' : nb > 0 ? `💾 Sauvegarder (${nb})` : '💾 Sauvegarder'}
        </button>
      </div>

      {feedback && <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 8, padding: '8px 16px', marginBottom: 16, fontSize: 12, color: 'var(--success)' }}>{feedback}</div>}

      {/* Sections */}
      {section === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Message d'accueil" value={params.message_accueil} onChange={v => change('message_accueil', v)} />
          <Field label="Téléphone" value={params.telephone_resto} onChange={v => change('telephone_resto', v)} />
          <Field label="WhatsApp" value={params.whatsapp_resto} onChange={v => change('whatsapp_resto', v)} />
          <Field label="Adresse" value={params.adresse_resto} onChange={v => change('adresse_resto', v)} />
          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Objectif CA journalier (FCFA)" value={params.objectif_ca_jour} type="number" onChange={v => change('objectif_ca_jour', v)}
              hint="Utilisé pour la barre de progression dans le tableau de bord" />
          </div>
        </div>
      )}

      {section === 'horaires' && (
        <div>
          {/* C7-FIX — Sélecteur restaurant : visible uniquement en multi-restaurant */}
          {restaurants.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: 'var(--cream-faint)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>RESTAURANT</label>
              <select
                value={restaurantId || ''}
                onChange={e => selectRestaurant(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: 'var(--cream)', padding: '9px 14px', fontSize: 13, fontFamily: 'inherit' }}
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.nom} — {r.ville}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Toggle ouvert / fermé ──────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '14px 18px', background: toggleOuvert ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${toggleOuvert ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`, borderRadius: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, color: toggleOuvert ? 'var(--success)' : '#f87171' }}>
                État du restaurant
              </div>
              <div style={{ fontSize: 11, opacity: .55 }}>
                Forcer la fermeture indépendamment des horaires configurés ci-dessous.
              </div>
            </div>
            <button
              onClick={basculerOuvert}
              disabled={toggleLoading || !restaurantId}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: (toggleLoading || !restaurantId) ? 'not-allowed' : 'pointer',
                border: `1px solid ${toggleOuvert ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}`,
                background: toggleOuvert ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                color: toggleOuvert ? 'var(--success)' : '#f87171',
                transition: 'all .2s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: toggleOuvert ? 'var(--success)' : '#f87171', display: 'inline-block', flexShrink: 0 }} />
              {toggleLoading ? '…' : toggleOuvert ? 'Ouvert' : 'Fermé'}
            </button>
          </div>

          <div style={{ marginBottom: 16, fontSize: 12, opacity: .5 }}>Heures d'ouverture et de fermeture (heure locale Yaoundé — format 24h)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--gold)' }}>Lundi — Vendredi</div>
              <Field label="Ouverture" value={params.horaire_lun_ven_open} type="number" min="0" max="23" onChange={v => change('horaire_lun_ven_open', v)} />
              <Field label="Fermeture" value={params.horaire_lun_ven_close} type="number" min="0" max="23" onChange={v => change('horaire_lun_ven_close', v)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--gold)' }}>Samedi</div>
              <Field label="Ouverture" value={params.horaire_sam_open} type="number" min="0" max="23" onChange={v => change('horaire_sam_open', v)} />
              <Field label="Fermeture" value={params.horaire_sam_close} type="number" min="0" max="23" onChange={v => change('horaire_sam_close', v)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--gold)' }}>Dimanche</div>
              <Field label="Ouverture" value={params.horaire_dim_open} type="number" min="0" max="23" onChange={v => change('horaire_dim_open', v)} />
              <Field label="Fermeture" value={params.horaire_dim_close} type="number" min="0" max="23" onChange={v => change('horaire_dim_close', v)} />
            </div>
          </div>
          <Info text="Les dernières commandes sont acceptées 30 minutes avant la fermeture." />
        </div>
      )}

      {section === 'livraison' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label="Livraison gratuite dès (FCFA)" value={params.livraison_gratuite_de} type="number" onChange={v => change('livraison_gratuite_de', v)}
              hint="Ex: 5000 → livraison offerte dès 5 000 FCFA d'achat" />
            <Field label="Délai annulation commande (min)" value={params.annulation_delai_min} type="number" onChange={v => change('annulation_delai_min', v)}
              hint="Délai max pendant lequel le client peut annuler sa commande" />
          </div>

          {/* v22 — Acompte livraison */}
          <div style={{
            background: 'rgba(245,158,11,.05)',
            border: '1px solid rgba(245,158,11,.2)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', marginBottom: 12 }}>
              💳 Acompte à la livraison
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field
                label="Taux d'acompte (%)"
                value={params.taux_acompte_livraison ?? '30'}
                type="number"
                onChange={v => {
                  const n = Math.max(0, Math.min(100, parseInt(v) || 0))
                  change('taux_acompte_livraison', String(n))
                }}
                hint="% du total encaissé via Mobile Money à la commande (0 = acompte désactivé)"
              />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {(() => {
                  const t = parseInt(params.taux_acompte_livraison ?? '30') || 0
                  if (t === 0) return (
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                      Acompte <strong style={{ color: '#ef4444' }}>désactivé</strong> — paiement intégral au livreur.
                    </div>
                  )
                  const ex = 5000
                  return (
                    <div style={{ fontSize: 12, opacity: .6, lineHeight: 1.6 }}>
                      Sur une commande de <strong>{ex.toLocaleString('fr-FR')} FCFA</strong> :<br />
                      <span style={{ color: 'var(--warning)' }}>{Math.round(ex * t / 100).toLocaleString('fr-FR')} FCFA</span> maintenant · <span style={{ color: 'var(--success)' }}>{Math.round(ex * (100 - t) / 100).toLocaleString('fr-FR')} FCFA</span> à la livraison
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* N3-FIX — Éditeur de zones livraison */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, opacity: .4, letterSpacing: 1, marginBottom: 12 }}>ZONES DE LIVRAISON ({zones.length})</div>

            {/* Liste des zones existantes */}
            {zones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 0', opacity: .25, fontSize: 13 }}>
                Aucune zone — les zones Yaoundé par défaut sont utilisées.
              </div>
            ) : zones.map((z, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{z.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{z.quartier}</div>
                  <div style={{ fontSize: 11, opacity: .45 }}>{z.delai || '—'}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: z.frais === 0 ? 'var(--success)' : 'var(--cream)', whiteSpace: 'nowrap' }}>
                  {z.frais === 0 ? 'Gratuit' : `${Number(z.frais).toLocaleString('fr-FR')} FCFA`}
                </div>
                <button onClick={() => supprimerZone(i)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            ))}

            {/* Formulaire ajout zone */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, padding: '14px 16px', background: 'rgba(201,151,60,.03)', border: '1px dashed rgba(201,151,60,.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, opacity: .4, letterSpacing: 1, width: '100%', marginBottom: 4 }}>+ NOUVELLE ZONE</div>
              <input
                value={newZone.quartier}
                onChange={e => setNewZone(p => ({ ...p, quartier: e.target.value }))}
                placeholder="Quartier (ex: Bastos)"
                style={{ flex: '2 1 140px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 7, color: 'var(--cream)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit' }}
              />
              <input
                value={newZone.frais}
                onChange={e => setNewZone(p => ({ ...p, frais: e.target.value }))}
                placeholder="Frais (FCFA)"
                type="number" min="0"
                style={{ flex: '1 1 100px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 7, color: 'var(--cream)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit' }}
              />
              <input
                value={newZone.delai}
                onChange={e => setNewZone(p => ({ ...p, delai: e.target.value }))}
                placeholder="Délai (ex: 20–30 min)"
                style={{ flex: '2 1 130px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 7, color: 'var(--cream)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit' }}
              />
              <select
                value={newZone.emoji}
                onChange={e => setNewZone(p => ({ ...p, emoji: e.target.value }))}
                style={{ flex: '0 0 80px', background: 'rgba(30,20,10,.95)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 7, color: 'var(--cream)', padding: '8px 10px', fontSize: 14, fontFamily: 'inherit' }}
              >
                <option value="🟢">🟢 Proche</option>
                <option value="🟡">🟡 Moyen</option>
                <option value="🟠">🟠 Loin</option>
                <option value="🔴">🔴 Très loin</option>
              </select>
              <button
                onClick={ajouterZone}
                disabled={zonesLoading || !newZone.quartier.trim() || newZone.frais === ''}
                style={{ flex: '0 0 auto', background: 'rgba(201,151,60,.12)', border: '1px solid rgba(201,151,60,.4)', color: 'var(--gold)', padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {zonesLoading ? '⏳' : '+ Ajouter'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, opacity: .3, lineHeight: 1.6 }}>
              Ces zones remplacent les zones Yaoundé par défaut. Laissez vide pour utiliser les zones par défaut.
            </div>
          </div>
        </div>
      )}

      {section === 'promos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Réduction dès (FCFA)" value={params.reduction_seuil} type="number" onChange={v => change('reduction_seuil', v)}
            hint="Seuil à partir duquel la réduction s'applique" />
          <Field label="Taux de réduction (%)" value={params.reduction_taux} type="number" min="0" max="50" onChange={v => change('reduction_taux', v)}
            hint="Ex: 10 = -10% sur la commande" />
          <Field label="Programme fidélité — Seuil (nb commandes)" value={params.fidelite_seuil} type="number" onChange={v => change('fidelite_seuil', v)}
            hint="Ex: 5 = récompense à chaque multiple de 5 commandes" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: 20, background: 'rgba(16,185,129,.06)', borderRadius: 12, border: '1px solid rgba(16,185,129,.2)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>-{params.reduction_taux}% dès {parseInt(params.reduction_seuil||0).toLocaleString('fr-FR')} FCFA</div>
              <div style={{ fontSize: 11, opacity: .5, marginTop: 4 }}>Fidélité : récompense à {params.fidelite_seuil} cmd</div>
            </div>
          </div>
        </div>
      )}

      {section === 'arrhes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Arrhes Salle / Terrasse (FCFA)" value={params.arrhes_standard} type="number" onChange={v => change('arrhes_standard', v)}
            hint="Arrhes pour toute réservation Salle ou Terrasse hors groupe (0 = gratuit)" />
          <Field label="Arrhes VIP (FCFA)" value={params.arrhes_vip} type="number" onChange={v => change('arrhes_vip', v)}
            hint="Arrhes pour les réservations en espace VIP (hors groupe)" />
          <Field label="Arrhes groupes (FCFA)" value={params.arrhes_groupe} type="number" onChange={v => change('arrhes_groupe', v)}
            hint="Arrhes pour tout groupe atteignant le seuil ci-dessous, quelle que soit la zone" />
          <Field label="Seuil groupe (nb personnes)" value={params.arrhes_seuil_personnes} type="number" onChange={v => change('arrhes_seuil_personnes', v)}
            hint="Ex: 8 = arrhes groupe requises à partir de 8 personnes" />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
            <div style={{ padding: 20, background: 'rgba(245,158,11,.06)', borderRadius: 12, border: '1px solid rgba(245,158,11,.2)', minWidth: 260 }}>
              <div style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 700, marginBottom: 8 }}>💳 Politique actuelle</div>
              <div style={{ fontSize: 12, opacity: .7, lineHeight: 1.9 }}>
                Salle / Terrasse → {parseInt(params.arrhes_standard||0) === 0 ? 'Gratuit' : `${parseInt(params.arrhes_standard||0).toLocaleString('fr-FR')} FCFA`}<br />
                VIP (&lt;{params.arrhes_seuil_personnes} pers.) → {parseInt(params.arrhes_vip||0).toLocaleString('fr-FR')} FCFA<br />
                Groupe ≥{params.arrhes_seuil_personnes} pers. (toutes zones) → {parseInt(params.arrhes_groupe||0).toLocaleString('fr-FR')} FCFA
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', hint, min, max }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: 'var(--cream-faint)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>{label.toUpperCase()}</label>
      <input
        type={type} value={value || ''} min={min} max={max}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: 'var(--cream)', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit' }}
      />
      {hint && <div style={{ fontSize: 10, opacity: .35, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Info({ text }) {
  return (
    <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, fontSize: 12, color: '#60a5fa', opacity: .8 }}>
      ℹ️ {text}
    </div>
  )
}
