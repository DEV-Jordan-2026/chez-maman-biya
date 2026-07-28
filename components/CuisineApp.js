'use client'
// components/CuisineApp.js — v23
//
// Interface PWA Cuisine — tablette paysage, mode kiosque
//
// Trois onglets :
//   🔥 Commandes — Kanban 4 colonnes temps réel (inchangé v21 + badge rupture sur les cartes)
//   📦 Stock       — Vue lecture seule des ingrédients, triée par alerte, rafraîchie toutes les 3 min
//   📊 Aperçu     — Tableau synthétique des quantités groupé par catégorie (v23)
//
// Nouveautés v22 :
//   C1 — Onglet "Stock Cuisine" (lecture seule, rôle staff)
//   C2 — Jauge visuelle niveauPct + badge alerte ('ok'|'faible'|'rupture')
//   C3 — Filtre catégorie + filtre alertes seulement
//   C4 — Badge ⚠️ rupture sur les articles d'une carte de commande
//   C5 — Compteur d'alertes dans l'en-tête (badge rouge)
//   C6 — SSE onStockAlerte → invalide le cache stock côté client immédiatement
//
// Nouveautés v23 :
//   A1 — Onglet "📊 Aperçu" : tableau condensé des quantités groupé par catégorie
//   A2 — KPI cards : total articles, ruptures, faibles, OK
//   A3 — Tableau par catégorie : nom, quantité, unité, jauge miniature, badge statut
//   A4 — Tri inline : cliquer sur une colonne du tableau pour trier
//   A5 — Mise à jour partagée avec l'onglet Stock (même état stockItems)

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import useSSE  from '@/hooks/useSSE'
import usePWA  from '@/hooks/usePWA'

// ── Palette design system CMB ─────────────────────────────────────────────────
// Ces constantes reflètent exactement les CSS vars de globals.css.
// GOLD   → var(--gold)    #C9973C
// IVORY  → var(--cream)   #F0E8D8
// EBONY  → var(--ebony)   #080605
// SURFACE→ var(--ebony-1) #100D09
// Les usages avec suffixe alpha-hex (ex: ${GOLD}22) sont intentionnels.
// ⚠️  Si BrandingPanel modifie --gold, mettre à jour GOLD ici également.
const GOLD    = '#C9973C'
const IVORY   = '#F0E8D8'
const EBONY   = '#080605'
const SURFACE = '#100D09'

// ── Constantes statut commandes ───────────────────────────────────────────────
const COL = {
  nouveau:        { label: 'Nouvelles',   emoji: '🆕', color: '#3B82F6', bg: 'rgba(59,130,246,.07)'  },
  en_cours:       { label: 'En cuisine',  emoji: '🔥', color: '#F59E0B', bg: 'rgba(245,158,11,.07)'  },
  en_preparation: { label: 'En finition', emoji: '🧑‍🍳', color: '#8B5CF6', bg: 'rgba(139,92,246,.07)' },
  pret:           { label: 'Prêtes ✓',   emoji: '✅', color: '#22C55E', bg: 'rgba(34,197,94,.07)'   },
}
const STATUS_NEXT = {
  nouveau:        'en_cours',
  en_cours:       'en_preparation',
  en_preparation: 'pret',
}
const STATUS_LABEL_BTN = {
  nouveau:        '🔥 Prendre en charge',
  en_cours:       '🧑‍🍳 Passer en finition',
  en_preparation: '✅ Marquer prête',
}

// ── Couleurs alerte stock ─────────────────────────────────────────────────────
const ALERTE_CFG = {
  ok:      { color: '#22C55E', bg: 'rgba(34,197,94,.10)',   label: 'OK'       },
  faible:  { color: '#F59E0B', bg: 'rgba(245,158,11,.10)',  label: 'Faible'   },
  rupture: { color: '#EF4444', bg: 'rgba(239,68,68,.10)',   label: 'Rupture'  },
}

// ── Formatage ─────────────────────────────────────────────────────────────────
function fmtItems(items) {
  if (!items) return '—'
  if (typeof items === 'string') { try { items = JSON.parse(items) } catch { return items } }
  if (Array.isArray(items)) return items.map(i => `${i.qty || 1}× ${i.name || i.nom || '?'}`).join('\n')
  return String(items)
}

function fmtTimer(createdAt, now) {
  const min = Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  if (min < 1)  return { txt: "À l'instant", color: '#22C55E', urgent: false, critical: false }
  if (min < 15) return { txt: `${min} min`,   color: '#22C55E', urgent: false, critical: false }
  if (min < 30) return { txt: `${min} min`,   color: '#F59E0B', urgent: true,  critical: false }
  return              { txt: `${min} min`,   color: '#EF4444', urgent: true,  critical: true  }
}

function fmtQte(stock, unite) {
  const val = Number.isInteger(stock) ? stock : stock.toFixed(1)
  return `${val} ${unite}`
}

// ── C4 : Détecte les articles d'une commande qui sont en rupture/faible ────────
// On croise les noms d'articles de la commande avec les noms des StockItems.
// Correspondance souple (includes) car les noms peuvent différer légèrement.
function detecterAlertesCommande(items, stockItems) {
  if (!stockItems?.length || !items) return []
  const parsed = (() => {
    if (Array.isArray(items)) return items
    if (typeof items === 'string') { try { return JSON.parse(items) } catch {} }
    return []
  })()
  const alertes = []
  for (const item of parsed) {
    const nomItem = (item.name || item.nom || '').toLowerCase()
    if (!nomItem) continue
    const match = stockItems.find(s =>
      s.alerte !== 'ok' &&
      (s.nom.toLowerCase().includes(nomItem) || nomItem.includes(s.nom.toLowerCase()))
    )
    if (match) {
      alertes.push({ nom: item.name || item.nom, alerte: match.alerte, stockNom: match.nom })
    }
  }
  return alertes
}

// ── Composant carte commande ──────────────────────────────────────────────────
function CarteCommande({ cmd, onNext, updating, now, stockItems }) {
  const next      = STATUS_NEXT[cmd.status]
  const timer     = fmtTimer(cmd.createdAt, now)
  const items     = fmtItems(cmd.items)
  const col       = COL[cmd.status] || COL.nouveau
  // C4 — alertes stock liées aux articles de cette commande
  const alertes   = detecterAlertesCommande(cmd.items, stockItems)
  const hasRupture = alertes.some(a => a.alerte === 'rupture')
  const hasFaible  = alertes.some(a => a.alerte === 'faible')

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${col.color}35`,
      borderTop: `3px solid ${col.color}`,
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      animation: cmd.status === 'nouveau' ? 'pulseNew 2.5s ease 4' : undefined,
      transition: 'opacity .3s',
      opacity: updating === cmd.id ? 0.5 : 1,
    }}>
      {/* Ligne 1 : ID + Timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: GOLD, letterSpacing: .5 }}>
          #{cmd.id?.slice(-6)?.toUpperCase()}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: timer.color,
          background: `${timer.color}18`, border: `1px solid ${timer.color}35`,
          borderRadius: 20, padding: '3px 10px',
          animation: timer.critical ? 'blink 1s step-end infinite' : timer.urgent ? 'pulseUrgent 1.5s ease infinite' : undefined,
        }}>
          ⏱ {timer.txt}
        </span>
      </div>

      {/* Ligne 2 : Client + Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: IVORY }}>{cmd.client || 'Anonyme'}</span>
        {cmd.mode && (
          <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: `${IVORY}70`, background: `${IVORY}0a`, padding: '2px 7px', borderRadius: 4 }}>
            {cmd.mode}
          </span>
        )}
      </div>

      {/* Ligne 3 : Articles */}
      <div style={{
        fontSize: 13, color: `${IVORY}BB`, lineHeight: 1.8,
        background: 'rgba(255,255,255,.03)', borderRadius: 10,
        padding: '10px 12px', border: '1px solid rgba(255,255,255,.05)',
        whiteSpace: 'pre-line', fontWeight: 500,
      }}>
        {items}
      </div>

      {/* C4 — Badge alertes stock ─────────────────────────────────────────── */}
      {alertes.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          background: hasRupture ? 'rgba(239,68,68,.07)' : 'rgba(245,158,11,.07)',
          border: `1px solid ${hasRupture ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}`,
          borderRadius: 10, padding: '8px 12px',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: hasRupture ? '#EF4444' : '#F59E0B', letterSpacing: .5 }}>
            {hasRupture ? '🚨 RUPTURE DE STOCK' : '⚠️ STOCK FAIBLE'} — vérifier avant préparation
          </span>
          {alertes.map((a, i) => (
            <span key={i} style={{ fontSize: 11, color: a.alerte === 'rupture' ? '#EF4444' : '#F59E0B', opacity: .85 }}>
              · {a.stockNom} {a.alerte === 'rupture' ? '(épuisé)' : '(niveau bas)'}
            </span>
          ))}
        </div>
      )}

      {/* Note spéciale */}
      {cmd.note && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 7,
          background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)',
          borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#F59E0B',
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span>{cmd.note}</span>
        </div>
      )}

      {/* Bouton action — cible tactile ≥ 48px (WCAG 2.5.5) */}
      {next && (
        <button
          onTouchStart={(e) => { e.preventDefault(); if (updating !== cmd.id) onNext(cmd.id, next) }}
          onClick={() => { if (updating !== cmd.id) onNext(cmd.id, next) }}
          disabled={updating === cmd.id}
          style={{
            width: '100%', padding: '16px 12px',
            background: updating === cmd.id
              ? 'rgba(255,255,255,.06)'
              : `linear-gradient(135deg, ${COL[next]?.color || '#22C55E'}, ${COL[next]?.color || '#22C55E'}bb)`,
            border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: .3,
            cursor: updating === cmd.id ? 'wait' : 'pointer',
            transition: 'all .15s', fontFamily: 'var(--font-dm)',
            WebkitTapHighlightColor: 'transparent',
            minHeight: 52,
          }}
        >
          {updating === cmd.id ? '⏳ Mise à jour…' : STATUS_LABEL_BTN[cmd.status]}
        </button>
      )}

      {cmd.status === 'pret' && (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#22C55E', fontWeight: 600, padding: '8px 0' }}>
          ✅ En attente d'encaissement
        </div>
      )}
    </div>
  )
}

// ── C1 : Composant onglet Stock Cuisine ───────────────────────────────────────
function StockCuisineTab({ stockItems, stats, loading, filtreCat, setFiltreCat, alertesOnly, setAlertesOnly }) {
  // Catégories disponibles
  const categories = ['Tout', ...Array.from(new Set(stockItems.map(i => i.cat))).sort()]

  const visibles = stockItems.filter(item => {
    const catOk    = filtreCat === 'Tout' || item.cat === filtreCat
    const alerteOk = !alertesOnly || item.alerte !== 'ok'
    return catOk && alerteOk
  })

  // Tri : ruptures d'abord, puis faibles, puis ok
  const ORDRE = { rupture: 0, faible: 1, ok: 2 }
  const tries  = [...visibles].sort((a, b) => ORDRE[a.alerte] - ORDRE[b.alerte] || a.nom.localeCompare(b.nom))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Barre filtres ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px',
        background: EBONY, borderBottom: '1px solid rgba(255,255,255,.05)',
        flexShrink: 0,
      }}>
        {/* Toggle alertes seulement */}
        <button
          onClick={() => setAlertesOnly(v => !v)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: alertesOnly ? 'rgba(239,68,68,.18)' : 'rgba(255,255,255,.06)',
            color:      alertesOnly ? '#EF4444'             : `${IVORY}60`,
            fontSize: 12, fontWeight: 700,
            outline: alertesOnly ? '2px solid rgba(239,68,68,.35)' : 'none',
          }}
        >
          🚨 Alertes seulement {alertesOnly && stats ? `(${stats.ruptures + stats.faibles})` : ''}
        </button>

        {/* Filtres catégories */}
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltreCat(cat)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: filtreCat === cat ? `${GOLD}22` : 'rgba(255,255,255,.05)',
              color:      filtreCat === cat ? GOLD         : `${IVORY}55`,
              fontSize: 12, fontWeight: 700,
              outline: filtreCat === cat ? `2px solid ${GOLD}40` : 'none',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Grille articles ─────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${IVORY}40`, gap: 10 }}>
          <span style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          Chargement du stock…
        </div>
      ) : tries.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: `${IVORY}30`, gap: 8 }}>
          <span style={{ fontSize: 36 }}>📦</span>
          <span style={{ fontSize: 14 }}>{alertesOnly ? 'Aucune alerte — stock en ordre ✓' : 'Aucun article'}</span>
        </div>
      ) : (
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 10,
          alignContent: 'start',
        }}
          className="col-scroll"
        >
          {tries.map(item => <CarteStock key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

// ── C2 : Carte article de stock ───────────────────────────────────────────────
function CarteStock({ item }) {
  const cfg  = ALERTE_CFG[item.alerte]
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${cfg.color}30`,
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 9,
        cursor: item.platsLies?.length ? 'pointer' : 'default',
        transition: 'border-color .2s',
      }}
      onClick={() => item.platsLies?.length && setOpen(v => !v)}
    >
      {/* Ligne 1 : Nom + badge alerte */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: IVORY, lineHeight: 1.3, flex: 1 }}>
          {item.nom}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase',
          color: cfg.color, background: cfg.bg,
          border: `1px solid ${cfg.color}40`,
          borderRadius: 20, padding: '3px 9px', flexShrink: 0,
          animation: item.alerte === 'rupture' ? 'blink 1.5s step-end infinite' : undefined,
        }}>
          {item.alerte === 'ok' ? '✓ OK' : item.alerte === 'faible' ? '⚠ Faible' : '🚨 Rupture'}
        </span>
      </div>

      {/* Ligne 2 : Quantité + catégorie */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: cfg.color }}>
          {fmtQte(item.stock, item.unite)}
        </span>
        <span style={{ fontSize: 10, color: `${IVORY}45`, background: `${IVORY}08`, padding: '2px 8px', borderRadius: 4, letterSpacing: .8 }}>
          {item.cat}
        </span>
      </div>

      {/* C2 — Jauge niveauPct ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          height: 6, borderRadius: 99,
          background: 'rgba(255,255,255,.07)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${item.niveauPct}%`,
            background: item.niveauPct > 60
              ? '#22C55E'
              : item.niveauPct > 30
                ? '#F59E0B'
                : '#EF4444',
            borderRadius: 99,
            transition: 'width .5s ease',
          }} />
        </div>
        {item.seuil > 0 && (
          <span style={{ fontSize: 10, color: `${IVORY}35` }}>
            Seuil alerte : {fmtQte(item.seuil, item.unite)}
          </span>
        )}
      </div>

      {/* Plats liés — expandable */}
      {item.platsLies?.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: `${IVORY}50`, fontWeight: 600,
          }}>
            <span>{open ? '▾' : '▸'}</span>
            <span>{item.platsLies.length} plat{item.platsLies.length > 1 ? 's' : ''} utilise{item.platsLies.length > 1 ? 'nt' : ''} cet ingrédient</span>
          </div>
          {open && (
            <div style={{
              background: 'rgba(255,255,255,.03)', borderRadius: 8,
              padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {item.platsLies.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: `${IVORY}70` }}>
                  <span>🍽 {p.nom}</span>
                  <span style={{ color: `${IVORY}45` }}>{p.quantite} {p.unite}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── A1–A5 : Composant onglet Aperçu quantités ─────────────────────────────────
function ApercuTab({ stockItems, stats, loading }) {
  const [sortKey,  setSortKey]  = useState('nom')     // 'nom' | 'stock' | 'alerte' | 'cat'
  const [sortAsc,  setSortAsc]  = useState(true)
  const [catOuvert, setCatOuvert] = useState({})      // { [cat]: boolean }

  // Groupement par catégorie
  const categories = Array.from(new Set(stockItems.map(i => i.cat))).sort()

  // Tri
  const ORDRE_ALERTE = { rupture: 0, faible: 1, ok: 2 }
  function trier(items) {
    return [...items].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'nom')    cmp = a.nom.localeCompare(b.nom)
      if (sortKey === 'stock')  cmp = a.stock - b.stock
      if (sortKey === 'alerte') cmp = ORDRE_ALERTE[a.alerte] - ORDRE_ALERTE[b.alerte]
      if (sortKey === 'cat')    cmp = a.cat.localeCompare(b.cat)
      return sortAsc ? cmp : -cmp
    })
  }

  function onSort(key) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  function toggleCat(cat) {
    setCatOuvert(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  // Initialiser toutes les catégories ouvertes
  useEffect(() => {
    if (categories.length > 0 && Object.keys(catOuvert).length === 0) {
      const init = {}
      categories.forEach(c => { init[c] = true })
      setCatOuvert(init)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length])

  const allItems = trier(stockItems)

  const TH = ({ label, sortId, style = {} }) => {
    const active = sortKey === sortId
    return (
      <th
        onClick={() => onSort(sortId)}
        style={{
          padding: '9px 12px', textAlign: 'left', fontSize: 11,
          fontWeight: 800, letterSpacing: .8, textTransform: 'uppercase',
          color: active ? GOLD : `${IVORY}40`,
          cursor: 'pointer', userSelect: 'none',
          borderBottom: `2px solid ${active ? GOLD : 'rgba(255,255,255,.06)'}`,
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        {label} {active ? (sortAsc ? '▴' : '▾') : ''}
      </th>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── A2 : KPI cards ────────────────────────────────────────────────── */}
      {stats && (
        <div style={{
          display: 'flex', gap: 10, padding: '12px 16px',
          background: EBONY, borderBottom: '1px solid rgba(255,255,255,.05)',
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Articles total', value: stats.total,    color: IVORY,     bg: 'rgba(255,255,255,.05)' },
            { label: '🚨 Ruptures',    value: stats.ruptures, color: '#EF4444', bg: 'rgba(239,68,68,.08)',   anim: stats.ruptures > 0 },
            { label: '⚠️ Faibles',     value: stats.faibles,  color: '#F59E0B', bg: 'rgba(245,158,11,.08)'  },
            { label: '✓ OK',           value: stats.ok,       color: '#22C55E', bg: 'rgba(34,197,94,.08)'   },
          ].map(kpi => (
            <div key={kpi.label} style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              background: kpi.bg, border: `1px solid ${kpi.color}25`,
              borderRadius: 12, padding: '8px 16px', minWidth: 90,
              animation: kpi.anim ? 'pulseUrgent 2s ease infinite' : undefined,
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</span>
              <span style={{ fontSize: 10, color: `${IVORY}55`, letterSpacing: .7 }}>{kpi.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Contenu ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `${IVORY}40`, gap: 10 }}>
          <span style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          Chargement…
        </div>
      ) : stockItems.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: `${IVORY}30`, gap: 8 }}>
          <span style={{ fontSize: 36 }}>📊</span>
          <span style={{ fontSize: 14 }}>Aucun article en stock</span>
        </div>
      ) : (
        <div className="col-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>

          {/* ── A3 : Tableau par catégorie ───────────────────────────────── */}
          {categories.map(cat => {
            const itemsCat  = allItems.filter(i => i.cat === cat)
            const nbRupture = itemsCat.filter(i => i.alerte === 'rupture').length
            const nbFaible  = itemsCat.filter(i => i.alerte === 'faible').length
            const open      = catOuvert[cat] !== false  // ouvert par défaut

            return (
              <div key={cat} style={{ marginTop: 16 }}>

                {/* En-tête catégorie — cliquable */}
                <div
                  onClick={() => toggleCat(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    background: `${GOLD}0a`,
                    border: `1px solid ${GOLD}20`,
                    borderRadius: open ? '12px 12px 0 0' : 12,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 900, color: GOLD, flex: 1, letterSpacing: .5, textTransform: 'uppercase' }}>
                    {open ? '▾' : '▸'} {cat}
                  </span>
                  <span style={{ fontSize: 11, color: `${IVORY}45` }}>{itemsCat.length} article{itemsCat.length > 1 ? 's' : ''}</span>
                  {nbRupture > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 20, padding: '2px 8px', animation: 'pulseUrgent 1.5s ease infinite' }}>
                      🚨 {nbRupture} rupture{nbRupture > 1 ? 's' : ''}
                    </span>
                  )}
                  {nbFaible > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 20, padding: '2px 8px' }}>
                      ⚠️ {nbFaible} faible{nbFaible > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Tableau ingrédients de cette catégorie */}
                {open && (
                  <div className="cuisine-table-wrap">
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    background: EBONY,
                    border: `1px solid ${GOLD}18`, borderTop: 'none',
                    borderRadius: '0 0 12px 12px', overflow: 'hidden',
                    fontSize: 13,
                  }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                        <TH label="Ingrédient" sortId="nom"    style={{ width: '35%' }} />
                        <TH label="Quantité"   sortId="stock"  style={{ width: '18%' }} />
                        <TH label="Niveau"                     style={{ width: '25%' }} />
                        <TH label="Statut"     sortId="alerte" style={{ width: '22%' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {itemsCat.map((item, idx) => {
                        const cfg = ALERTE_CFG[item.alerte]
                        return (
                          <tr
                            key={item.id}
                            style={{
                              borderTop: `1px solid rgba(255,255,255,.04)`,
                              background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)',
                            }}
                          >
                            {/* Nom */}
                            <td style={{ padding: '10px 12px', color: IVORY, fontWeight: 600 }}>
                              {item.nom}
                              {item.platsLies?.length > 0 && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: `${IVORY}35` }}>
                                  ({item.platsLies.length} plat{item.platsLies.length > 1 ? 's' : ''})
                                </span>
                              )}
                            </td>

                            {/* Quantité */}
                            <td style={{ padding: '10px 12px', fontWeight: 800, color: cfg.color, whiteSpace: 'nowrap' }}>
                              {Number.isInteger(item.stock) ? item.stock : item.stock.toFixed(1)} {item.unite}
                            </td>

                            {/* Jauge miniature ─────────────────────────────── */}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${item.niveauPct}%`,
                                    background: item.niveauPct > 60 ? '#22C55E' : item.niveauPct > 30 ? '#F59E0B' : '#EF4444',
                                    borderRadius: 99,
                                    transition: 'width .5s ease',
                                  }} />
                                </div>
                                <span style={{ fontSize: 10, color: `${IVORY}30` }}>
                                  {item.niveauPct}%
                                  {item.seuil > 0 && ` · seuil ${item.seuil} ${item.unite}`}
                                </span>
                              </div>
                            </td>

                            {/* Badge statut */}
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase',
                                color: cfg.color, background: cfg.bg,
                                border: `1px solid ${cfg.color}40`,
                                borderRadius: 20, padding: '3px 9px',
                                animation: item.alerte === 'rupture' ? 'blink 1.5s step-end infinite' : undefined,
                                whiteSpace: 'nowrap',
                              }}>
                                {item.alerte === 'ok' ? '✓ OK' : item.alerte === 'faible' ? '⚠ Faible' : '🚨 Rupture'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


export default function CuisineApp({ user }) {
  const router = useRouter()

  // ── État onglets ──────────────────────────────────────────────────────────
  const [onglet, setOnglet] = useState('commandes') // 'commandes' | 'stock' | 'apercu'

  // ── État commandes ────────────────────────────────────────────────────────
  const [commandes,  setCommandes]  = useState([])
  const [loadingCmd, setLoadingCmd] = useState(true)
  const [updating,   setUpdating]   = useState(null)
  const [now,        setNow]        = useState(Date.now())
  const [colFilter,  setColFilter]  = useState('all')
  const [swipeStart, setSwipeStart] = useState(null)
  const prevCountRef = useRef(0)

  // ── État stock ────────────────────────────────────────────────────────────
  const [stockItems,   setStockItems]   = useState([])
  const [stockStats,   setStockStats]   = useState(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [filtreCat,    setFiltreCat]    = useState('Tout')
  const [alertesOnly,  setAlertesOnly]  = useState(false)
  // Timestamp de la dernière invalidation de cache (C6 — SSE stock_alerte)
  const stockCacheRef = useRef(0)

  const { canInstall, isInstalled, installPWA } = usePWA()

  // ── Horloge des timers ────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(iv)
  }, [])

  // ── Chargement commandes ──────────────────────────────────────────────────
  const fetchCommandes = useCallback(async () => {
    try {
      const res  = await fetch('/api/commandes', { cache: 'no-store' })
      const data = await res.json()
      const all  = Array.isArray(data) ? data : (data?.commandes || [])
      setCommandes(all.filter(c => !['livre', 'annule'].includes(c.status)))
    } catch (e) { console.error('[CuisineApp/commandes]', e) }
    finally { setLoadingCmd(false) }
  }, [])

  useEffect(() => {
    fetchCommandes()
    const iv = setInterval(fetchCommandes, 120_000)
    return () => clearInterval(iv)
  }, [fetchCommandes])

  // ── Chargement stock ──────────────────────────────────────────────────────
  const fetchStock = useCallback(async (force = false) => {
    // Cache 3 min côté client — évite les appels inutiles si l'onglet n'est pas ouvert
    const now_ = Date.now()
    if (!force && now_ - stockCacheRef.current < 3 * 60_000 && stockItems.length > 0) return
    setLoadingStock(true)
    try {
      const res  = await fetch('/api/cuisine/stocks', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStockItems(data.items || [])
      setStockStats(data.stats || null)
      stockCacheRef.current = Date.now()
    } catch (e) { console.error('[CuisineApp/stock]', e) }
    finally { setLoadingStock(false) }
  }, [stockItems.length])

  // Charger le stock quand on bascule sur cet onglet
  useEffect(() => {
    if (onglet === 'stock' || onglet === 'apercu') fetchStock()
  }, [onglet, fetchStock])

  // Rafraîchissement périodique stock si onglet actif (3 min)
  useEffect(() => {
    if (onglet !== 'stock' && onglet !== 'apercu') return
    const iv = setInterval(() => fetchStock(true), 3 * 60_000)
    return () => clearInterval(iv)
  }, [onglet, fetchStock])

  // ── SSE ───────────────────────────────────────────────────────────────────
  const { connected: sseConnected } = useSSE({
    onCommandeNouvelle: (cmd) => {
      setCommandes(prev => {
        if (prev.find(c => c.id === cmd.id)) return prev
        if (navigator.vibrate) navigator.vibrate([100, 50, 100])
        return [cmd, ...prev]
      })
    },
    onCommandeStatus: ({ id, status }) => {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    },
    // C6 — SSE stock_alerte : invalide le cache stock immédiatement
    onStockAlerte: () => {
      stockCacheRef.current = 0          // invalidation cache
      if (onglet === 'stock') fetchStock(true)
      // Même si l'onglet commandes est actif, on recharge en tâche de fond
      // pour que les badges C4 soient à jour
      else fetchStock(true)
    },
  })

  // ── Titre onglet dynamique ────────────────────────────────────────────────
  const nbNouvelles = commandes.filter(c => c.status === 'nouveau').length
  useEffect(() => {
    if (nbNouvelles > prevCountRef.current) {
      document.title = `(${nbNouvelles}) Cuisine – CMB`
    } else {
      document.title = 'Cuisine – Chez Maman Biya'
    }
    prevCountRef.current = nbNouvelles
  }, [nbNouvelles])

  // ── Action mise à jour statut ─────────────────────────────────────────────
  async function updateStatus(id, status) {
    setUpdating(id)
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    try {
      const res = await fetch(`/api/commandes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Erreur serveur')
      if (status === 'pret') {
        setTimeout(() => setCommandes(prev => prev.filter(c => c.id !== id)), 10_000)
      }
    } catch {
      fetchCommandes()
    } finally {
      setUpdating(null)
    }
  }

  // ── Swipe navigation colonnes (portrait) ──────────────────────────────────
  const COLS_ORDER = ['all', 'nouveau', 'en_cours', 'en_preparation', 'pret']

  function onTouchStart(e) { setSwipeStart(e.touches[0].clientX) }
  function onTouchEnd(e) {
    if (swipeStart === null || onglet !== 'commandes') return
    const dx  = e.changedTouches[0].clientX - swipeStart
    if (Math.abs(dx) < 60) return
    const idx = COLS_ORDER.indexOf(colFilter)
    if (dx < 0 && idx < COLS_ORDER.length - 1) setColFilter(COLS_ORDER[idx + 1])
    if (dx > 0 && idx > 0)                     setColFilter(COLS_ORDER[idx - 1])
    setSwipeStart(null)
  }

  // ── Colonnes kanban ───────────────────────────────────────────────────────
  const colonnes = [
    { key: 'nouveau',        cmds: commandes.filter(c => c.status === 'nouveau')        },
    { key: 'en_cours',       cmds: commandes.filter(c => c.status === 'en_cours')       },
    { key: 'en_preparation', cmds: commandes.filter(c => c.status === 'en_preparation') },
    { key: 'pret',           cmds: commandes.filter(c => c.status === 'pret')           },
  ]
  const colonnesVisibles = colFilter === 'all'
    ? colonnes
    : colonnes.filter(c => c.key === colFilter)

  // C5 — total alertes stock pour le badge en-tête
  const totalAlertes = stockStats ? stockStats.ruptures + stockStats.faibles : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        minHeight: '100dvh', background: EBONY, color: IVORY,
        fontFamily: 'var(--font-dm)',
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes pulseNew    { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,.5)} 60%{box-shadow:0 0 0 12px rgba(59,130,246,0)} }
        @keyframes pulseUrgent { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes blink       { 0%,49%{opacity:1} 50%,100%{opacity:.2} }
        @keyframes slideIn     { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }
        @keyframes spin        { to{transform:rotate(360deg)} }
        .col-scroll::-webkit-scrollbar { display: none }
        .col-scroll { scrollbar-width: none }
        button:active { transform: scale(.97); }
        /* ── Responsive ─────────────────────────────────────────────────── */
        .cuisine-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 0 0 12px 12px; }
        .cuisine-table-wrap table { min-width: 460px; }
        @media (max-width: 480px) {
          .cuisine-sse-label     { display: none !important; }
          .cuisine-install-label { display: none !important; }
        }
        @media (max-width: 360px) {
          .cuisine-header-resto  { display: none !important; }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{
        height: 56, background: `${EBONY}F7`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${GOLD}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>👨‍🍳</span>
          <div className="cuisine-header-resto">
            <div style={{ fontSize: 14, fontWeight: 800, color: GOLD, letterSpacing: .3 }}>
              Cuisine — Chez Maman Biya
            </div>
            <div style={{ fontSize: 10, color: `${IVORY}40`, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {user?.name || user?.login}
            </div>
          </div>
        </div>

        {/* Droite */}
        <div className="cuisine-header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* KPI nouvelles commandes */}
          {nbNouvelles > 0 && (
            <div style={{
              background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.4)',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#3B82F6',
              animation: 'pulseNew 2s ease infinite',
            }}>
              🆕 {nbNouvelles} nouvelle{nbNouvelles > 1 ? 's' : ''}
            </div>
          )}

          {/* C5 — Badge alertes stock */}
          {totalAlertes > 0 && (
            <button
              onClick={() => setOnglet('stock')}
              style={{
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.4)',
                borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#EF4444',
                cursor: 'pointer',
                animation: 'pulseUrgent 2s ease infinite',
              }}
            >
              🚨 {totalAlertes} alerte{totalAlertes > 1 ? 's' : ''} stock
            </button>
          )}

          {/* Badge SSE */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
            color:      sseConnected ? '#22C55E' : '#F59E0B',
            background: sseConnected ? 'rgba(34,197,94,.08)'  : 'rgba(245,158,11,.08)',
            border:     `1px solid ${sseConnected ? 'rgba(34,197,94,.25)' : 'rgba(245,158,11,.3)'}`,
            borderRadius: 20, padding: '4px 10px',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0,
              animation: sseConnected ? 'pulseNew 2s ease infinite' : undefined,
            }} />
            <span className="cuisine-sse-label">{sseConnected ? 'Temps réel' : 'Reconnexion…'}</span>
          </div>

          {/* Installer PWA */}
          {canInstall && !isInstalled && (
            <button
              onClick={installPWA}
              style={{ background: `${GOLD}25`, border: `1px solid ${GOLD}60`, color: GOLD, borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              📲 <span className="cuisine-install-label">Installer</span>
            </button>
          )}

          {/* Déconnexion */}
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/admin/login') }}
            style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.25)', color: '#EF4444', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer' }}
          >
            Déco
          </button>
        </div>
      </header>

      {/* ── Navigation onglets ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        background: EBONY, borderBottom: `1px solid ${GOLD}20`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setOnglet('commandes')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
            background: onglet === 'commandes' ? `${GOLD}12` : 'transparent',
            color:      onglet === 'commandes' ? GOLD         : `${IVORY}50`,
            fontSize: 13, fontWeight: 800, letterSpacing: .3,
            borderBottom: onglet === 'commandes' ? `2px solid ${GOLD}` : '2px solid transparent',
            transition: 'all .15s',
          }}
        >
          🔥 Commandes
          {nbNouvelles > 0 && (
            <span style={{
              marginLeft: 8, background: '#3B82F6', color: '#fff',
              borderRadius: '50%', width: 18, height: 18, fontSize: 11, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {nbNouvelles}
            </span>
          )}
        </button>

        <button
          onClick={() => setOnglet('stock')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
            background: onglet === 'stock' ? 'rgba(34,197,94,.08)' : 'transparent',
            color:      onglet === 'stock' ? '#22C55E'              : `${IVORY}50`,
            fontSize: 13, fontWeight: 800, letterSpacing: .3,
            borderBottom: onglet === 'stock' ? '2px solid #22C55E' : '2px solid transparent',
            transition: 'all .15s',
            position: 'relative',
          }}
        >
          📦 Stock cuisine
          {/* C5 — badge rouge si alertes */}
          {totalAlertes > 0 && (
            <span style={{
              marginLeft: 8, background: '#EF4444', color: '#fff',
              borderRadius: '50%', width: 18, height: 18, fontSize: 11, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulseUrgent 1.5s ease infinite',
            }}>
              {totalAlertes}
            </span>
          )}
        </button>

        <button
          onClick={() => setOnglet('apercu')}
          style={{
            flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
            background: onglet === 'apercu' ? 'rgba(201,151,60,.08)' : 'transparent',
            color:      onglet === 'apercu' ? GOLD                    : `${IVORY}50`,
            fontSize: 13, fontWeight: 800, letterSpacing: .3,
            borderBottom: onglet === 'apercu' ? `2px solid ${GOLD}` : '2px solid transparent',
            transition: 'all .15s',
          }}
        >
          📊 Aperçu
        </button>
      </div>

      {/* ── Onglet Commandes ───────────────────────────────────────────────── */}
      {onglet === 'commandes' && (
        <>
          {/* Nav colonnes (mobile portrait) */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 16px',
            background: SURFACE, borderBottom: '1px solid rgba(255,255,255,.05)',
            overflowX: 'auto', flexShrink: 0,
          }}>
            <button
              onClick={() => setColFilter('all')}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none',
                background: colFilter === 'all' ? `${GOLD}22` : 'rgba(255,255,255,.05)',
                color:      colFilter === 'all' ? GOLD         : `${IVORY}45`,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                outline: colFilter === 'all' ? `2px solid ${GOLD}35` : 'none',
              }}
            >
              Tout ({commandes.length})
            </button>
            {colonnes.map(col => (
              <button
                key={col.key}
                onClick={() => setColFilter(col.key)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none',
                  background: colFilter === col.key ? `${COL[col.key].color}18` : 'rgba(255,255,255,.05)',
                  color:      colFilter === col.key ?  COL[col.key].color        : `${IVORY}45`,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  outline: colFilter === col.key ? `2px solid ${COL[col.key].color}35` : 'none',
                }}
              >
                {COL[col.key].emoji} {COL[col.key].label} {col.cmds.length > 0 ? `(${col.cmds.length})` : ''}
              </button>
            ))}
          </div>

          {/* Grille kanban */}
          {loadingCmd ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: `${IVORY}40`, fontSize: 14 }}>
              <span style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
              Chargement…
            </div>
          ) : (
            <div className="cuisine-kanban" style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: `repeat(${colonnesVisibles.length}, 1fr)`,
              gap: 0,
              overflow: 'hidden',
              padding: '0 0 env(safe-area-inset-bottom)',
            }}>
              {colonnesVisibles.map(col => {
                const cfg = COL[col.key]
                return (
                  <div key={col.key} className="cuisine-kanban-col" style={{
                    display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid rgba(255,255,255,.05)',
                    background: cfg.bg, minWidth: 0,
                  }}>
                    {/* En-tête colonne */}
                    <div style={{
                      padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: `2px solid ${cfg.color}35`, background: `${cfg.color}08`, flexShrink: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, letterSpacing: .5 }}>
                          {cfg.label}
                        </span>
                      </div>
                      <span style={{
                        background: col.cmds.length > 0 ? cfg.color : 'rgba(255,255,255,.08)',
                        color:      col.cmds.length > 0 ? '#fff'    : `${IVORY}30`,
                        borderRadius: '50%', width: 24, height: 24, fontSize: 12, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {col.cmds.length}
                      </span>
                    </div>

                    {/* Cartes commandes */}
                    <div className="col-scroll" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {col.cmds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: `${IVORY}20`, fontSize: 13 }}>
                          Vide
                        </div>
                      ) : (
                        col.cmds.map(cmd => (
                          <CarteCommande
                            key={cmd.id}
                            cmd={cmd}
                            onNext={updateStatus}
                            updating={updating}
                            now={now}
                            stockItems={stockItems}   // C4 — cross-check stock
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Indic swipe (portrait) */}
          {colonnesVisibles.length === 1 && (
            <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: `${IVORY}20`, flexShrink: 0 }}>
              ← Glisser pour changer de colonne →
            </div>
          )}
        </>
      )}

      {/* ── Onglet Stock ───────────────────────────────────────────────────── */}
      {onglet === 'stock' && (
        <StockCuisineTab
          stockItems={stockItems}
          stats={stockStats}
          loading={loadingStock}
          filtreCat={filtreCat}
          setFiltreCat={setFiltreCat}
          alertesOnly={alertesOnly}
          setAlertesOnly={setAlertesOnly}
        />
      )}

      {/* ── Onglet Aperçu ──────────────────────────────────────────────────── */}
      {onglet === 'apercu' && (
        <ApercuTab
          stockItems={stockItems}
          stats={stockStats}
          loading={loadingStock}
        />
      )}
    </div>
  )
}
