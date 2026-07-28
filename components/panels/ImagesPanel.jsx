'use client'
// components/panels/ImagesPanel.jsx
// Panneau admin : gestion des images du site public
// — Arrière-plans (hero, CTA, menu)
// — Galerie d'ambiance (5 photos)
// — Plats vedettes (auto depuis menu, géré via MenuPanel)

import { useState, useEffect } from 'react'
import UploadImage from '@/components/UploadImage'

// ── Valeurs par défaut Unsplash (identiques à l'API) ─────────────────────────
const DEFAULTS = {
  hero_bg: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1800&q=85',
  cta_bg:  'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1400&q=80',
  menu_bg: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b5?w=1200&q=60',
  galerie: [
    { url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=90',  label: 'Ambiance salle' },
    { url: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b5?w=500&q=85', label: 'Marché de Mokolo' },
    { url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=500&q=85', label: 'Ndolé maison' },
    { url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=85', label: 'Préparation' },
    { url: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=500&q=85', label: 'Plantain doré' },
  ],
}

// ── Panel principal ───────────────────────────────────────────────────────────
export default function ImagesPanel() {
  const [draft,   setDraft]   = useState(null)          // null = pas chargé
  const [saved,   setSaved]   = useState(null)           // dernière config sauvegardée
  const [toast,   setToast]   = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [platVedettes, setPlatVedettes] = useState([])

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/images').then(r => r.json()).catch(() => DEFAULTS),
      fetch('/api/menu').then(r => r.json()).catch(() => []),
    ]).then(([images, menu]) => {
      setSaved(images)
      setDraft(images)
      setPlatVedettes(Array.isArray(menu) ? menu.filter(p => p.popular || p.actif).slice(0, 3) : [])
      setLoading(false)
    })
  }, [])

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Patch helper ─────────────────────────────────────────────────────────
  function patch(key, val) {
    setDraft(prev => ({ ...prev, [key]: val }))
  }
  function patchGalerie(index, field, val) {
    setDraft(prev => {
      const g = [...(prev.galerie || DEFAULTS.galerie)]
      g[index] = { ...g[index], [field]: val }
      return { ...prev, galerie: g }
    })
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const res  = await fetch('/api/images', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setSaved(draft)
      showToast('✅ Images sauvegardées — le site est mis à jour', 'ok')
    } catch (err) {
      showToast(`❌ ${err.message}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!confirm('Réinitialiser toutes les images aux valeurs par défaut (Unsplash) ?')) return
    setDraft(DEFAULTS)
    showToast('🔄 Valeurs par défaut restaurées — sauvegardez pour appliquer', 'info')
  }

  function handleCancel() {
    setDraft(saved)
    showToast('↩️ Modifications annulées', 'info')
  }

  const hasDraft = draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)

  if (loading) return (
    <div style={{ padding: '60px 0', textAlign: 'center', opacity: .3 }}>Chargement des images…</div>
  )

  const S = {
    section: { background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.12)', borderRadius: 14, padding: '24px 20px', marginBottom: 20 },
    sTitle:  { fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 },
    sHint:   { fontSize: 11, opacity: .4, marginBottom: 20, lineHeight: 1.6 },
    input:   { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, padding: '8px 12px', color: 'var(--cream)', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' },
  }

  return (
    <div style={{ padding: '0 0 60px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'err' ? 'rgba(239,68,68,.15)' : toast.type === 'info' ? 'rgba(59,130,246,.15)' : 'rgba(16,185,129,.15)',
          border: `1px solid ${toast.type === 'err' ? 'rgba(239,68,68,.35)' : toast.type === 'info' ? 'rgba(59,130,246,.35)' : 'rgba(16,185,129,.35)'}`,
          borderRadius: 10, padding: '12px 20px',
          color: toast.type === 'err' ? '#f87171' : toast.type === 'info' ? '#93c5fd' : '#6ee7b7',
          fontSize: 13, fontWeight: 600, maxWidth: 380,
        }}>
          {toast.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 4 }}>🖼️ Images du site</h2>
          <p style={{ fontSize: 12, opacity: .4, margin: 0 }}>
            Gérez les fonds, la galerie et les plats vedettes sans toucher au code.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasDraft && (
            <button onClick={handleCancel} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(245,239,230,.5)', padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              Annuler
            </button>
          )}
          <button onClick={handleReset} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(245,239,230,.4)', padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            ↺ Réinitialiser
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasDraft}
            style={{
              background: (!hasDraft || saving) ? 'rgba(201,151,60,.2)' : 'linear-gradient(135deg, var(--gold), #a85f28)',
              border: 'none', color: '#fff',
              padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: (!hasDraft || saving) ? 'not-allowed' : 'pointer',
              opacity: !hasDraft ? .5 : 1,
            }}
          >
            {saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Indicateur de modifications non sauvegardées */}
      {hasDraft && (
        <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#f59e0b' }}>
          ⚠️ Modifications non sauvegardées — cliquez sur "Sauvegarder" pour les appliquer sur le site.
        </div>
      )}

      {/* Note upload */}
      <div style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12 }}>
        <strong style={{ color: '#6ee7b7' }}>📁 Upload depuis votre machine</strong>
        <span style={{ opacity: .6 }}> Cliquez sur "Depuis ma machine" pour choisir un fichier directement (JPG, PNG, WEBP — max 8 Mo). L'image est hébergée automatiquement sur Cloudinary. Vous pouvez aussi coller une URL via le bouton 🔗.</span>
      </div>

      {/* ── 1. Arrière-plans ────────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sTitle}>🌄 Arrière-plans</div>
        <div style={{ ...S.sHint }}>Ces images s'affichent en fond des grandes sections du site.</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <UploadImage
            label="Page d'accueil — Section Hero"
            hint="Photo principale à l'ouverture du site. Format paysage recommandé."
            value={draft?.hero_bg || ''}
            onChange={v => patch('hero_bg', v)}
            height={140}
          />
          <UploadImage
            label="Page d'accueil — Section CTA"
            hint="Fond de la section 'Commandez dès maintenant' en bas de page."
            value={draft?.cta_bg || ''}
            onChange={v => patch('cta_bg', v)}
            height={140}
          />
          <UploadImage
            label="Page Menu — Bannière"
            hint="Fond de l'en-tête de la page carte du restaurant."
            value={draft?.menu_bg || ''}
            onChange={v => patch('menu_bg', v)}
            height={140}
          />
        </div>
      </div>

      {/* ── 2. Galerie d'ambiance ───────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sTitle}>📷 Galerie d'ambiance (5 photos)</div>
        <div style={S.sHint}>
          Affiché dans la section "Notre restaurant, notre famille". La première photo est grande format (occupe toute la hauteur).
          Idéalement : salle, cuisine, plats, équipe, marché.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(draft?.galerie || DEFAULTS.galerie).map((item, i) => (
            <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,.02)', borderRadius: 10, border: '1px solid rgba(201,151,60,.08)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Numéro + légende */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(201,151,60,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  {i === 0 && (
                    <span style={{ fontSize: 10, background: 'rgba(201,151,60,.12)', border: '1px solid rgba(201,151,60,.25)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                      Grande photo
                    </span>
                  )}
                </div>

                {/* Upload image galerie */}
                <div>
                  <UploadImage
                    label="IMAGE"
                    value={item.url}
                    onChange={url => patchGalerie(i, 'url', url)}
                    height={i === 0 ? 160 : 120}
                  />
                </div>

                {/* Légende */}
                <div>
                  <label style={{ fontSize: 10, opacity: .5, textTransform: 'uppercase', letterSpacing: 1 }}>Légende</label>
                  <input
                    type="text"
                    value={item.label}
                    onChange={e => patchGalerie(i, 'label', e.target.value)}
                    placeholder="Ex: Ambiance salle"
                    maxLength={40}
                    style={S.input}
                  />
                </div>
              </div>


            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Plats vedettes ──────────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sTitle}>⭐ Plats vedettes (page d'accueil)</div>
        <div style={S.sHint}>
          Les 3 plats mis en avant sur la page d'accueil sont automatiquement les items marqués comme
          <strong style={{ color: 'var(--gold)' }}> "Populaire"</strong> dans la carte. Gérez-les depuis l'onglet <strong>Carte & Menu</strong>.
        </div>

        {platVedettes.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {platVedettes.map((plat, i) => (
              <div key={plat.id || i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,151,60,.12)', borderRadius: 10, overflow: 'hidden' }}>
                {plat.image ? (
                  <img src={plat.image} alt={plat.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div style={{ height: 100, background: 'rgba(201,151,60,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                    {plat.emoji || '🍽️'}
                  </div>
                )}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{plat.name}</div>
                  <div style={{ fontSize: 11, opacity: .5 }}>{(plat.price || 0).toLocaleString('fr-FR')} FCFA</div>
                  {plat.popular && (
                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, background: 'rgba(201,151,60,.12)', color: 'var(--gold)', padding: '1px 7px', borderRadius: 8, fontWeight: 700 }}>
                      ⭐ Populaire
                    </span>
                  )}
                  {!plat.image && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#f59e0b', opacity: .8 }}>
                      ⚠️ Pas d'image — ajoutez une URL dans la carte
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px', background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, fontSize: 12, color: '#f59e0b' }}>
            Aucun plat marqué comme populaire. Allez dans <strong>Carte & Menu</strong> → cochez "Populaire" sur 3 plats, puis ajoutez leur URL photo.
          </div>
        )}

        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 8, fontSize: 11, color: 'rgba(245,239,230,.5)', lineHeight: 1.7 }}>
          💡 Pour changer l'image d'un plat : onglet <strong style={{ color: 'var(--cream)' }}>Carte & Menu</strong> → cliquez sur le plat → champ <em>URL photo</em>.
        </div>
      </div>
    </div>
  )
}
