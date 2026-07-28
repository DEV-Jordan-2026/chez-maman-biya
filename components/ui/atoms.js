/**
 * components/ui/atoms.js — CMB Design System v29
 *
 * Atomes réutilisables partagés entre tous les composants opérateurs :
 * MagasinierClient, ServeurClient, StaffClient, CaissierClient, CuisineApp.
 *
 * Chaque atome utilise les CSS variables de globals.css pour rester
 * cohérent avec le design system global.
 *
 * Usage :
 *   import { Spinner, Badge, Empty, FeedbackMsg, KPICard } from '@/components/ui/atoms'
 */
'use client'

// ── Spinner ───────────────────────────────────────────────────────────────────
// Indicateur de chargement inline.
// color : CSS value (ex: 'var(--gold)', '#84cc16')
// size  : px (défaut 24)
export function Spinner({ size = 24, color = 'var(--gold)' }) {
  return (
    <div
      aria-label="Chargement…"
      role="status"
      style={{
        width: size, height: size,
        border: `3px solid color-mix(in srgb, currentColor 12%, transparent)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        color,
        flexShrink: 0,
      }}
    />
  )
}

// ── SpinnerPage ───────────────────────────────────────────────────────────────
// Spinner centré sur toute la zone de contenu.
export function SpinnerPage({ color = 'var(--gold)' }) {
  return (
    <div style={{ textAlign: 'center', padding: 48, display: 'flex', justifyContent: 'center' }}>
      <Spinner size={28} color={color} />
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
// Pill de statut colorée.
// color : hex ou CSS var
// label : string
export function Badge({ color, label }) {
  return (
    <span style={{
      fontSize: 11,
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      color,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      padding: '2px 9px',
      borderRadius: 20,
      flexShrink: 0,
      fontWeight: 600,
      letterSpacing: 0.3,
    }}>
      {label}
    </span>
  )
}

// ── BadgeLegacy ───────────────────────────────────────────────────────────────
// Version sans color-mix pour compatibilité max (Safari < 16.4, Chrome < 111).
// À utiliser si le build target inclut d'anciens WebView Android (Tecno/Infinix).
export function BadgeLegacy({ color, label }) {
  const toRgba = (hex, a) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }
  const bg = color.startsWith('#') ? toRgba(color, 0.1) : `${color}1a`
  return (
    <span style={{
      fontSize: 11, background: bg, color,
      border: `1px solid ${color.startsWith('#') ? toRgba(color, 0.28) : `${color}47`}`,
      padding: '2px 9px', borderRadius: 20,
      flexShrink: 0, fontWeight: 600, letterSpacing: 0.3,
    }}>
      {label}
    </span>
  )
}

// ── Empty ─────────────────────────────────────────────────────────────────────
// État vide centré.
// icon : emoji string
// text : description
export function Empty({ icon, text }) {
  return (
    <div style={{
      textAlign: 'center', padding: '44px 20px',
      color: 'var(--cream-dim)',
    }}>
      <div style={{ fontSize: 42, marginBottom: 10, lineHeight: 1 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{text}</p>
    </div>
  )
}

// ── FeedbackMsg ───────────────────────────────────────────────────────────────
// Message de feedback inline (succès ou erreur).
// msg : { text: string, type: 'ok' | 'err' }
export function FeedbackMsg({ msg }) {
  if (!msg?.text) return null
  const isErr = msg.type === 'err'
  return (
    <div style={{
      background: isErr ? 'rgba(239,68,68,.07)' : 'rgba(34,197,94,.07)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,.28)' : 'rgba(34,197,94,.28)'}`,
      borderRadius: 10,
      padding: '10px 14px',
      color: isErr ? 'var(--danger)' : 'var(--success)',
      fontSize: 13,
      marginBottom: 14,
    }}>
      {msg.text}
    </div>
  )
}

// ── KPICard ───────────────────────────────────────────────────────────────────
// Carte de KPI animée à l'entrée.
// icon     : ReactNode (SVG ou emoji)
// label    : string
// value    : string | number
// sub      : string (sous-titre optionnel)
// color    : CSS value (défaut var(--gold))
// alert    : bool — met en évidence visuelle si vrai
// index    : int — décale l'animation d'entrée
// onClick  : function optionnelle
export function KPICard({
  icon, label, value, sub,
  color = 'var(--gold)',
  alert = false,
  index = 0,
  onClick,
}) {
  const delay = `${index * 0.08}s`
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{
        background: alert ? `color-mix(in srgb, ${color} 5%, var(--ebony-2))` : 'var(--ebony-2)',
        border: `1px solid ${alert ? `color-mix(in srgb, ${color} 40%, transparent)` : 'var(--border-gold)'}`,
        borderRadius: 14, padding: '18px 20px',
        animation: `fadeUp .5s ${delay} cubic-bezier(.22,1,.36,1) both`,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        transition: 'border-color .2s, box-shadow .2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = alert
          ? `color-mix(in srgb, ${color} 60%, transparent)`
          : 'var(--border-gold-h)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = alert
          ? `color-mix(in srgb, ${color} 40%, transparent)`
          : 'var(--border-gold)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Pastille d'alerte */}
      {alert && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 7, height: 7, borderRadius: '50%',
          background: color,
          animation: 'pulseDot 1.5s ease infinite',
        }} />
      )}

      {/* Icône */}
      {icon && (
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12, color, flexShrink: 0,
        }}>
          {icon}
        </div>
      )}

      {/* Valeur */}
      <div style={{
        fontSize: 26, fontWeight: 900,
        color: alert ? color : 'var(--cream)',
        lineHeight: 1, marginBottom: 4,
        animation: 'countUp .55s cubic-bezier(.22,1,.36,1) both',
      }}>
        {value}
      </div>

      {/* Label */}
      <div style={{ fontSize: 11, color: 'var(--cream-dim)', fontWeight: 500 }}>
        {label}
      </div>

      {/* Sous-titre */}
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
