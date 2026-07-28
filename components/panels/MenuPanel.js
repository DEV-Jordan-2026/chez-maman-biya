'use client'

import { useState }     from 'react'
import UploadImage     from '@/components/UploadImage'

const CATS_DEFAULT = ['Entrées', 'Plats', 'Grillades', 'Accompagnements', 'Boissons', 'Desserts']

const s = {
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,151,60,0.2)',
    borderRadius: 8, color: 'var(--cream)',
    padding: '8px 12px', fontSize: 13,
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  label: { fontSize: 10, color: 'rgba(245,239,230,0.35)', letterSpacing: 1, display: 'block', marginBottom: 5 },
}

// ── Carte plat ────────────────────────────────────────────────────────────────
function PlatCard({ plat, isSuperAdmin, onToggle, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({
    name: plat.name, price: plat.price,
    desc: plat.desc || '', emoji: plat.emoji || '',
    image: plat.image || '', popular: plat.popular,
    poste: plat.poste || 'CHAUD',
  })
  const [saving, setSaving] = useState(false)

  async function saveEdit() {
    setSaving(true)
    await onEdit(plat.id, { ...form, image: form.image.trim() || null })
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ background: 'rgba(201,151,60,0.06)', border: '1px solid rgba(201,151,60,0.35)', borderRadius: 12, padding: 16, animation: 'scaleIn .2s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={s.label}>EMOJI</label>
            <input style={{ ...s.input }} value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} maxLength={4} />
          </div>
          <div>
            <label style={s.label}>PRIX (FCFA)</label>
            <input style={{ ...s.input }} type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>NOM</label>
          <input style={{ ...s.input }} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>DESCRIPTION</label>
          <input style={{ ...s.input }} value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <UploadImage
            label="PHOTO DU PLAT"
            value={form.image}
            onChange={url => setForm(p => ({ ...p, image: url }))}
            height={110}
            hint="Laissez vide pour afficher l'emoji à la place."
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>POSTE CUISINE</label>
          <select style={{ ...s.input, width: '100%' }} value={form.poste} onChange={e => setForm(p => ({ ...p, poste: e.target.value }))}>
            <option value="CHAUD">🔥 Chaud</option>
            <option value="FROID">❄️ Froid</option>
            <option value="GRILLADE">🥩 Grillade</option>
            <option value="PATISSERIE">🍰 Pâtisserie</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" id={`pop-${plat.id}`} checked={form.popular} onChange={e => setForm(p => ({ ...p, popular: e.target.checked }))} />
          <label htmlFor={`pop-${plat.id}`} style={{ fontSize: 12, cursor: 'pointer' }}>⭐ Populaire</label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,var(--gold),#a85f28)', border: 'none', color: '#fff', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '…' : '✓ Sauvegarder'}
          </button>
          <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: '1px solid rgba(201,151,60,.25)', color: 'rgba(245,239,230,.5)', padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(201,151,60,0.1)', borderRadius: 12, overflow: 'hidden', opacity: plat.actif ? 1 : 0.5, transition: 'opacity .2s, border-color .2s, box-shadow .2s, background .18s' }}>
      {/* Miniature photo si disponible */}
      {plat.image && (
        <div style={{ height: 80, overflow: 'hidden', position: 'relative' }}>
          <img src={plat.image} alt={plat.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.parentNode.style.display = 'none' }} />
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {!plat.image && <span style={{ fontSize: 22, flexShrink: 0 }}>{plat.emoji}</span>}
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{plat.name}</span>
          </div>
          <span style={{ marginLeft: 8, flexShrink: 0, background: plat.actif ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)', color: plat.actif ? 'var(--success)' : '#6b7280', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
            {plat.actif ? 'ACTIF' : 'INACTIF'}
          </span>
        </div>
        {plat.desc && <div style={{ fontSize: 12, opacity: 0.45, lineHeight: 1.5, marginBottom: 10 }}>{plat.desc}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 16 }}>
            {plat.price.toLocaleString('fr-FR')}
            <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}> FCFA</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {plat.popular && <span style={{ fontSize: 11, opacity: 0.6 }}>⭐ Populaire</span>}
            {plat.poste && plat.poste !== 'CHAUD' && (
              <span style={{ fontSize: 10, background: 'rgba(201,151,60,.1)', color: 'var(--gold)', border: '1px solid rgba(201,151,60,.25)', padding: '1px 7px', borderRadius: 4 }}>
                { {'FROID':'❄️ Froid','GRILLADE':'🥩 Grillade','PATISSERIE':'🍰 Pâtisserie'}[plat.poste] || plat.poste }
              </span>
            )}
            {plat.image && <span style={{ fontSize: 10, opacity: .4 }}>📷</span>}
          </div>
        </div>
        {isSuperAdmin && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(201,151,60,.08)' }}>
            <button onClick={() => setEditing(true)} style={{ flex: 1, background: 'rgba(201,151,60,.08)', border: '1px solid rgba(201,151,60,.2)', color: 'var(--gold)', padding: '6px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              ✏️ Modifier
            </button>
            <button onClick={() => onToggle(plat.id, !plat.actif)} style={{ flex: 1, background: plat.actif ? 'rgba(107,114,128,.1)' : 'rgba(16,185,129,.1)', border: `1px solid ${plat.actif ? 'rgba(107,114,128,.3)' : 'rgba(16,185,129,.3)'}`, color: plat.actif ? '#6b7280' : 'var(--success)', padding: '6px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              {plat.actif ? '⏸ Désactiver' : '▶ Activer'}
            </button>
            <button onClick={() => onDelete(plat.id)} style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--danger)', padding: '6px 10px', borderRadius: 6, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Formulaire ajout ──────────────────────────────────────────────────────────
function FormulaireAjout({ onSuccess }) {
  const [form, setForm] = useState({ name: '', price: '', cat: 'Plats', emoji: '🍽️', desc: '', image: '', popular: false, poste: 'CHAUD' })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  async function ajouter() {
    setErr('')
    if (!form.name || !form.price) { setErr('Nom et prix requis'); return }
    // URL garantie https:// si uploadée via UploadImage — validation non nécessaire
    setBusy(true)
    try {
      const res  = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: parseInt(form.price), image: form.image.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erreur'); setBusy(false); return }
      setForm({ name: '', price: '', cat: 'Plats', emoji: '🍽️', desc: '', image: '', popular: false, poste: 'CHAUD' })
      onSuccess()
    } catch { setErr('Erreur réseau. Veuillez réessayer.') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ background: 'rgba(201,151,60,0.04)', border: '1px solid rgba(201,151,60,0.2)', borderRadius: 14, padding: 18, marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>➕ Ajouter un plat</div>
      {err && <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={s.label}>EMOJI</label>
          <input style={{ ...s.input }} value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} maxLength={4} />
        </div>
        <div>
          <label style={s.label}>NOM</label>
          <input style={{ ...s.input }} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Ndolé au poisson" />
        </div>
        <div>
          <label style={s.label}>PRIX (FCFA)</label>
          <input style={{ ...s.input }} type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="2500" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={s.label}>CATÉGORIE</label>
          <select style={{ ...s.input, background: 'rgba(30,20,10,0.95)' }} value={form.cat} onChange={e => setForm(p => ({ ...p, cat: e.target.value }))}>
            {CATS_DEFAULT.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>POSTE CUISINE</label>
          <select style={{ ...s.input, background: 'rgba(30,20,10,0.95)' }} value={form.poste} onChange={e => setForm(p => ({ ...p, poste: e.target.value }))}>
            <option value="CHAUD">🔥 Chaud</option>
            <option value="FROID">❄️ Froid</option>
            <option value="GRILLADE">🥩 Grillade</option>
            <option value="PATISSERIE">🍰 Pâtisserie</option>
          </select>
        </div>
        <div>
          <label style={s.label}>DESCRIPTION</label>
          <input style={{ ...s.input }} value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} placeholder="Courte description…" />
        </div>
      </div>
      {/* Upload photo */}
      <div style={{ marginBottom: 12 }}>
        <UploadImage
          label="PHOTO DU PLAT (optionnel)"
          value={form.image}
          onChange={url => setForm(p => ({ ...p, image: url }))}
          height={110}
          hint="Si vide : l'emoji sera affiché à la place."
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.popular} onChange={e => setForm(p => ({ ...p, popular: e.target.checked }))} />
          ⭐ Mettre en populaire
        </label>
        <button onClick={ajouter} disabled={busy} style={{ background: 'linear-gradient(135deg,var(--gold),#a85f28)', border: 'none', color: '#fff', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? '⏳ Ajout…' : 'Ajouter le plat'}
        </button>
      </div>
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────────────────────
export default function MenuPanel({ menu: menuProp, user, onRefresh }) {
  const [menu, setMenu]   = useState(menuProp)
  const [feedback, setFb] = useState('')
  const isSuperAdmin = user?.role === 'super_admin'
  const canEdit = isSuperAdmin

  if (menuProp !== menu && !feedback) setMenu(menuProp)

  const cats = [...new Set(menu.map(p => p.cat))]
  const actifs = menu.filter(p => p.actif).length

  function showFb(msg) { setFb(msg); setTimeout(() => setFb(''), 3000) }

  async function toggleActif(id, actif) {
    if (!canEdit) { showFb('⛔ Action réservée au propriétaire'); return }
    setMenu(prev => prev.map(p => p.id === id ? { ...p, actif } : p))
    try {
      const res = await fetch('/api/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actif }),
      })
      if (!res.ok) throw new Error()
      showFb(actif ? '✅ Plat activé' : '⏸ Plat désactivé')
    } catch {
      setMenu(menuProp)
      showFb('❌ Erreur lors de la modification')
    }
  }

  async function editPlat(id, form) {
    setMenu(prev => prev.map(p => p.id === id ? { ...p, ...form } : p))
    try {
      const res = await fetch('/api/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      })
      if (!res.ok) throw new Error()
      showFb('✅ Plat modifié')
      onRefresh?.()
    } catch {
      setMenu(menuProp)
      showFb('❌ Erreur lors de la modification')
    }
  }

  async function deletePlat(id) {
    if (!confirm('Supprimer ce plat définitivement ?')) return
    setMenu(prev => prev.filter(p => p.id !== id))
    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      showFb('🗑️ Plat supprimé')
      onRefresh?.()
    } catch {
      setMenu(menuProp)
      showFb('❌ Erreur lors de la suppression')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, opacity: 0.4 }}>
          {menu.length} plats · {actifs} actifs · {menu.length - actifs} inactifs
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!canEdit && (
            <div style={{ fontSize: 11, background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.25)', color: '#8b5cf6', borderRadius: 6, padding: '4px 12px' }}>
              👁️ Lecture seule
            </div>
          )}
          {feedback && (
            <div style={{ fontSize: 12, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 8, padding: '5px 14px', color: 'var(--success)' }}>
              {feedback}
            </div>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <FormulaireAjout onSuccess={() => { onRefresh?.(); showFb('✅ Plat ajouté !') }} />
      )}

      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 30 }}>
          <h3 style={{ fontFamily: 'var(--font-playfair)', fontSize: 16, color: 'var(--gold)', borderBottom: '1px solid rgba(201,151,60,0.18)', paddingBottom: 10, marginBottom: 14 }}>
            {cat}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {menu.filter(p => p.cat === cat).map(plat => (
              <PlatCard
                key={plat.id}
                plat={plat}
                isSuperAdmin={canEdit}
                onToggle={toggleActif}
                onEdit={editPlat}
                onDelete={deletePlat}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
