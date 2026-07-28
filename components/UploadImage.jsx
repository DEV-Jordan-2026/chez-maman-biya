'use client'
// components/UploadImage.jsx
// Composant réutilisable : upload de fichier local → Cloudinary
// + champ URL manuelle en fallback
// Utilisé dans : MenuPanel, ImagesPanel
//
// Props :
//   value       {string}   URL actuelle de l'image
//   onChange    {fn}       callback(url: string)
//   label       {string}   label affiché
//   hint        {string}   texte d'aide optionnel
//   height      {number}   hauteur de la prévisualisation (défaut 120)
//   placeholder {string}   placeholder du champ URL
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'cmb_plats'

export default function UploadImage({ value, onChange, label, hint, height = 120, placeholder }) {
  const inputRef            = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [erreur,    setErreur]    = useState('')
  const [showUrl,   setShowUrl]   = useState(false) // bascule vers saisie URL manuelle

  // ── Upload vers Cloudinary (upload non signé via preset) ─────────────────
  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation locale avant upload
    if (!file.type.startsWith('image/')) {
      setErreur('Fichier non supporté. Choisissez une image (JPG, PNG, WEBP…).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setErreur('Fichier trop lourd (max 8 Mo). Compressez l\'image avant upload.')
      return
    }

    if (!CLOUD) {
      setErreur('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME non configuré dans .env')
      return
    }

    setErreur('')
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('file',          file)
      fd.append('upload_preset', PRESET)
      fd.append('folder',        'cmb')

      const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
        { method: 'POST', body: fd }
      )
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Upload échoué (${res.status})`)
      }

      // URL optimisée : f_auto,q_auto pour conversion automatique WebP et compression
      const url = data.secure_url.replace('/upload/', '/upload/f_auto,q_auto/')
      onChange(url)
    } catch (err) {
      setErreur(`Échec : ${err.message}`)
    } finally {
      setUploading(false)
      // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputStyle = {
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(201,151,60,.2)',
    borderRadius: 8, padding: '9px 12px',
    color: 'var(--cream)', fontSize: 13,
    fontFamily: 'inherit', width: '100%',
    boxSizing: 'border-box', outline: 'none',
  }

  const btnStyle = (active) => ({
    flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: uploading ? 'not-allowed' : 'pointer',
    transition: 'all .15s',
    border: active
      ? '1px solid rgba(201,151,60,.5)'
      : '1px solid rgba(201,151,60,.15)',
    background: active
      ? 'rgba(201,151,60,.12)'
      : 'rgba(255,255,255,.03)',
    color: active ? 'var(--gold)' : 'rgba(245,239,230,.5)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Label */}
      {label && (
        <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(201,151,60,.7)' }}>
          {label}
        </label>
      )}

      {/* Prévisualisation */}
      <ImagePreview url={value} height={height} />

      {/* Boutons mode */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => { setShowUrl(false); inputRef.current?.click() }}
          disabled={uploading}
          style={btnStyle(!showUrl)}
        >
          {uploading ? '⏳ Upload…' : '📁 Depuis ma machine'}
        </button>
        <button
          type="button"
          onClick={() => setShowUrl(v => !v)}
          style={btnStyle(showUrl)}
        >
          🔗 URL
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setErreur('') }}
            style={{ flex: '0 0 auto', background: 'none', border: '1px solid rgba(239,68,68,.2)', color: 'rgba(239,68,68,.6)', padding: '9px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Input file caché */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {/* Champ URL manuelle — visible si showUrl ou si pas de Cloudinary configuré */}
      {(showUrl || !CLOUD) && (
        <div>
          <input
            type="url"
            value={value || ''}
            onChange={e => { onChange(e.target.value); setErreur('') }}
            placeholder={placeholder || 'https://res.cloudinary.com/…/image.jpg'}
            style={inputStyle}
          />
          {!CLOUD && (
            <div style={{ fontSize: 10, color: '#f59e0b', opacity: .8, marginTop: 4 }}>
              ⚠️ Cloudinary non configuré — configurez NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME pour activer l'upload.
            </div>
          )}
        </div>
      )}

      {/* Message d'erreur */}
      {erreur && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '6px 10px' }}>
          ❌ {erreur}
        </div>
      )}

      {/* Hint */}
      {hint && !erreur && (
        <div style={{ fontSize: 10, opacity: .35, lineHeight: 1.5 }}>{hint}</div>
      )}
    </div>
  )
}

// ── Prévisualisation interne ──────────────────────────────────────────────────
function ImagePreview({ url, height }) {
  const [status, setStatus] = useState('idle')

  // Reset quand l'URL change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (!url && status !== 'idle') setStatus('idle')

  if (!url) {
    return (
      <div style={{
        height, borderRadius: 8,
        background: 'rgba(255,255,255,.02)',
        border: '2px dashed rgba(201,151,60,.15)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 6, color: 'rgba(245,239,230,.25)', fontSize: 12,
      }}>
        <span style={{ fontSize: 28 }}>🖼️</span>
        <span>Aucune image</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(201,151,60,.2)', background: '#111' }}>
      <img
        src={url}
        alt="Aperçu"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('err')}
      />
      {status === 'err' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(239,68,68,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#f87171',
        }}>
          ❌ Image inaccessible
        </div>
      )}
      {status === 'ok' && (
        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(16,185,129,.85)', borderRadius: 4, padding: '2px 7px', fontSize: 9, fontWeight: 700, color: '#fff' }}>
          ✓ OK
        </div>
      )}
    </div>
  )
}
