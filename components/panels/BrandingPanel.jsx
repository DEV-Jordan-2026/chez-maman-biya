'use client'
// components/panels/BrandingPanel.jsx — Branding & Identité · Chez Maman Biya
// Panneau admin : palette de couleurs dynamique + logo + infos restaurant
// S'intègre dans AdminClient.js comme les autres panels

import { useState, useRef } from 'react'
import { useRestaurantConfig } from '@/hooks/useRestaurantConfig'
import { PRESETS, COLOR_LABELS, DEFAULT_CONFIG, COLOR_CSS_MAP } from '@/config/restaurant.config'

const PANEL_BG   = 'rgba(255,255,255,.03)'
const BORDER     = '1px solid rgba(201,151,60,.12)'
const BORDER_H   = '1px solid rgba(201,151,60,.3)'

const INFO_FIELDS = [
  { key: 'nom',      label: 'Nom du restaurant',      placeholder: 'Chez Maman Biya',        full: true  },
  { key: 'tagline',  label: 'Sous-titre / Tagline',    placeholder: 'Restaurant · Yaoundé',   full: true  },
  { key: 'adresse',  label: 'Adresse complète',        placeholder: 'Bastos, Yaoundé, CM',    full: true  },
  { key: 'tel',      label: 'Téléphone',               placeholder: '+237 677 000 000',       full: false },
  { key: 'email',    label: 'Email',                   placeholder: 'contact@resto.cm',       full: false },
  { key: 'whatsapp', label: 'WhatsApp (sans espaces)', placeholder: '+237677000000',          full: false },
]

function applyLiveColor(key, val) {
  const cssVar = COLOR_CSS_MAP[key]
  if (cssVar) document.documentElement.style.setProperty(cssVar, val)
}

export default function BrandingPanel() {
  const { config, saveConfig, resetConfig, loaded } = useRestaurantConfig()
  const [draft,   setDraft]   = useState(null)
  const [toast,   setToast]   = useState(null)
  const [logoErr, setLogoErr] = useState('')
  const fileRef = useRef()

  const cur      = draft || config
  const hasDraft = draft !== null

  function patch(updates) {
    setDraft(prev => ({ ...(prev || config), ...updates }))
  }

  function patchColor(key, val) {
    setDraft(prev => ({
      ...(prev || config),
      couleurs: { ...(prev || config).couleurs, [key]: val },
    }))
    applyLiveColor(key, val)
  }

  function applyPreset(preset) {
    setDraft(prev => ({ ...(prev || config), couleurs: preset.couleurs }))
    Object.entries(preset.couleurs).forEach(([k, v]) => applyLiveColor(k, v))
  }

  function handleSave() {
    if (!draft) return
    saveConfig(draft)
    setDraft(null)
    showToast('✅ Configuration sauvegardée')
  }

  function handleCancel() {
    // Rétablir les couleurs sauvegardées sur :root
    Object.entries(config.couleurs).forEach(([k, v]) => applyLiveColor(k, v))
    setDraft(null)
  }

  function handleReset() {
    if (!window.confirm('Réinitialiser toutes les couleurs, le logo et les informations ?')) return
    resetConfig()
    setDraft(null)
    showToast('🔄 Réinitialisé aux valeurs par défaut')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  function onFileChange(e) {
    const file = e.target.files?.[0]
    setLogoErr('')
    if (!file) return
    if (!file.type.startsWith('image/')) { setLogoErr('Format invalide (PNG, JPG, SVG, WebP)'); return }
    if (file.size > 2 * 1024 * 1024) { setLogoErr('Fichier trop lourd (max 2 Mo)'); return }
    const reader = new FileReader()
    reader.onload = ev => patch({ logo: ev.target.result })
    reader.readAsDataURL(file)
  }

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) onFileChange({ target: { files: [file] } })
  }

  if (!loaded) return (
    <div style={{ padding: 32, opacity: .35, fontSize: 13, color: 'var(--cream)' }}>Chargement…</div>
  )

  return (
    <div style={{ padding: '8px 0', fontFamily: 'var(--font-dm)', color: 'var(--cream)', position: 'relative' }}>
      <style>{`
        @keyframes bpToastIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .bp-color-pill::-webkit-color-swatch-wrapper { padding: 0 }
        .bp-color-pill::-webkit-color-swatch { border: none; border-radius: 6px }
        .bp-color-pill::-moz-color-swatch { border: none; border-radius: 6px }
        .bp-input:focus { border-color: rgba(201,151,60,.6) !important; box-shadow: 0 0 0 3px rgba(201,151,60,.08); outline: none; }
        .bp-preset:hover { transform: translateY(-2px); border-color: rgba(201,151,60,.4) !important; }
        .bp-color-row:hover { background: rgba(255,255,255,.035) !important; }
        .bp-logo-zone:hover { border-color: rgba(201,151,60,.5) !important; background: rgba(201,151,60,.04) !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,163,74,.92)', color: '#fff',
          borderRadius: 10, padding: '11px 22px', zIndex: 9999,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,.3)',
          animation: 'bpToastIn .32s cubic-bezier(.22,1,.36,1)',
        }}>{toast}</div>
      )}

      {/* Header panel */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 22, color: 'var(--gold)', marginBottom: 6 }}>
          🎨 Branding &amp; Identité
        </h2>
        <p style={{ fontSize: 12, opacity: .38, lineHeight: 1.7 }}>
          Palette de couleurs, logo et informations du restaurant.
          Les couleurs s'appliquent en aperçu immédiat — sauvegardez pour les rendre permanentes.
        </p>
      </div>

      {/* ── LOGO ─────────────────────────────────────────────────── */}
      <Section titre="Logo du restaurant" emoji="🏠">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Upload */}
          <div style={{ flex: '1 1 200px' }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={onFileChange} style={{ display: 'none' }} />

            {cur.logo ? (
              <div>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                  <img src={cur.logo} alt="Logo" style={{
                    height: 72, maxWidth: 220, objectFit: 'contain', borderRadius: 10,
                    border: '1px solid rgba(201,151,60,.2)', padding: '8px 12px',
                    background: 'rgba(255,255,255,.03)',
                  }} />
                  <button onClick={() => patch({ logo: null })} title="Supprimer" style={{
                    position: 'absolute', top: -8, right: -8,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--terracotta)', border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                </div>
                <div>
                  <button onClick={() => fileRef.current?.click()} style={{
                    background: 'none', border: '1px solid rgba(201,151,60,.3)',
                    borderRadius: 7, padding: '6px 14px',
                    color: 'var(--gold)', fontSize: 12, cursor: 'pointer',
                    transition: 'background .18s', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,151,60,.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >Changer le logo</button>
                </div>
              </div>
            ) : (
              <button className="bp-logo-zone"
                onClick={() => fileRef.current?.click()}
                onDrop={onDrop} onDragOver={e => e.preventDefault()}
                style={{
                  width: '100%', minHeight: 110,
                  border: '2px dashed rgba(201,151,60,.22)', borderRadius: 12,
                  background: 'rgba(201,151,60,.015)', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 7,
                  color: 'rgba(240,232,216,.32)', transition: 'border-color .18s, background .18s',
                }}>
                <span style={{ fontSize: 28 }}>📁</span>
                <span style={{ fontSize: 12, letterSpacing: .5 }}>Cliquer ou glisser-déposer</span>
                <span style={{ fontSize: 10, opacity: .6 }}>PNG · JPG · SVG · WebP — max 2 Mo</span>
              </button>
            )}

            {logoErr && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{logoErr}</p>}

            <p style={{ fontSize: 10, opacity: .25, marginTop: 10, lineHeight: 1.6 }}>
              Affiché dans la Navbar, les reçus et les factures.
              Fond transparent recommandé.
            </p>
          </div>

          {/* Aperçu */}
          <div style={{ flex: '1 1 200px' }}>
            <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: .28, marginBottom: 10 }}>Aperçu</p>
            <ApercuLogo logo={cur.logo} nom={cur.nom} tagline={cur.tagline} />
          </div>
        </div>
      </Section>

      {/* ── INFOS RESTAURANT ─────────────────────────────────────── */}
      <Section titre="Informations restaurant" emoji="📋">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
          {INFO_FIELDS.map(({ key, label, placeholder, full }) => (
            <div key={key} style={{ gridColumn: full ? '1/-1' : 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: .35 }}>{label}</label>
              <input
                className="bp-input"
                type="text"
                value={cur[key] || ''}
                placeholder={placeholder}
                onChange={e => patch({ [key]: e.target.value })}
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(201,151,60,.18)',
                  borderRadius: 8, padding: '10px 12px',
                  color: 'var(--cream)', fontSize: 13,
                  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
                  transition: 'border-color .18s, box-shadow .18s',
                }}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── PALETTE ──────────────────────────────────────────────── */}
      <Section titre="Palette de couleurs" emoji="🎨">

        {/* Presets */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: .28, marginBottom: 12 }}>Thèmes prédéfinis</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PRESETS.map(preset => {
              const isActive = JSON.stringify(cur.couleurs) === JSON.stringify(preset.couleurs)
              return (
                <button key={preset.id} className="bp-preset"
                  onClick={() => applyPreset(preset)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    background: isActive ? 'rgba(201,151,60,.12)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${isActive ? 'rgba(201,151,60,.45)' : 'rgba(201,151,60,.15)'}`,
                    borderRadius: 9, padding: '8px 14px', cursor: 'pointer',
                    color: 'var(--cream)', fontSize: 12,
                    transition: 'transform .2s, border-color .2s', fontFamily: 'inherit',
                  }}>
                  <span>{preset.emoji}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['gold','ebony','terracotta','cream'].map(k => (
                      <div key={k} style={{ width: 9, height: 9, borderRadius: 2, background: preset.couleurs[k], border: '1px solid rgba(255,255,255,.1)' }} />
                    ))}
                  </div>
                  <span>{preset.nom}</span>
                  {isActive && <span style={{ fontSize: 9, color: 'var(--gold)' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Pickers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(COLOR_LABELS).map(([key, info]) => (
            <div key={key} className="bp-color-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.07)',
                borderRadius: 10, padding: '10px 14px',
                transition: 'background .15s',
              }}>
              <label style={{ cursor: 'pointer', flexShrink: 0 }} title={`Modifier ${info.label}`}>
                <input type="color" className="bp-color-pill"
                  value={cur.couleurs[key] || '#000000'}
                  onChange={e => patchColor(key, e.target.value)}
                  style={{ width: 42, height: 42, borderRadius: 8, border: '2px solid rgba(255,255,255,.12)', padding: 2, cursor: 'pointer', display: 'block', background: 'none' }}
                />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{info.label}</div>
                <div style={{ fontSize: 11, opacity: .3 }}>{info.desc}</div>
              </div>
              <input type="text"
                value={(cur.couleurs[key] || '').toUpperCase()}
                onChange={e => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) patchColor(key, e.target.value) }}
                style={{
                  fontFamily: 'monospace', fontSize: 12, width: 78, textAlign: 'center',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.15)',
                  borderRadius: 6, padding: '4px 6px', color: 'rgba(240,232,216,.5)',
                }}
              />
              {/* Pastille valeur par défaut */}
              <div title="Revenir au défaut" onClick={() => patchColor(key, DEFAULT_CONFIG.couleurs[key])}
                style={{ width: 20, height: 20, borderRadius: 4, background: DEFAULT_CONFIG.couleurs[key], cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Bande aperçu */}
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 10, opacity: .28, marginBottom: 8, letterSpacing: 2, textTransform: 'uppercase' }}>Aperçu dégradé</p>
          <div style={{
            height: 12, borderRadius: 8,
            background: `linear-gradient(90deg, ${cur.couleurs.ebony}, ${cur.couleurs.terracotta}, ${cur.couleurs.gold}, ${cur.couleurs.goldLight}, ${cur.couleurs.cream})`,
          }} />
        </div>
      </Section>

      {/* ── ACTIONS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button onClick={handleSave} disabled={!hasDraft}
          style={{
            background: hasDraft ? 'linear-gradient(135deg, var(--gold), var(--gold-dark))' : 'rgba(201,151,60,.15)',
            color: hasDraft ? 'var(--ebony)' : 'rgba(240,232,216,.2)',
            border: 'none', borderRadius: 10, padding: '12px 26px',
            fontSize: 13, fontWeight: 700, cursor: hasDraft ? 'pointer' : 'not-allowed',
            letterSpacing: .5, transition: 'transform .18s, box-shadow .18s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (hasDraft) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(201,151,60,.3)' } }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
        >💾 Sauvegarder</button>

        {hasDraft && (
          <button onClick={handleCancel} style={{
            background: 'none', border: '1px solid rgba(240,232,216,.12)',
            borderRadius: 10, padding: '12px 18px', fontSize: 12,
            color: 'rgba(240,232,216,.35)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Annuler</button>
        )}

        <button onClick={handleReset} style={{
          marginLeft: 'auto', background: 'none', border: 'none',
          color: 'rgba(240,232,216,.2)', cursor: 'pointer', fontSize: 12,
          textDecoration: 'underline', fontFamily: 'inherit',
        }}>Réinitialiser par défaut</button>
      </div>

      {hasDraft && (
        <p style={{ fontSize: 11, opacity: .3, marginTop: 10, textAlign: 'right' }}>⚠️ Modifications non sauvegardées</p>
      )}
    </div>
  )
}

// ── Sous-composants ──────────────────────────────────────────────

function Section({ titre, emoji, children }) {
  return (
    <div style={{
      background: PANEL_BG, border: BORDER,
      borderRadius: 14, padding: '20px 22px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', opacity: .42, margin: 0 }}>
          {titre}
        </h3>
      </div>
      {children}
    </div>
  )
}

function ApercuLogo({ logo, nom, tagline }) {
  const n = nom || 'Nom du restaurant'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Navbar */}
      <div style={{ background: 'rgba(8,6,5,.9)', borderRadius: 8, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 9, border: '1px solid rgba(201,151,60,.1)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(201,151,60,.2)', background: 'rgba(201,151,60,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {logo ? <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 13 }}>🍲</span>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)' }}>{n}</div>
          {tagline && <div style={{ fontSize: 7, opacity: .3, letterSpacing: 1.5, textTransform: 'uppercase' }}>{tagline}</div>}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 7, opacity: .2, letterSpacing: 1 }}>NAVBAR</span>
      </div>
      {/* Reçu */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 5, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {logo ? <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 12 }}>🍲</span>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a1a' }}>{n}</div>
          {tagline && <div style={{ fontSize: 7, color: '#999', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tagline}</div>}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 7, color: '#bbb', letterSpacing: 1 }}>REÇU</span>
      </div>
    </div>
  )
}
