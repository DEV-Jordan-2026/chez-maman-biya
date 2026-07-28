'use client'

import { useState, useEffect, useCallback } from 'react'

const TYPE_ICONS = {
  commande:    { emoji: '📦', color: 'var(--gold)' },
  menu:        { emoji: '🍽️', color: 'var(--success)' },
  caisse:      { emoji: '💳', color: 'var(--warning)' },
  equipe:      { emoji: '👥', color: '#8b5cf6' },
  stock:       { emoji: '📦', color: 'var(--info)' },
  reservation: { emoji: '📅', color: '#ec4899' },
  parametres:  { emoji: '⚙️', color: '#6b7280' },
  paiement:    { emoji: '💰', color: 'var(--success)' },
  remise:      { emoji: '🏷️', color: 'var(--warning)' },
  connexion:   { emoji: '🔐', color: '#22d3ee' },
}

// Libellés rôles pour les détails de connexion
const ROLE_LABELS = {
  super_admin:    'Propriétaire',
  manager:        'Gérant',
  caissier:       'Caissier',
  serveur:        'Serveur',
  staff:          'Staff cuisine',
  magasinier:     'Magasinier',
  receptionniste: 'Réceptionniste',
  livreur:        'Livreur',
}

// Icônes spécifiques par raison d'échec de connexion
const RAISON_ICONS = {
  identifiants_incorrects: '🚫',
  hors_plage:              '⏰',
  hors_planning:           '📅',
}

const DAY_HEADER_STYLE = {
  fontSize: 11, opacity: .35, letterSpacing: 1.5, textTransform: 'uppercase',
  marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid rgba(201,151,60,.08)',
}

const META_LINE_STYLE = {
  fontSize: 11, color: 'var(--cream-faint)', marginTop: 4,
  display: 'flex', gap: 12, flexWrap: 'wrap',
}

function fmtHeure(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDuree(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/**
 * Reconstitue les sessions (entrée / sortie) par utilisateur à partir du flux
 * chronologique d'entrées du journal.
 * - "Connexion réussie" ouvre une session pour cet auteur.
 * - La prochaine "Déconnexion" du même auteur la referme.
 * - Toute autre entrée (commande, menu, caisse…) survenue pendant une
 *   session ouverte est rattachée à celle-ci comme "action effectuée".
 * - Les tentatives refusées/échouées restent des entrées isolées.
 */
function buildSessions(entries) {
  const chrono = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const sessions = []
  const ouvertes = {} // auteur -> session en cours

  for (const e of chrono) {
    if (e.type === 'connexion') {
      if (e.action === 'Connexion réussie') {
        const s = { id: e.id, entree: e, sortie: null, echec: null, actions: [] }
        sessions.push(s)
        ouvertes[e.auteur] = s
      } else if (e.action === 'Déconnexion') {
        const s = ouvertes[e.auteur]
        if (s && !s.sortie) {
          s.sortie = e
          delete ouvertes[e.auteur]
        } else {
          sessions.push({ id: e.id, entree: null, sortie: e, echec: null, actions: [] })
        }
      } else {
        // Tentative échouée / hors plage horaire — entrée isolée
        sessions.push({ id: e.id, entree: null, sortie: null, echec: e, actions: [] })
      }
    } else {
      const s = ouvertes[e.auteur]
      if (s) s.actions.push(e)
    }
  }

  return sessions.reverse() // plus récent en premier
}

function SessionRow({ session, expanded, onToggle }) {
  const { entree, sortie, echec, actions } = session

  // ── Tentative refusée / échouée : pas de session ─────────────────────────
  if (echec) {
    const meta = echec.meta || {}
    const icon = RAISON_ICONS[meta.raison] || '⛔'
    const role = meta.role && ROLE_LABELS[meta.role]
    const ip   = meta.ip && meta.ip !== 'unknown' ? meta.ip : null

    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--ebony-2)', borderRadius: 10, borderLeft: '3px solid #EF444470' }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#EF4444' }}>{echec.action}</div>
          {(role || ip) && (
            <div style={META_LINE_STYLE}>
              {role && <span>👤 {role}</span>}
              {ip   && <span>🌐 {ip}</span>}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: .5 }}>{fmtHeure(echec.createdAt)}</div>
          <div style={{ fontSize: 10, opacity: .35 }}>{echec.auteur}</div>
        </div>
      </div>
    )
  }

  // ── Session avec entrée (et éventuellement sortie) ───────────────────────
  const auteur  = entree?.auteur || sortie?.auteur || '—'
  const roleKey = entree?.meta?.role || sortie?.meta?.role
  const role    = roleKey && ROLE_LABELS[roleKey]
  const ip      = (entree?.meta?.ip && entree.meta.ip !== 'unknown') ? entree.meta.ip : null
  const duree   = (entree && sortie) ? formatDuree(new Date(sortie.createdAt) - new Date(entree.createdAt)) : null
  const hasActions = actions.length > 0

  return (
    <div style={{ background: 'var(--ebony-2)', borderRadius: 10, borderLeft: '3px solid #22d3ee30', overflow: 'hidden' }}>
      <div
        onClick={hasActions ? onToggle : undefined}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', cursor: hasActions ? 'pointer' : 'default' }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🔐</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
            {auteur}{role ? ` · ${role}` : ''}
          </div>
          <div style={META_LINE_STYLE}>
            <span>🟢 Entrée {entree ? fmtHeure(entree.createdAt) : '—'}</span>
            {sortie
              ? <span>🔴 Sortie {fmtHeure(sortie.createdAt)}</span>
              : <span style={{ color: 'var(--gold)' }}>🟡 Pas de déconnexion enregistrée</span>}
            {duree && <span>⏱️ {duree}</span>}
            {ip && <span>🌐 {ip}</span>}
          </div>
        </div>
        {hasActions && (
          <div style={{ flexShrink: 0, alignSelf: 'center', fontSize: 11, color: 'var(--gold)', whiteSpace: 'nowrap' }}>
            {expanded ? '▲ Masquer' : `▼ ${actions.length} action${actions.length > 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      {expanded && hasActions && (
        <div style={{ borderTop: '1px solid rgba(201,151,60,.08)', padding: '10px 14px 12px 42px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map(a => {
            const info = TYPE_ICONS[a.type] || { emoji: '📝', color: '#6b7280' }
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                <span style={{ flexShrink: 0 }}>{info.emoji}</span>
                <span style={{ flex: 1, opacity: .8, lineHeight: 1.5 }}>{a.action}</span>
                <span style={{ flexShrink: 0, opacity: .4, fontSize: 11 }}>{fmtHeure(a.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function JournalPanel() {
  const [entries,  setEntries]  = useState([])
  const [filtre,   setFiltre]   = useState('tous')
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState({})

  const fetchJournal = useCallback(async () => {
    try {
      // Vue "Connexion" : on récupère tous les types (limite max API = 200)
      // pour pouvoir rattacher les actions effectuées à chaque session.
      const url = filtre === 'tous'      ? '/api/journal?limit=100'
                : filtre === 'connexion' ? '/api/journal?limit=200'
                : `/api/journal?type=${filtre}&limit=100`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }, [filtre])

  useEffect(() => { fetchJournal() }, [fetchJournal])

  const toggleSession = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const types = ['tous', ...Object.keys(TYPE_ICONS)]
  const isConnexionView = filtre === 'connexion'

  // ── Vue "Connexion" : sessions entrée/sortie + actions ────────────────────
  const sessions = isConnexionView ? buildSessions(entries) : []
  const parJourSessions = {}
  for (const s of sessions) {
    const ref = s.entree || s.sortie || s.echec
    const d = new Date(ref.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!parJourSessions[d]) parJourSessions[d] = []
    parJourSessions[d].push(s)
  }

  // ── Vue standard : flux chronologique ─────────────────────────────────────
  const parJour = {}
  for (const e of entries) {
    const d = new Date(e.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!parJour[d]) parJour[d] = []
    parJour[d].push(e)
  }

  const isEmpty = isConnexionView ? sessions.length === 0 : entries.length === 0

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {types.map(t => {
          const info = TYPE_ICONS[t]
          return (
            <button key={t} onClick={() => setFiltre(t)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${filtre === t ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`,
              background: filtre === t ? 'rgba(201,151,60,.1)' : 'transparent',
              color: filtre === t ? 'var(--gold)' : 'var(--cream-faint)',
            }}>
              {info ? `${info.emoji} ` : ''}{t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          )
        })}
        <button onClick={fetchJournal} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(201,151,60,.2)', background: 'none', color: 'var(--gold)' }}>↻ Actualiser</button>
      </div>

      {isConnexionView && !loading && sessions.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginBottom: 16, fontStyle: 'italic' }}>
          Touchez une session pour voir les actions effectuées durant la connexion.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', opacity: .3 }}>Chargement…</div>
      ) : isEmpty ? (
        <div style={{ textAlign: 'center', padding: '40px 0', opacity: .3 }}>
          {isConnexionView ? 'Aucune connexion enregistrée' : 'Aucune activité enregistrée'}
        </div>
      ) : isConnexionView ? (

        Object.entries(parJourSessions).map(([jour, items]) => (
          <div key={jour} style={{ marginBottom: 28 }}>
            <div style={DAY_HEADER_STYLE}>
              {jour} · {items.length} session{items.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(s => (
                <SessionRow key={s.id} session={s} expanded={!!expanded[s.id]} onToggle={() => toggleSession(s.id)} />
              ))}
            </div>
          </div>
        ))

      ) : Object.entries(parJour).map(([jour, items]) => (
        <div key={jour} style={{ marginBottom: 28 }}>
          <div style={DAY_HEADER_STYLE}>
            {jour} · {items.length} action{items.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(e => {
              const meta  = e.meta || {}
              const echec = e.type === 'connexion' && meta.succes === false

              const info = echec
                ? { emoji: RAISON_ICONS[meta.raison] || '⛔', color: '#EF4444' }
                : (TYPE_ICONS[e.type] || { emoji: '📝', color: '#6b7280' })

              const showRole = e.type === 'connexion' && meta.role && ROLE_LABELS[meta.role]
              const showIp   = e.type === 'connexion' && meta.ip && meta.ip !== 'unknown'

              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--ebony-2)', borderRadius: 10, borderLeft: `3px solid ${info.color}${echec ? '70' : '30'}` }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{info.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: echec ? '#EF4444' : undefined }}>{e.action}</div>
                    {(showRole || showIp) && (
                      <div style={META_LINE_STYLE}>
                        {showRole && <span>👤 {ROLE_LABELS[meta.role]}</span>}
                        {showIp   && <span>🌐 {meta.ip}</span>}
                      </div>
                    )}
                    {e.ref && <div style={{ fontSize: 11, color: info.color, opacity: .7, marginTop: 2 }}>Réf: {e.ref}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, opacity: .5 }}>{fmtHeure(e.createdAt)}</div>
                    <div style={{ fontSize: 10, opacity: .35 }}>{e.auteur}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
