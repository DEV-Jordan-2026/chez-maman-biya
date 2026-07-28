'use client'
// StaffClient.js — v13 KDS · Interface cuisine professionnelle · Chez Maman Biya
// Inspiré des KDS (Kitchen Display Systems) Toast / Square / Lightspeed
// Améliorations v13 :
//   1. CarteCommande KDS : liste verticale article par article, qty en grand
//   2. Postes cuisine (Chaud / Froid / Grillade / Pâtisserie) + filtre KPI
//   3. Bouton "86 — Rupture" par article avec alerte temps réel
//   4. Priorité manuelle (monter/descendre dans la file)
//   5. Son cloche à l'arrivée d'une nouvelle commande (fichier placeholder)
//   6. Vue "Shift" : compteur plats sortis dans le service
//   7. Note de préparation portée sur l'article concerné (pas juste en bas)

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NotifAlert from '@/components/NotifAlert'
import useSSE from '@/hooks/useSSE'
import RHPanel from '@/components/panels/RHPanel'
import usePermissions from '@/hooks/usePermissions'

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUS = {
  nouveau:        { label: 'Nouveau',      color: '#3B82F6', bg: 'rgba(59,130,246,.1)'  },
  en_cours:       { label: 'En cours',     color: '#F59E0B', bg: 'rgba(245,158,11,.1)'  },
  en_preparation: { label: 'En prépa',     color: '#8B5CF6', bg: 'rgba(139,92,246,.1)'  },
  pret:           { label: 'Prêt',         color: '#22C55E', bg: 'rgba(34,197,94,.1)'   },
  en_livraison:   { label: 'En livraison', color: '#22C55E', bg: 'rgba(34,197,94,.08)'  },
}

const STATUS_NEXT = {
  nouveau:        'en_cours',
  en_cours:       'en_preparation',
  en_preparation: 'pret',
}

const STATUS_ICON = {
  nouveau:        'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2',
  en_cours:       'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  en_preparation: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
  pret:           'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
}

// Postes cuisine — étiquette + couleur + icône
const POSTES = [
  { id: 'tous',       label: 'Tous postes', color: 'var(--gold)',    icon: '🍽️' },
  { id: 'chaud',      label: 'Chaud',       color: '#EF4444',        icon: '🔥' },
  { id: 'froid',      label: 'Froid',       color: '#60A5FA',        icon: '❄️' },
  { id: 'grillade',   label: 'Grillade',    color: '#F97316',        icon: '🥩' },
  { id: 'patisserie', label: 'Pâtisserie',  color: '#EC4899',        icon: '🍰' },
]

// Convertit l'enum Prisma (CHAUD/FROID/GRILLADE/PATISSERIE) en id POSTES
// Fallback heuristique si le champ poste n'est pas encore renseigné côté serveur
const POSTE_MAP = { CHAUD: 'chaud', FROID: 'froid', GRILLADE: 'grillade', PATISSERIE: 'patisserie' }

function inferPoste(nomItem = '', posteEnum = null) {
  if (posteEnum && POSTE_MAP[posteEnum]) return POSTE_MAP[posteEnum]
  const n = nomItem.toLowerCase()
  if (/brais|grill|poulet|boeuf|viande|porc|saucisse|côte|entrecôte/.test(n)) return 'grillade'
  if (/salade|crudités|jus|smoothie|yaourt|dessert|mousse|fruit/.test(n))     return 'froid'
  if (/gâteau|tarte|cake|beignet|pâtisserie|mille-feuille|pain/.test(n))      return 'patisserie'
  return 'chaud'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function tempsEcoule(createdAt, now) {
  if (!createdAt) return null
  const min = Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  if (min < 1)  return { label: "À l'instant", color: 'var(--success)', urgent: false }
  if (min < 15) return { label: `${min} min`,   color: 'var(--success)', urgent: false }
  if (min < 30) return { label: `${min} min`,   color: 'var(--warning)', urgent: true  }
  return             { label: `${min} min`,     color: 'var(--danger)',  urgent: true  }
}

// Parse les items d'une commande → tableau structuré
function parseItems(items) {
  if (!items) return []
  if (typeof items === 'string') {
    try { items = JSON.parse(items) } catch { return [{ nom: items, qty: 1 }] }
  }
  if (Array.isArray(items)) {
    return items.map(it => ({
      id:    it.id    || it.menuItemId || null,  // FIX I6 — exposer l'id pour toggleRupture
      nom:   it.name  || it.nom || '?',
      qty:   it.qty   || it.quantity || 1,
      note:  it.note  || it.instruction || null,
      poste: inferPoste(it.name || it.nom || '', it.poste || null),
    }))
  }
  return []
}

// Son cloche — Web Audio API bip de remplacement tant que le fichier n'est pas fourni
// Pour utiliser un vrai fichier : remplacer playCloche() par new Audio('/sounds/cloche.mp3').play()
function playCloche() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    // Simulation cloche : deux oscillateurs (fondamentale + harmonique)
    const t = ctx.currentTime
    const gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)
    gainNode.gain.setValueAtTime(0.6, t)
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 1.2)

    ;[523.25, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.connect(gainNode)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, t + 1.2)
      osc.start(t + i * 0.04)
      osc.stop(t + 1.3)
    })
  } catch {
    // AudioContext non disponible (SSR ou navigateur ancien)
  }
}

// ── CarteCommande KDS ──────────────────────────────────────────────────────────
// Design inspiré Toast KDS : ticket vertical, articles lisibles à 1 m, actions claires

function CarteCommande({ cmd, onNext, onRupture, updating, now, rupturesLocales, priorite, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const s    = STATUS[cmd.status] || STATUS.nouveau
  const next = STATUS_NEXT[cmd.status]
  const sNext = next ? STATUS[next] : null
  const temps = tempsEcoule(cmd.createdAt, now)
  const isNew = cmd.status === 'nouveau'
  const items = parseItems(cmd.items)

  // Palette urgence basée sur le temps
  const urgenceColor = temps?.urgent ? temps.color : 'transparent'

  return (
    <div style={{
      background: 'var(--ebony-2)',
      border: `1px solid ${isNew ? 'rgba(59,130,246,.5)' : 'var(--border-gold)'}`,
      borderTop: `4px solid ${s.color}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'all .25s',
      animation: isNew ? 'pulseNew 2s ease 3' : undefined,
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Header ticket ── */}
      <div style={{
        padding: '12px 16px 10px',
        background: `linear-gradient(135deg, ${s.color}18, transparent)`,
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Numéro + statut */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', letterSpacing: -0.5, lineHeight: 1 }}>
              #{cmd.id?.toString().slice(-4)}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 20,
              background: s.bg, color: s.color,
              border: `1px solid ${s.color}35`,
              fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase',
            }}>
              <svg width={7} height={7} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d={STATUS_ICON[cmd.status] || STATUS_ICON.nouveau} />
              </svg>
              {s.label}
            </span>
            {priorite > 0 && (
              <span style={{ fontSize: 10, color: '#F97316', fontWeight: 800, background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.3)', padding: '2px 7px', borderRadius: 20 }}>
                ⬆ PRIO
              </span>
            )}
          </div>
          {/* Client + mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)' }}>{cmd.client || 'Anonyme'}</span>
            {cmd.mode && (
              <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--cream-faint)', background: 'var(--border-subtle)', padding: '2px 7px', borderRadius: 4 }}>
                {cmd.mode}
              </span>
            )}
          </div>
        </div>

        {/* Timer + priorité */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {temps && (
            <span style={{
              fontSize: 13, fontWeight: 800, color: temps.color,
              background: `${temps.color}15`, border: `1px solid ${temps.color}35`,
              borderRadius: 20, padding: '4px 11px',
              animation: temps.urgent ? 'pulseUrgent 1.5s ease infinite' : undefined,
              fontVariantNumeric: 'tabular-nums',
            }}>
              ⏱ {temps.label}
            </span>
          )}
          {/* Boutons réordonner */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Monter dans la file"
              style={{
                width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-subtle)',
                background: canMoveUp ? 'rgba(255,255,255,.07)' : 'transparent',
                color: canMoveUp ? 'var(--cream)' : 'var(--border-subtle)',
                cursor: canMoveUp ? 'pointer' : 'default',
                fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >▲</button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Descendre dans la file"
              style={{
                width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-subtle)',
                background: canMoveDown ? 'rgba(255,255,255,.07)' : 'transparent',
                color: canMoveDown ? 'var(--cream)' : 'var(--border-subtle)',
                cursor: canMoveDown ? 'pointer' : 'default',
                fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >▼</button>
          </div>
        </div>
      </div>

      {/* ── Liste articles KDS ── */}
      <div style={{ padding: '12px 16px', flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--cream-faint)', fontStyle: 'italic' }}>Aucun article</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => {
              const enRupture = rupturesLocales.has(item.nom)
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px',
                    background: enRupture ? 'rgba(239,68,68,.07)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${enRupture ? 'rgba(239,68,68,.3)' : 'var(--border-subtle)'}`,
                    borderRadius: 10,
                    opacity: enRupture ? 0.7 : 1,
                    transition: 'all .2s',
                  }}
                >
                  {/* Quantité — grand, lisible à distance */}
                  <div style={{
                    minWidth: 36, height: 36,
                    borderRadius: 9,
                    background: enRupture ? 'rgba(239,68,68,.15)' : `${POSTES.find(p => p.id === item.poste)?.color || 'var(--gold)'}20`,
                    border: `1px solid ${enRupture ? 'rgba(239,68,68,.3)' : `${POSTES.find(p => p.id === item.poste)?.color || 'var(--gold)'}40`}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 900,
                    color: enRupture ? '#EF4444' : (POSTES.find(p => p.id === item.poste)?.color || 'var(--gold)'),
                    flexShrink: 0,
                  }}>
                    {item.qty}
                  </div>

                  {/* Nom + note + badge poste */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 15, fontWeight: 700,
                        color: enRupture ? '#EF4444' : 'var(--cream)',
                        textDecoration: enRupture ? 'line-through' : 'none',
                        lineHeight: 1.2,
                      }}>
                        {item.nom}
                      </span>
                      {/* Badge poste */}
                      {item.poste && item.poste !== 'tous' && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                          color: POSTES.find(p => p.id === item.poste)?.color || 'var(--gold)',
                          background: `${POSTES.find(p => p.id === item.poste)?.color || 'var(--gold)'}15`,
                          border: `1px solid ${POSTES.find(p => p.id === item.poste)?.color || 'var(--gold)'}30`,
                          padding: '1px 6px', borderRadius: 4,
                        }}>
                          {POSTES.find(p => p.id === item.poste)?.icon} {POSTES.find(p => p.id === item.poste)?.label}
                        </span>
                      )}
                      {enRupture && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', padding: '1px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                          86 · RUPTURE
                        </span>
                      )}
                    </div>

                    {/* Note spécifique à l'article */}
                    {item.note && (
                      <div style={{
                        marginTop: 5, fontSize: 11, color: '#F59E0B',
                        background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)',
                        borderRadius: 6, padding: '4px 9px',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                        </svg>
                        {item.note}
                      </div>
                    )}
                  </div>

                  {/* Bouton 86 Rupture */}
                  <button
                    onClick={() => onRupture(item)}
                    title={enRupture ? 'Retirer la rupture' : 'Déclarer rupture (86)'}
                    style={{
                      flexShrink: 0,
                      width: 30, height: 30, borderRadius: 8,
                      background: enRupture ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${enRupture ? 'rgba(239,68,68,.4)' : 'var(--border-subtle)'}`,
                      color: enRupture ? '#EF4444' : 'var(--cream-faint)',
                      cursor: 'pointer',
                      fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => { if (!enRupture) e.currentTarget.style.background = 'rgba(239,68,68,.08)'; e.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={e => { e.currentTarget.style.background = enRupture ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.04)'; e.currentTarget.style.color = enRupture ? '#EF4444' : 'var(--cream-faint)' }}
                  >
                    {enRupture ? '↩' : '⊘'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note générale de commande */}
      {cmd.note && (
        <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 7, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#F59E0B' }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>{cmd.note}</span>
        </div>
      )}

      {/* ── Bouton action principal ── */}
      {next && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => onNext(cmd.id, next)}
            disabled={updating === cmd.id}
            style={{
              width: '100%', padding: '13px 16px',
              background: updating === cmd.id
                ? 'rgba(240,232,216,.05)'
                : `linear-gradient(135deg, ${sNext.color}, ${sNext.color}cc)`,
              border: `1px solid ${sNext.color}50`,
              borderRadius: 10,
              color: updating === cmd.id ? 'var(--cream-faint)' : '#fff',
              fontSize: 13, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase',
              cursor: updating === cmd.id ? 'wait' : 'pointer',
              transition: 'all .2s', fontFamily: 'var(--font-dm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: updating === cmd.id ? 'none' : `0 4px 14px ${sNext.color}30`,
            }}
          >
            {updating === cmd.id
              ? <><span className="spin" style={{ width: 13, height: 13, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}/>Mise à jour…</>
              : <>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d={STATUS_ICON[next] || 'M5 12h14M12 5l7 7-7 7'} />
                  </svg>
                  → {sNext.label}
                </>
            }
          </button>
        </div>
      )}
    </div>
  )
}

// ── Onglet Réception (inchangé) ────────────────────────────────────────────────
function TabReceptionStaff({ restaurantId }) {
  const [receptions,  setReceptions]  = useState([])
  const [bons,        setBons]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [bonId,       setBonId]       = useState('')
  const [items,       setItems]       = useState([{ article: '', qteCommandee: '', qteRecue: '', conforme: true }])
  const [observation, setObservation] = useState('')
  const [statusRec,   setStatusRec]   = useState('complete')
  const [busy,        setBusy]        = useState(false)
  const [msg,         setMsg]         = useState({ type: '', text: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = restaurantId ? `?restaurantId=${restaurantId}` : ''
      const [rRec, rBons] = await Promise.all([
        fetch(`/api/achats/receptions${qs}`),
        fetch(`/api/bons-commande?status=en_cours${restaurantId ? '&restaurantId=' + restaurantId : ''}`),
      ])
      setReceptions(rRec.ok  ? await rRec.json()  : [])
      setBons(      rBons.ok ? await rBons.json() : [])
    } catch(e) { console.error('[TabReceptionStaff]', e) }
    finally { setLoading(false) }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  function updateItem(i, k, v) { setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it)) }
  function addItem()    { setItems(p => [...p, { article: '', qteCommandee: '', qteRecue: '', conforme: true }]) }
  function removeItem(i){ setItems(p => p.filter((_, idx) => idx !== i)) }

  async function soumettre() {
    if (!bonId) { setMsg({ type: 'err', text: 'Sélectionnez un bon de commande' }); return }
    const validItems = items.filter(it => it.article.trim() && it.qteRecue)
    if (validItems.length === 0) { setMsg({ type: 'err', text: 'Renseignez au moins un article reçu' }); return }
    setBusy(true)
    const res  = await fetch('/api/achats/receptions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, bonCommandeId: bonId, items: validItems, observation, status: statusRec }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setMsg({ type: 'err', text: data.error || 'Erreur serveur' }); return }
    setMsg({ type: 'ok', text: '✅ Réception enregistrée — stocks mis à jour' })
    setShowForm(false); setBonId(''); setItems([{ article: '', qteCommandee: '', qteRecue: '', conforme: true }]); setObservation('')
    load()
  }

  const inp = { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(132,204,22,.2)', borderRadius: 8, color: '#f5efe6', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ background: 'rgba(132,204,22,.06)', border: '1px solid rgba(132,204,22,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔑</span>
        <div>
          <div style={{ fontSize: 12, color: '#84cc16', fontWeight: 700 }}>Permission accordée : Réception marchandises</div>
          <div style={{ fontSize: 11, color: 'rgba(245,239,230,.45)', marginTop: 2 }}>Attribuée par votre manager pour réceptionner les livraisons fournisseurs.</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowForm(p => !p)} style={{ background: 'linear-gradient(135deg,#84cc16,#4d7c0f)', border: 'none', color: 'white', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? '✕ Annuler' : '📦 Enregistrer une réception'}
        </button>
      </div>
      {msg.text && (
        <div style={{ background: msg.type === 'err' ? 'rgba(239,68,68,.08)' : 'rgba(132,204,22,.08)', border: `1px solid ${msg.type === 'err' ? 'rgba(239,68,68,.3)' : 'rgba(132,204,22,.3)'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'err' ? '#ef4444' : '#84cc16', fontSize: 13, marginBottom: 12 }}>
          {msg.text}
        </div>
      )}
      {showForm && (
        <div style={{ background: 'rgba(132,204,22,.04)', border: '1px solid rgba(132,204,22,.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ color: '#84cc16', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📦 Réception marchandises</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }}>BON DE COMMANDE</label>
            {bons.length > 0 ? (
              <select style={{ ...inp, width: '100%' }} value={bonId} onChange={e => setBonId(e.target.value)}>
                <option value="">— Sélectionner un bon —</option>
                {bons.map(b => <option key={b.id} value={b.id}>BC #{b.id.slice(-6)} · {b.dateCommande}</option>)}
              </select>
            ) : (
              <input style={{ ...inp, width: '100%' }} value={bonId} onChange={e => setBonId(e.target.value)} placeholder="ID du bon de commande" />
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, marginBottom: 8 }}>ARTICLES REÇUS</div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input style={inp} value={it.article} onChange={e => updateItem(i,'article',e.target.value)} placeholder="Article" />
                <input style={inp} type="number" value={it.qteCommandee} onChange={e => updateItem(i,'qteCommandee',e.target.value)} placeholder="Commandé" />
                <input style={inp} type="number" value={it.qteRecue}     onChange={e => updateItem(i,'qteRecue',    e.target.value)} placeholder="Reçu" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(245,239,230,.6)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={it.conforme} onChange={e => updateItem(i,'conforme',e.target.checked)} style={{ accentColor: '#84cc16' }} />OK
                </label>
                {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>
            ))}
            <button onClick={addItem} style={{ background: 'transparent', border: '1px dashed rgba(132,204,22,.3)', color: '#84cc16', padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>+ Ajouter un article</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }}>STATUT</label>
              <select style={{ ...inp, width: '100%' }} value={statusRec} onChange={e => setStatusRec(e.target.value)}>
                <option value="complete">✅ Complète</option>
                <option value="partielle">⚠️ Partielle</option>
                <option value="litige">🚨 Litige</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(245,239,230,.4)', letterSpacing: 1, display: 'block', marginBottom: 5 }}>OBSERVATION</label>
              <input style={{ ...inp, width: '100%' }} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Produit abîmé, quantité manquante..." />
            </div>
          </div>
          <button onClick={soumettre} disabled={busy} style={{ background: 'linear-gradient(135deg,#84cc16,#4d7c0f)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {busy ? 'Enregistrement...' : 'Valider la réception'}
          </button>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 28, height: 28, border: '3px solid rgba(132,204,22,.2)', borderTopColor: '#84cc16', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>
      ) : receptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(245,239,230,.4)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div><p>Aucune réception enregistrée</p>
        </div>
      ) : receptions.map(r => {
        const stColor = { complete: '#10b981', partielle: '#f59e0b', litige: '#ef4444' }[r.status] || '#6b7280'
        const itms = Array.isArray(r.items) ? r.items : []
        return (
          <div key={r.id} style={{ background: 'rgba(255,255,255,.025)', border: `1px solid ${stColor}25`, borderLeft: `4px solid ${stColor}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: 'rgba(245,239,230,.5)' }}>BC #{r.bonCommandeId?.slice(-6)} · par {r.receptionnePar}</div>
              <span style={{ fontSize: 11, background: `${stColor}20`, color: stColor, border: `1px solid ${stColor}40`, padding: '2px 9px', borderRadius: 20 }}>{r.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {itms.slice(0,3).map((it, i) => <span key={i} style={{ fontSize: 11, background: 'rgba(132,204,22,.1)', color: '#84cc16', border: '1px solid rgba(132,204,22,.2)', padding: '2px 8px', borderRadius: 20 }}>{it.article} ({it.qteRecue})</span>)}
              {itms.length > 3 && <span style={{ fontSize: 11, color: 'rgba(245,239,230,.3)' }}>+{itms.length - 3}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function StaffClient({ user }) {
  const router = useRouter()
  const { can } = usePermissions()

  // Navigation
  const [tab,           setTab]          = useState('cuisine')

  // Commandes + messages
  const [commandes,     setCommandes]    = useState([])
  const [messages,      setMessages]     = useState([])
  const [loading,       setLoading]      = useState(true)
  const [updating,      setUpdating]     = useState(null)
  const [lastRefresh,   setLastRefresh]  = useState(null)
  const [msgVisible,    setMsgVisible]   = useState(false)
  const [now,           setNow]          = useState(Date.now())
  const [pulse,         setPulse]        = useState(false)

  // Filtres
  const [filtreStatut,  setFiltreStatut] = useState('tous')
  const [filtrePoste,   setFiltrePoste]  = useState('tous')

  // Ruptures locales (Set de noms d'articles déclarés "86" par ce cuisinier)
  const [rupturesLocales, setRupturesLocales] = useState(new Set())

  // Priorités manuelles : Map<commandeId, prioriteOffset> — plus positif = plus haut
  const [priorites, setPriorites] = useState({})

  // Statistiques shift
  const [platsSort, setPlatsSort] = useState(0)   // compteur cumulatif du service
  const shiftStart = useRef(Date.now())

  // Son
  const sonActif = useRef(true)

  // ── Timers ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(iv)
  }, [])

  // ── Fetch commandes ──────────────────────────────────────────────────────────
  const fetchCommandes = useCallback(async () => {
    try {
      const res  = await fetch('/api/commandes', { cache: 'no-store' })
      const data = await res.json()
      const all  = Array.isArray(data) ? data : (Array.isArray(data?.commandes) ? data.commandes : [])
      const actives = all.filter(c => !['livre','annule'].includes(c.status))
      setCommandes(prev => {
        const nouvelles = actives.filter(c => c.status === 'nouveau' && !prev.find(p => p.id === c.id))
        if (nouvelles.length > 0) {
          setPulse(true)
          if (sonActif.current) playCloche()
        }
        return actives
      })
      setLastRefresh(new Date())
    } catch (e) { console.error('[StaffClient]', e) }
    finally { setLoading(false) }
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const res  = await fetch('/api/messages', { cache: 'no-store' })
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  // Initialise les ruptures depuis le serveur au montage
  const fetchRupturesInitiales = useCallback(async () => {
    try {
      const res  = await fetch('/api/cuisine/stocks')
      const data = await res.json()
      if (data?.items) {
        const enRupture = new Set(
          data.items
            .filter(i => i.enRupture)
            .flatMap(i => i.platsLies?.map(p => p.nom) || [])
        )
        setRupturesLocales(enRupture)
      }
    } catch (e) { console.error('[fetchRupturesInitiales]', e) }
  }, [])

  useEffect(() => {
    fetchCommandes(); fetchMessages(); fetchRupturesInitiales()
    const iv1 = setInterval(fetchCommandes, 120_000)
    const iv2 = setInterval(fetchMessages,  60_000)
    return () => { clearInterval(iv1); clearInterval(iv2) }
  }, [fetchCommandes, fetchMessages, fetchRupturesInitiales])

  // ── SSE temps réel ───────────────────────────────────────────────────────────
  const { connected: sseConnected } = useSSE({
    onCommandeNouvelle: (commande) => {
      setCommandes(prev => {
        if (prev.find(c => c.id === commande.id)) return prev
        if (sonActif.current) playCloche()
        setPulse(true)
        return [commande, ...prev]
      })
    },
    onCommandeStatus: ({ id, status }) => {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    },
  })

  useEffect(() => {
    if (pulse) { const t = setTimeout(() => setPulse(false), 2000); return () => clearTimeout(t) }
  }, [pulse])

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function updateStatus(id, status) {
    setUpdating(id)
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    if (status === 'pret') setPlatsSort(n => n + 1)
    try {
      await fetch(`/api/commandes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (status === 'pret') setTimeout(() => setCommandes(prev => prev.filter(c => c.id !== id)), 1500)
    } catch { fetchCommandes() }
    finally { setUpdating(null) }
  }

  async function toggleRupture(item) {
    // FIX I6 — Utiliser l'id exact (pas le nom) pour éviter les collisions entre plats similaires
    const nomArticle = typeof item === 'string' ? item : item.nom
    const enRupture = !rupturesLocales.has(nomArticle)
    // Mise à jour optimiste immédiate
    setRupturesLocales(prev => {
      const next = new Set(prev)
      enRupture ? next.add(nomArticle) : next.delete(nomArticle)
      return next
    })
    // Persistance API — préférer menuItemId (exact) si disponible
    const bodyPayload = item?.id
      ? { menuItemId: item.id, enRupture }
      : { menuItemNom: nomArticle, enRupture }
    try {
      await fetch('/api/cuisine/ruptures', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      })
    } catch (e) {
      console.error('[toggleRupture]', e)
      // Rollback en cas d'erreur réseau
      setRupturesLocales(prev => {
        const next = new Set(prev)
        enRupture ? next.delete(nomArticle) : next.add(nomArticle)
        return next
      })
    }
  }

  function moveCmd(id, direction) {
    setPriorites(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + direction,
    }))
  }

  async function marquerLu(id) {
    await fetch(`/api/messages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lu: true }) })
    setMessages(prev => prev.map(m => m.id === id ? { ...m, lu: true } : m))
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login'); router.refresh()
  }

  // ── Dérivés ──────────────────────────────────────────────────────────────────
  const enAttente   = commandes.filter(c => c.status === 'nouveau').length
  const enCours     = commandes.filter(c => ['en_cours','en_preparation'].includes(c.status)).length
  const prets       = commandes.filter(c => c.status === 'pret').length
  const nbMsgNonLus = messages.filter(m => !m.lu && (m.destinataire === 'tous' || m.destinataire === 'staff')).length
  const msgUrgents  = messages.filter(m => m.priorite === 'urgent' && !m.lu && (m.destinataire === 'tous' || m.destinataire === 'staff'))

  const refreshStr = lastRefresh
    ? lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '–'

  // Durée shift
  const shiftMin = Math.floor((Date.now() - shiftStart.current) / 60_000)
  const shiftStr = shiftMin < 60
    ? `${shiftMin} min`
    : `${Math.floor(shiftMin / 60)}h${String(shiftMin % 60).padStart(2,'0')}`

  // KPI filtres statut (inchangés)
  const FILTRES_KPI = [
    { id: 'tous',    label: 'Toutes',     value: commandes.length, color: 'var(--gold)'    },
    { id: 'nouveau', label: 'Nouveaux',   value: enAttente,        color: '#3B82F6'        },
    { id: 'en_cours',label: 'En cuisine', value: enCours,          color: 'var(--warning)' },
    { id: 'pret',    label: 'Prêts',      value: prets,            color: 'var(--success)' },
  ]

  // Pipeline de filtrage + tri + priorité
  const filtrees = [...commandes]
    .filter(c => {
      // filtre statut
      if (filtreStatut === 'nouveau')  return c.status === 'nouveau'
      if (filtreStatut === 'en_cours') return ['en_cours','en_preparation'].includes(c.status)
      if (filtreStatut === 'pret')     return c.status === 'pret'
      return true
    })
    .filter(c => {
      // filtre poste : une commande est visible si elle contient au moins un article du poste sélectionné
      if (filtrePoste === 'tous') return true
      const items = parseItems(c.items)
      return items.some(it => (it.poste || inferPoste(it.nom)) === filtrePoste)
    })
    .sort((a, b) => {
      // 1) priorité manuelle (offset)
      const pDiff = ((priorites[b.id] || 0) - (priorites[a.id] || 0))
      if (pDiff !== 0) return pDiff
      // 2) statut
      const o = { nouveau: 0, en_cours: 1, en_preparation: 2, pret: 3, en_livraison: 4 }
      return (o[a.status] ?? 9) - (o[b.status] ?? 9)
    })

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ebony)', color: 'var(--cream)', fontFamily: 'var(--font-dm)' }}>
      <style>{`
        @keyframes pulseNew     { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,.4)} 50%{box-shadow:0 0 0 10px rgba(59,130,246,0)} }
        @keyframes pulseUrgent  { 0%,100%{opacity:1} 50%{opacity:.6} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        @keyframes fadeSlide    { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        @keyframes countUp      { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes ruptureFlash { 0%,100%{background:rgba(239,68,68,.07)} 50%{background:rgba(239,68,68,.18)} }
      `}</style>

      {/* ── Alerte urgente ── */}
      {msgUrgents.length > 0 && (
        <div onClick={() => setMsgVisible(true)} style={{ background: 'rgba(239,68,68,.1)', borderBottom: '1px solid rgba(239,68,68,.3)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Message urgent : {msgUrgents[0].contenu.slice(0, 70)}{msgUrgents[0].contenu.length > 70 ? '…' : ''} — Cliquer pour lire
        </div>
      )}

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: msgUrgents.length > 0 ? 40 : 0, zIndex: 50,
        height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px',
        background: 'rgba(8,6,5,.96)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-gold)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(201,151,60,.2),rgba(201,151,60,.06))',
            border: '1px solid rgba(201,151,60,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>👨‍🍳</div>
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 16, fontWeight: 600, color: 'var(--gold)', lineHeight: 1.2 }}>
              Cuisine — Chez Maman Biya
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--cream-faint)' }}>
              {user.name || user.login}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Indicateur shift */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--cream-faint)' }}>
            <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12 }}>{platsSort}</span>
            <span>plat{platsSort !== 1 ? 's' : ''} sortis · {shiftStr}</span>
          </div>

          {/* Son on/off */}
          <button
            onClick={() => { sonActif.current = !sonActif.current; /* force re-render trick */ setNow(Date.now()) }}
            title={sonActif.current ? 'Désactiver son' : 'Activer son'}
            style={{ background: 'transparent', border: '1px solid var(--border-gold)', color: 'var(--cream-faint)', padding: '7px 12px', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
          >
            {sonActif.current ? '🔔' : '🔕'}
          </button>

          {/* Sync */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--cream-faint)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulseNew 2s ease infinite' }}/>
            {refreshStr}
          </div>

          {/* Messages */}
          <button onClick={() => setMsgVisible(v => !v)} style={{
            position: 'relative',
            background: nbMsgNonLus > 0 ? 'rgba(245,158,11,.1)' : 'transparent',
            border: `1px solid ${nbMsgNonLus > 0 ? 'rgba(245,158,11,.4)' : 'var(--border-gold)'}`,
            color: nbMsgNonLus > 0 ? 'var(--warning)' : 'var(--cream-faint)',
            padding: '7px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-dm)', transition: 'all .18s',
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Messages
            {nbMsgNonLus > 0 && (
              <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2, flexShrink: 0 }}>
                {nbMsgNonLus > 9 ? '9+' : nbMsgNonLus}
              </span>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'rgba(240,232,216,.12)', letterSpacing: .5 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,.12)' }}>&lt;/&gt;</span>
            Jordan – full-Dev
          </div>

          <button onClick={logout} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', padding: '7px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-dm)', transition: 'background .18s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* ── Panel messages ── */}
      {msgVisible && (
        <div style={{ background: 'var(--ebony-1)', borderBottom: '1px solid var(--border-gold)', padding: '18px 28px', maxHeight: 260, overflowY: 'auto', animation: 'fadeSlide .25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Messages de l'équipe
            </div>
            <button onClick={() => setMsgVisible(false)} style={{ background: 'none', border: 'none', color: 'var(--cream-faint)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          {messages.filter(m => m.destinataire === 'tous' || m.destinataire === 'staff').length === 0
            ? <div style={{ color: 'var(--cream-faint)', fontSize: 13 }}>Aucun message</div>
            : messages.filter(m => m.destinataire === 'tous' || m.destinataire === 'staff').map(m => (
              <div key={m.id} style={{ padding: '12px 14px', background: m.lu ? 'var(--border-subtle)' : 'rgba(245,158,11,.06)', border: `1px solid ${m.lu ? 'var(--border-subtle)' : 'rgba(245,158,11,.3)'}`, borderRadius: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    {m.priorite === 'urgent' && <span style={{ fontSize: 10, background: 'rgba(239,68,68,.12)', color: 'var(--danger)', borderRadius: 4, padding: '1px 6px', marginRight: 6, fontWeight: 700 }}>URGENT</span>}
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{m.contenu}</span>
                    <div style={{ fontSize: 10, color: 'var(--cream-faint)', marginTop: 4 }}>{m.auteur} · {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  {!m.lu && (
                    <button onClick={() => marquerLu(m.id)} style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(34,197,94,.3)', color: 'var(--success)', padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-dm)' }}>
                      Marquer lu
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      <main style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Nav tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { id: 'cuisine',   label: '👨‍🍳 Cuisine' },
            { id: 'rh',        label: '👤 Mon espace RH' },
            ...(can('receptionner_marchandises') ? [{ id: 'reception', label: '📦 Réception' }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-dm)', fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? 'linear-gradient(135deg,var(--gold),#a85f28)' : 'rgba(255,255,255,.05)',
              color: tab === t.id ? 'white' : 'rgba(245,239,230,.55)', transition: 'all .18s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Onglet RH ── */}
        {tab === 'rh' && <RHPanel user={user} />}

        {/* ── Onglet Réception ── */}
        {tab === 'reception' && can('receptionner_marchandises') && (
          <TabReceptionStaff restaurantId={user?.restaurantId} />
        )}

        {/* ── Onglet Cuisine ── */}
        {tab === 'cuisine' && (
          <>
            {/* Ruptures actives — bannière */}
            {rupturesLocales.size > 0 && (
              <div style={{
                marginBottom: 20, padding: '12px 18px',
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
                animation: 'ruptureFlash 2s ease infinite',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⊘</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#EF4444', letterSpacing: .5, marginBottom: 5 }}>
                    86 — ARTICLES EN RUPTURE · visible par les serveurs
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[...rupturesLocales].map(nom => (
                      <span key={nom} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                        borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#EF4444', fontWeight: 600,
                      }}>
                        {nom}
                        <button onClick={() => toggleRupture(nom)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── KPI statut (filtres) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {FILTRES_KPI.map(f => (
                <button key={f.id} onClick={() => setFiltreStatut(f.id)} style={{
                  background: filtreStatut === f.id ? `${f.color}15` : 'var(--ebony-2)',
                  border: `2px solid ${filtreStatut === f.id ? f.color : 'var(--border-gold)'}`,
                  borderRadius: 14, padding: '16px 12px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all .2s', fontFamily: 'var(--font-dm)',
                  boxShadow: filtreStatut === f.id ? `0 4px 20px ${f.color}25` : 'none',
                }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: f.color, lineHeight: 1, animation: 'countUp .4s ease' }}>
                    {f.value}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--cream-faint)', marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {f.label}
                  </div>
                </button>
              ))}
            </div>

            {/* ── Filtre postes ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--cream-faint)', letterSpacing: 1, textTransform: 'uppercase', marginRight: 4 }}>Poste :</span>
              {POSTES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFiltrePoste(p.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: `1px solid ${filtrePoste === p.id ? p.color : 'var(--border-subtle)'}`,
                    background: filtrePoste === p.id ? `${p.color}18` : 'transparent',
                    color: filtrePoste === p.id ? p.color : 'var(--cream-faint)',
                    fontSize: 12, fontWeight: filtrePoste === p.id ? 700 : 400,
                    cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-dm)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>

            {/* ── Grille commandes ── */}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
                {Array(4).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 14 }}/>)}
              </div>
            ) : filtrees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--border-subtle)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--cream-faint)" strokeWidth={1.2} strokeLinecap="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 14, color: 'var(--cream-faint)' }}>
                  {filtrePoste !== 'tous'
                    ? `Aucune commande pour le poste ${POSTES.find(p => p.id === filtrePoste)?.label}`
                    : filtreStatut === 'tous' ? 'Aucune commande active' : `Aucune commande "${FILTRES_KPI.find(f => f.id === filtreStatut)?.label}"`
                  }
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
                {filtrees.map((cmd, idx) => (
                  <CarteCommande
                    key={cmd.id}
                    cmd={cmd}
                    onNext={updateStatus}
                    onRupture={toggleRupture}
                    updating={updating}
                    now={now}
                    rupturesLocales={rupturesLocales}
                    priorite={priorites[cmd.id] || 0}
                    onMoveUp={() => moveCmd(cmd.id, +1)}
                    onMoveDown={() => moveCmd(cmd.id, -1)}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < filtrees.length - 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <NotifAlert commandes={commandes} />
    </div>
  )
}
