'use client'
// components/panels/MonCompteCard.js — v1
// Carte "Mon compte" affichée en tête d'EquipePanel pour le super_admin uniquement.
// Permet de modifier son propre login, mot de passe ou nom affiché.
// Appelle GET /api/auth/compte (lecture) et PATCH /api/auth/compte (écriture).
// Sécurité : confirmation du mot de passe actuel obligatoire avant tout changement.
// Comportement après changement de mot de passe : déconnexion forcée → /admin/login.

import { useState, useEffect } from 'react'

// ── Styles partagés avec EquipePanel ─────────────────────────────────────────
const s = {
  input: {
    width: '100%', background: 'rgba(20,14,8,0.85)',
    border: '1px solid rgba(201,151,60,0.2)', borderRadius: 8,
    color: 'var(--cream)', padding: '10px 14px', fontSize: 13,
    fontFamily: 'inherit', boxSizing: 'border-box',
    appearance: 'none', WebkitAppearance: 'none',
    colorScheme: 'dark',
  },
  inputError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  label: {
    fontSize: 10, color: 'rgba(245,239,230,0.4)',
    letterSpacing: 1, display: 'block', marginBottom: 6,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--gold), #a85f28)',
    border: 'none', color: 'white', padding: '10px 20px',
    borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnGhost: (danger = false) => ({
    background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(201,151,60,0.1)',
    border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'rgba(201,151,60,0.25)'}`,
    color: danger ? 'var(--danger)' : 'var(--gold)',
    padding: '6px 14px', borderRadius: 6, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  }),
  msgOk: {
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--success)',
    fontSize: 13, marginBottom: 14,
  },
  msgErr: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--danger)',
    fontSize: 13, marginBottom: 14,
  },
}

// ── Champ mot de passe avec toggle visibilité ─────────────────────────────────
function PassInput({ label, value, onChange, placeholder, visible, onToggle, hasError }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.input, paddingRight: 44, ...(hasError ? s.inputError : {}) }}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          onClick={onToggle}
          style={{
            position: 'absolute', right: 12, top: '50%',
            transform: 'translateY(-50%)', background: 'none',
            border: 'none', color: 'rgba(245,239,230,0.4)',
            cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function MonCompteCard() {
  const [compte, setCompte]   = useState(null)
  const [open, setOpen]       = useState(false)
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState({ type: '', text: '' })

  const [form, setForm] = useState({
    motDePasseActuel:   '',
    nouveauNom:         '',
    nouveauLogin:       '',
    nouveauMotDePasse:  '',
    confirmMotDePasse:  '',
  })
  const [vis, setVis] = useState({ actuel: false, nouveau: false, confirm: false })

  // ── Charger les infos du compte connecté ─────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/compte')
      .then(r => r.json())
      .then(d => { if (!d.error) setCompte(d) })
      .catch(() => {})
  }, [])

  const f       = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const toggleV = (k) => ()   => setVis(p => ({ ...p, [k]: !p[k] }))

  function reset() {
    setForm({ motDePasseActuel: '', nouveauNom: '', nouveauLogin: '', nouveauMotDePasse: '', confirmMotDePasse: '' })
    setVis({ actuel: false, nouveau: false, confirm: false })
    setMsg({ type: '', text: '' })
  }

  function toggle() {
    setOpen(p => !p)
    reset()
  }

  // ── Validation locale avant envoi ─────────────────────────────────────────
  function valider() {
    if (!form.motDePasseActuel)
      return 'Le mot de passe actuel est requis pour confirmer les modifications.'
    if (!form.nouveauNom.trim() && !form.nouveauLogin.trim() && !form.nouveauMotDePasse)
      return 'Renseignez au moins un champ à modifier.'
    if (form.nouveauLogin.trim() && form.nouveauLogin.trim().length < 3)
      return 'Le nouvel identifiant doit faire au moins 3 caractères.'
    if (form.nouveauLogin.trim() && !/^[a-zA-Z0-9._-]+$/.test(form.nouveauLogin.trim()))
      return 'Identifiant invalide (lettres, chiffres, . _ - uniquement).'
    if (form.nouveauMotDePasse && form.nouveauMotDePasse.length < 8)
      return 'Le nouveau mot de passe doit faire au moins 8 caractères.'
    if (form.nouveauMotDePasse && form.nouveauMotDePasse !== form.confirmMotDePasse)
      return 'La confirmation du mot de passe ne correspond pas.'
    return null
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  async function sauvegarder() {
    const err = valider()
    if (err) { setMsg({ type: 'err', text: err }); return }

    setBusy(true)
    setMsg({ type: '', text: '' })

    const payload = { motDePasseActuel: form.motDePasseActuel }
    if (form.nouveauNom.trim())    payload.nouveauNom        = form.nouveauNom.trim()
    if (form.nouveauLogin.trim())  payload.nouveauLogin       = form.nouveauLogin.trim()
    if (form.nouveauMotDePasse)    payload.nouveauMotDePasse  = form.nouveauMotDePasse

    try {
      const res  = await fetch('/api/auth/compte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setBusy(false)

      if (!res.ok) {
        setMsg({ type: 'err', text: data.error || 'Erreur serveur' })
        return
      }

      // Mot de passe changé → déconnexion automatique
      if (data.logout) {
        setMsg({ type: 'ok', text: '✅ Mot de passe modifié. Déconnexion en cours…' })
        setTimeout(() => { window.location.href = '/admin/login' }, 1800)
        return
      }

      // Login ou nom seul changé → mise à jour locale
      setMsg({ type: 'ok', text: '✅ Compte mis à jour avec succès' })
      setCompte(p => ({
        ...p,
        login: data.login ?? p.login,
        name:  data.name  ?? p.name,
      }))
      reset()

    } catch {
      setBusy(false)
      setMsg({ type: 'err', text: 'Erreur réseau. Veuillez réessayer.' })
    }
  }

  if (!compte) return null

  const mdpPending = !!form.nouveauMotDePasse
  const mismatch   = mdpPending && form.confirmMotDePasse && form.nouveauMotDePasse !== form.confirmMotDePasse

  return (
    <div style={{
      background: 'rgba(201,151,60,0.04)',
      border: '1px solid rgba(201,151,60,0.3)',
      borderRadius: 14, padding: '18px 20px', marginBottom: 24,
    }}>

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(201,151,60,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            flexShrink: 0,
          }}>
            👑
          </div>
          <div>
            <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 15 }}>{compte.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.4)' }}>
              @{compte.login}&nbsp;·&nbsp;Propriétaire&nbsp;·&nbsp;
              <span style={{ color: 'rgba(201,151,60,0.6)' }}>Mon compte</span>
            </div>
          </div>
        </div>
        <button onClick={toggle} style={s.btnGhost(open)}>
          {open ? '✕ Fermer' : '✏️ Modifier mes identifiants'}
        </button>
      </div>

      {/* ── Formulaire ──────────────────────────────────────────────────── */}
      {open && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(201,151,60,0.15)' }}>

          {msg.text && (
            <div style={msg.type === 'err' ? s.msgErr : s.msgOk}>
              {msg.text}
            </div>
          )}

          {/* Mot de passe actuel — toujours en premier */}
          <div style={{ marginBottom: 16 }}>
            <PassInput
              label="MOT DE PASSE ACTUEL — REQUIS POUR CONFIRMER"
              value={form.motDePasseActuel}
              onChange={f('motDePasseActuel')}
              placeholder="••••••••"
              visible={vis.actuel}
              onToggle={toggleV('actuel')}
            />
          </div>

          {/* Nom + Login */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={s.label}>NOUVEAU NOM (laisser vide pour conserver)</label>
              <input
                style={s.input}
                value={form.nouveauNom}
                onChange={f('nouveauNom')}
                placeholder={compte.name}
              />
            </div>
            <div>
              <label style={s.label}>NOUVEL IDENTIFIANT (laisser vide pour conserver)</label>
              <input
                style={s.input}
                value={form.nouveauLogin}
                onChange={f('nouveauLogin')}
                placeholder={compte.login}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          </div>

          {/* Nouveau mot de passe + Confirmation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <PassInput
              label="NOUVEAU MOT DE PASSE (laisser vide pour conserver)"
              value={form.nouveauMotDePasse}
              onChange={f('nouveauMotDePasse')}
              placeholder="Min. 8 caractères"
              visible={vis.nouveau}
              onToggle={toggleV('nouveau')}
            />
            <PassInput
              label="CONFIRMER LE NOUVEAU MOT DE PASSE"
              value={form.confirmMotDePasse}
              onChange={f('confirmMotDePasse')}
              placeholder="••••••••"
              visible={vis.confirm}
              onToggle={toggleV('confirm')}
              hasError={mismatch}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              onClick={sauvegarder}
              disabled={busy}
              style={{ ...s.btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {busy ? '⏳ Enregistrement…' : '💾 Enregistrer les modifications'}
            </button>
            {mdpPending && !busy && (
              <span style={{ fontSize: 11, color: 'rgba(201,151,60,0.7)' }}>
                ⚠️ Un changement de mot de passe entraîne une déconnexion automatique
              </span>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
