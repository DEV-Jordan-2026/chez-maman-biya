'use client'
// components/panels/EquipePanel.js — v14
// Gestion équipe + permissions granulaires + onglet RH
// v14 — Ajout MonCompteCard : modification des identifiants du compte super_admin

import { useState, useEffect, useCallback } from 'react'
import { PERMISSIONS_CATALOGUE } from '@/lib/auth'
import MonCompteCard from '@/components/panels/MonCompteCard'

const ROLES = [
  { id: 'manager',        label: 'Gérant',          emoji: '🧑‍💼', color: '#8b5cf6', desc: 'Commandes, réservations, menu, stocks, achats, équipe' },
  { id: 'caissier',       label: 'Caissier',         emoji: '💳',  color: '#10b981', desc: 'Commandes à encaisser + facturation' },
  { id: 'staff',          label: 'Staff cuisine',    emoji: '👨‍🍳', color: '#f59e0b', desc: 'Suivi commandes en cuisine' },
  { id: 'serveur', label: 'Serveur',   emoji: '🍽️',  color: '#06b6d4', desc: 'Accueil, prise de commande, réservations, service en salle' },
  { id: 'magasinier',     label: 'Magasinier',       emoji: '📦',  color: '#84cc16', desc: 'Stocks, demandes d\'achat, réception marchandises' },
]
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]))

const GROUPES_PERMS = [...new Set((PERMISSIONS_CATALOGUE || []).map(p => p.groupe))]

const s = {
  card: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(201,151,60,0.12)',
    borderRadius: 14, padding: '18px 20px', marginBottom: 12,
    transition: 'border-color .2s, box-shadow .2s',
  },
  selectWrapper: {
    position: 'relative', width: '100%',
  },
  selectArrow: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    pointerEvents: 'none', color: 'rgba(201,151,60,0.7)', fontSize: 11,
  },
  input: {
    width: '100%', background: 'rgba(20,14,8,0.85)',
    border: '1px solid rgba(201,151,60,0.2)', borderRadius: 8,
    color: 'var(--cream)', padding: '10px 14px', fontSize: 13,
    fontFamily: 'inherit', boxSizing: 'border-box',
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    colorScheme: 'dark',
  },
  label: { fontSize: 10, color: 'rgba(245,239,230,0.4)', letterSpacing: 1, display: 'block', marginBottom: 6 },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--gold), #a85f28)',
    border: 'none', color: 'white', padding: '10px 20px',
    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  tab: (active) => ({
    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontSize: 12, fontFamily: 'inherit',
    background: active ? 'rgba(201,151,60,0.25)' : 'transparent',
    color: active ? 'var(--gold)' : 'rgba(245,239,230,0.5)',
    fontWeight: active ? 700 : 400,
  }),
  msgOk:  { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--success)', fontSize: 13, marginBottom: 12 },
  msgErr: { background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.3)',  borderRadius: 8, padding: '10px 14px', color: 'var(--danger)',  fontSize: 13, marginBottom: 12 },
}

// ── Fiche employé (tabs : Infos | Permissions | RH | Dossier) ─────────────────
function FicheEmploye({ user, userRole, onClose, onUpdated }) {
  const [ficheTab, setFicheTab] = useState('infos')
  const [form, setForm]         = useState({ name: user.name, role: user.role, password: '' })
  const [perms, setPerms]       = useState([])
  const [userPerms, setUserPerms] = useState([])
  const [pendingPerms, setPendingPerms] = useState(null) // null = pas de changements en attente
  const [primes, setPrimes]     = useState([])
  const [pointages, setPointages] = useState([])
  const [primeForm, setPrimeForm] = useState({ montant: '', motif: '', periode: new Date().toISOString().slice(0,7) })
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState({ type: '', text: '' })

  // ── Dossier administratif ─────────────────────────────────────────────────
  const INIT_DOSSIER = {
    dateNaissance: '', lieuNaissance: '', nationalite: 'Camerounaise', cni: '', cniExpiration: '',
    adresse: '', ville: '', tel: '', telUrgence: '', contactUrgence: '', lienUrgence: '',
    poste: '', typeContrat: '', dateEmbauche: '', dateFinContrat: '',
    salaire: '', modePaieSalaire: '', numeroRIB: '', numeroMoMo: '',
    cniFournie: false, contratSigne: false, photoFournie: false, casierFourni: false,
    note: '',
  }
  const [dossier, setDossier]       = useState(INIT_DOSSIER)
  const [dossierLoaded, setDossierLoaded] = useState(false)
  const [dossierBusy, setDossierBusy]     = useState(false)
  const [dossierMsg, setDossierMsg]       = useState({ type: '', text: '' })

  useEffect(() => {
    setPerms(PERMISSIONS_CATALOGUE || [])
    fetch(`/api/users/${user.id}?include=permissions`)
      .then(r => r.json())
      .then(d => { if (d.permissions) setUserPerms(d.permissions.map(p => p.permissionId || p.code)) })
      .catch(() => {})
    fetch(`/api/rh/primes?userId=${user.id}`)
      .then(r => r.json())
      .then(d => setPrimes(Array.isArray(d) ? d : []))
      .catch(() => {})
    const mois = new Date().toISOString().slice(0,7)
    fetch(`/api/rh/pointages?userId=${user.id}&mois=${mois}`)
      .then(r => r.json())
      .then(d => setPointages(Array.isArray(d) ? d : []))
      .catch(() => {})
    // Charger le dossier administratif
    fetch(`/api/employees?userId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.id) {
          setDossier({ ...INIT_DOSSIER, ...d })
        }
        setDossierLoaded(true)
      })
      .catch(() => setDossierLoaded(true))
  }, [user.id]) // eslint-disable-line

  async function sauvegarderInfos() {
    setBusy(true); setMsg({ type: '', text: '' })
    const payload = { name: form.name, role: form.role }
    if (form.password) payload.password = form.password
    const res  = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setMsg({ type: 'err', text: data.error || 'Erreur' }); return }
    setMsg({ type: 'ok', text: '✅ Modifications enregistrées' })
    onUpdated(data)
  }

  function togglePerm(code) {
    // Met à jour le staging local uniquement — pas d'appel API immédiat
    const base = pendingPerms !== null ? pendingPerms : userPerms
    const has  = base.includes(code)
    const next = has ? base.filter(p => p !== code) : [...base, code]
    setPendingPerms(next)
  }

  async function sauvegarderPerms() {
    if (pendingPerms === null) return
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      // Calculer les deltas
      const toAdd    = pendingPerms.filter(p => !userPerms.includes(p))
      const toRemove = userPerms.filter(p => !pendingPerms.includes(p))
      await Promise.all([
        ...toAdd.map(code => fetch(`/api/users/${user.id}/permissions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionCode: code }),
        })),
        ...toRemove.map(code => fetch(`/api/users/${user.id}/permissions`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionCode: code }),
        })),
      ])
      setUserPerms(pendingPerms)
      setPendingPerms(null)
      setMsg({ type: 'ok', text: '✅ Responsabilités enregistrées' })
    } catch {
      setMsg({ type: 'err', text: 'Erreur lors de la sauvegarde' })
    }
    setBusy(false)
  }

  async function ajouterPrime() {
    if (!primeForm.montant || !primeForm.motif.trim()) {
      setMsg({ type: 'err', text: 'Montant et motif requis' }); return
    }
    setBusy(true)
    const res  = await fetch('/api/rh/primes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...primeForm, userId: user.id, userName: user.name }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setMsg({ type: 'err', text: data.error }); return }
    setPrimes(prev => [data, ...prev])
    setPrimeForm({ montant: '', motif: '', periode: new Date().toISOString().slice(0,7) })
    setMsg({ type: 'ok', text: '✅ Prime attribuée' })
  }

  async function sauvegarderDossier() {
    setDossierBusy(true); setDossierMsg({ type: '', text: '' })
    try {
      const res  = await fetch('/api/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          ...dossier,
          salaire: dossier.salaire ? parseInt(dossier.salaire) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setDossierMsg({ type: 'err', text: data.error || 'Erreur' }); return }
      setDossierMsg({ type: 'ok', text: '✅ Dossier enregistré avec succès' })
    } catch { setDossierMsg({ type: 'err', text: 'Erreur réseau' }) }
    setDossierBusy(false)
  }

  const setD = (k) => (e) => setDossier(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const roleInfo = ROLE_MAP[user.role] || ROLE_MAP.staff
  const canEditPerms = ['super_admin','manager'].includes(userRole)

  const docCount = [dossier.cniFournie, dossier.contratSigne, dossier.photoFournie, dossier.casierFourni].filter(Boolean).length

  return (
    <div style={{ ...s.card, border: '1px solid rgba(201,151,60,0.35)', marginBottom: 20 }}>
      {/* Header fiche */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{roleInfo.emoji}</span>
          <div>
            <div style={{ color: 'var(--cream)', fontWeight: 700, fontSize: 15 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: roleInfo.color }}>@{user.login} · {roleInfo.label}</div>
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'transparent', border: '1px solid rgba(201,151,60,0.2)', color: 'rgba(245,239,230,0.5)', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          ✕ Fermer
        </button>
      </div>

      {/* Onglets fiche */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid rgba(201,151,60,0.1)', paddingBottom: 10, flexWrap: 'wrap' }}>
        {[
          { id: 'infos',       label: '👤 Infos' },
          { id: 'permissions', label: '🔑 Responsabilités' },
          { id: 'rh',          label: '📊 RH & Primes' },
          { id: 'dossier',     label: `📁 Dossier RH${docCount > 0 ? ` (${docCount}/4 docs)` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setFicheTab(t.id)} style={s.tab(ficheTab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {msg.text && <div style={msg.type === 'err' ? s.msgErr : s.msgOk}>{msg.text}</div>}

      {/* Tab : Infos */}
      {ficheTab === 'infos' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={s.label}>NOM COMPLET</label>
              <input style={s.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>RÔLE DE BASE</label>
              <div style={s.selectWrapper}>
                <select style={s.input} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
                </select>
                <span style={s.selectArrow}>▼</span>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>NOUVEAU MOT DE PASSE (laisser vide pour ne pas modifier)</label>
            <input style={s.input} type="password" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••" />
          </div>
          <button onClick={sauvegarderInfos} disabled={busy} style={s.btnPrimary}>
            {busy ? '...' : 'Enregistrer'}
          </button>
        </div>
      )}

      {/* Tab : Permissions */}
      {ficheTab === 'permissions' && (() => {
        const activePerms = pendingPerms !== null ? pendingPerms : userPerms
        const hasPending  = pendingPerms !== null
        return (
          <div>
            <p style={{ color: 'rgba(245,239,230,0.5)', fontSize: 12, marginBottom: 14 }}>
              Les permissions ci-dessous s'ajoutent au rôle de base <strong style={{ color: roleInfo.color }}>{roleInfo.label}</strong>.
            </p>
            {GROUPES_PERMS.map(groupe => {
              const groupePerms = (PERMISSIONS_CATALOGUE || []).filter(p => p.groupe === groupe)
              return (
                <div key={groupe} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.4)', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
                    ─ {groupe.toUpperCase()} {'─'.repeat(20)}
                  </div>
                  {groupePerms.map(perm => (
                    <label key={perm.code} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: canEditPerms ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        checked={activePerms.includes(perm.code)}
                        onChange={() => canEditPerms && togglePerm(perm.code)}
                        disabled={!canEditPerms}
                        style={{ accentColor: 'var(--gold)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 13, color: activePerms.includes(perm.code) ? 'var(--cream)' : 'rgba(245,239,230,0.5)' }}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              )
            })}
            {!canEditPerms && <p style={{ fontSize: 12, color: 'rgba(245,239,230,0.35)' }}>Lecture seule</p>}
            {canEditPerms && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(201,151,60,0.1)' }}>
                <button
                  onClick={sauvegarderPerms}
                  disabled={busy || !hasPending}
                  style={{
                    ...s.btnPrimary,
                    opacity: hasPending ? 1 : 0.4,
                    cursor: hasPending ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {busy ? '⏳ Enregistrement…' : '💾 Sauvegarder les responsabilités'}
                </button>
                {hasPending && !busy && (
                  <span style={{ fontSize: 11, color: 'rgba(201,151,60,0.7)' }}>● Modifications non sauvegardées</span>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Tab : RH */}
      {ficheTab === 'rh' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Pointages ce mois', val: pointages.length, icon: '📍' },
              { label: 'Arrivées', val: pointages.filter(p => p.type === 'arrivee').length, icon: '🟢' },
              { label: 'Primes totales', val: primes.reduce((s, p) => s + p.montant, 0).toLocaleString() + ' FCFA', icon: '🏆' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,151,60,0.1)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{kpi.icon}</div>
                <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 15 }}>{kpi.val}</div>
                <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.4)', marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
          {canEditPerms && (
            <div style={{ ...s.card, background: 'rgba(201,151,60,0.05)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, marginBottom: 10 }}>🏆 Attribuer une prime</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={s.label}>MONTANT (FCFA)</label><input style={s.input} type="number" min="0" value={primeForm.montant} onChange={e => setPrimeForm(p => ({ ...p, montant: e.target.value }))} /></div>
                <div><label style={s.label}>PÉRIODE</label><input style={s.input} type="month" value={primeForm.periode} onChange={e => setPrimeForm(p => ({ ...p, periode: e.target.value }))} /></div>
                <div><label style={s.label}>MOTIF</label><input style={s.input} value={primeForm.motif} onChange={e => setPrimeForm(p => ({ ...p, motif: e.target.value }))} placeholder="ex: Meilleur vendeur" /></div>
              </div>
              <button onClick={ajouterPrime} disabled={busy} style={{ ...s.btnPrimary, padding: '8px 18px', fontSize: 12 }}>{busy ? '...' : '+ Ajouter la prime'}</button>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.4)', letterSpacing: 1, marginBottom: 8 }}>HISTORIQUE DES PRIMES</div>
          {primes.length === 0 ? (
            <p style={{ color: 'rgba(245,239,230,0.3)', fontSize: 13 }}>Aucune prime enregistrée</p>
          ) : primes.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(201,151,60,0.08)', padding: '8px 0' }}>
              <div>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{p.montant.toLocaleString()} FCFA</span>
                <span style={{ color: 'rgba(245,239,230,0.6)', fontSize: 12, marginLeft: 8 }}>{p.motif}</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(245,239,230,0.35)' }}>{p.periode} · par {p.accordePar}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab : Dossier RH complet */}
      {ficheTab === 'dossier' && (
        <div>
          {!dossierLoaded ? (
            <div style={{ textAlign: 'center', padding: '40px 0', opacity: .4 }}>Chargement du dossier…</div>
          ) : (
            <>
              {dossierMsg.text && <div style={dossierMsg.type === 'err' ? s.msgErr : s.msgOk}>{dossierMsg.text}</div>}

              {/* Statut documents */}
              <div style={{ background: 'rgba(201,151,60,.05)', border: '1px solid rgba(201,151,60,.15)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: 12 }}>📎 Documents reçus ({docCount}/4)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { key: 'cniFournie',    label: 'CNI / Passeport' },
                    { key: 'contratSigne',  label: 'Contrat signé' },
                    { key: 'photoFournie',  label: 'Photo d\'identité' },
                    { key: 'casierFourni',  label: 'Casier judiciaire' },
                  ].map(doc => (
                    <label key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: dossier[doc.key] ? 'rgba(34,197,94,.07)' : 'rgba(255,255,255,.02)', border: `1px solid ${dossier[doc.key] ? 'rgba(34,197,94,.25)' : 'rgba(255,255,255,.06)'}` }}>
                      <input type="checkbox" checked={!!dossier[doc.key]} onChange={setD(doc.key)} style={{ accentColor: 'var(--success)', width: 15, height: 15 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: dossier[doc.key] ? 'var(--success)' : 'rgba(245,239,230,.5)' }}>{doc.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section Identité */}
              <Section label="👤 Identité">
                <Row2>
                  <Field label="DATE DE NAISSANCE" type="date" val={dossier.dateNaissance} set={setD('dateNaissance')} s={s} />
                  <Field label="LIEU DE NAISSANCE" val={dossier.lieuNaissance} set={setD('lieuNaissance')} s={s} placeholder="Ex: Douala" />
                </Row2>
                <Row2>
                  <Field label="NATIONALITÉ" val={dossier.nationalite} set={setD('nationalite')} s={s} placeholder="Camerounaise" />
                  <Field label="N° CNI / PASSEPORT" val={dossier.cni} set={setD('cni')} s={s} placeholder="Ex: 123456789" />
                </Row2>
                <Row2>
                  <Field label="EXPIRATION CNI" type="date" val={dossier.cniExpiration} set={setD('cniExpiration')} s={s} />
                  <div />
                </Row2>
              </Section>

              {/* Section Coordonnées */}
              <Section label="📍 Coordonnées">
                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>ADRESSE COMPLÈTE</label>
                  <input style={s.input} value={dossier.adresse} onChange={setD('adresse')} placeholder="Quartier, rue, numéro…" />
                </div>
                <Row2>
                  <Field label="VILLE" val={dossier.ville} set={setD('ville')} s={s} placeholder="Ex: Yaoundé" />
                  <Field label="TÉLÉPHONE PERSONNEL" type="tel" val={dossier.tel} set={setD('tel')} s={s} placeholder="+237 6XX XXX XXX" />
                </Row2>
              </Section>

              {/* Section Contact urgence */}
              <Section label="🚨 Contact d'urgence">
                <Row2>
                  <Field label="NOM DU CONTACT" val={dossier.contactUrgence} set={setD('contactUrgence')} s={s} placeholder="Ex: Marie Kamga" />
                  <Field label="LIEN DE PARENTÉ" val={dossier.lienUrgence} set={setD('lienUrgence')} s={s} placeholder="Ex: Épouse, Parent…" />
                </Row2>
                <Row2>
                  <Field label="TÉLÉPHONE D'URGENCE" type="tel" val={dossier.telUrgence} set={setD('telUrgence')} s={s} placeholder="+237 6XX XXX XXX" />
                  <div />
                </Row2>
              </Section>

              {/* Section Contrat */}
              <Section label="📋 Poste & Contrat">
                <Row2>
                  <Field label="POSTE OCCUPÉ" val={dossier.poste} set={setD('poste')} s={s} placeholder="Ex: Caissier principal" />
                  <div>
                    <label style={s.label}>TYPE DE CONTRAT</label>
                    <div style={s.selectWrapper}>
                      <select style={s.input} value={dossier.typeContrat} onChange={setD('typeContrat')}>
                        <option value="">— Choisir —</option>
                        {['CDI','CDD','Stage','Vacataire','Prestataire'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span style={s.selectArrow}>▼</span>
                    </div>
                  </div>
                </Row2>
                <Row2>
                  <Field label="DATE D'EMBAUCHE" type="date" val={dossier.dateEmbauche} set={setD('dateEmbauche')} s={s} />
                  <Field label="FIN DE CONTRAT (si CDD/Stage)" type="date" val={dossier.dateFinContrat} set={setD('dateFinContrat')} s={s} />
                </Row2>
              </Section>

              {/* Section Rémunération */}
              <Section label="💰 Rémunération">
                <Row2>
                  <Field label="SALAIRE BRUT (FCFA/mois)" type="number" val={dossier.salaire} set={setD('salaire')} s={s} placeholder="Ex: 120000" />
                  <div>
                    <label style={s.label}>MODE DE PAIEMENT SALAIRE</label>
                    <div style={s.selectWrapper}>
                      <select style={s.input} value={dossier.modePaieSalaire} onChange={setD('modePaieSalaire')}>
                        <option value="">— Choisir —</option>
                        {['Virement bancaire','Espèces','MTN MoMo','Orange Money'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <span style={s.selectArrow}>▼</span>
                    </div>
                  </div>
                </Row2>
                <Row2>
                  <Field label="NUMÉRO RIB / COMPTE" val={dossier.numeroRIB} set={setD('numeroRIB')} s={s} placeholder="Pour virement bancaire" />
                  <Field label="NUMÉRO MOBILE MONEY" type="tel" val={dossier.numeroMoMo} set={setD('numeroMoMo')} s={s} placeholder="+237 6XX XXX XXX" />
                </Row2>
              </Section>

              {/* Notes internes */}
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>NOTES INTERNES (visible managers uniquement)</label>
                <textarea
                  style={{ ...s.input, height: 80, resize: 'vertical', lineHeight: 1.5 }}
                  value={dossier.note}
                  onChange={setD('note')}
                  placeholder="Remarques, observations RH, historique…"
                />
              </div>

              <button onClick={sauvegarderDossier} disabled={dossierBusy} style={{ ...s.btnPrimary, width: '100%' }}>
                {dossierBusy ? '⏳ Enregistrement…' : '💾 Sauvegarder le dossier'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers layout pour le formulaire dossier ──────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid rgba(201,151,60,.12)' }}>{label}</div>
      {children}
    </div>
  )
}

function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>{children}</div>
}

function Field({ label, val, set, s, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input style={s.input} type={type} value={val || ''} onChange={set} placeholder={placeholder} />
    </div>
  )
}

// ── Formulaire ajout ──────────────────────────────────────────────────────────
function FormulaireAjout({ onSuccess, restaurants }) {
  const [form, setForm]   = useState({ login: '', password: '', role: 'staff', name: '', restaurantId: '' })
  const [err,  setErr]    = useState('')
  const [ok,   setOk]     = useState('')
  const [busy, setBusy]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function soumettre() {
    setErr(''); setOk('')
    if (!form.login || !form.password || !form.name) {
      setErr('Tous les champs obligatoires sont requis.'); return
    }
    setBusy(true)
    try {
      const res  = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Erreur'); return }
      setOk(`✅ ${data.name} (${data.login}) créé avec succès !`)
      setForm({ login: '', password: '', role: 'staff', name: '', restaurantId: form.restaurantId })
      onSuccess(data)
    } catch { setErr('Erreur réseau. Veuillez réessayer.') }
    finally { setBusy(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const roleInfo = ROLE_MAP[form.role]

  return (
    <div style={{ ...s.card, border: '1px solid rgba(201,151,60,0.3)', marginBottom: 20 }}>
      <h3 style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>👤 Nouvel employé</h3>
      {err && <div style={s.msgErr}>{err}</div>}
      {ok  && <div style={s.msgOk}>{ok}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={s.label}>NOM COMPLET *</label>
          <input style={s.input} value={form.name} onChange={f('name')} placeholder="Ex: Jordan Kamga" />
        </div>
        <div>
          <label style={s.label}>IDENTIFIANT *</label>
          <input style={s.input} value={form.login} onChange={f('login')} placeholder="Ex: jordan.k" autoCapitalize="off" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={s.label}>MOT DE PASSE *</label>
          <div style={{ position: 'relative' }}>
            <input style={{ ...s.input, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={form.password} onChange={f('password')} />
            <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(245,239,230,0.4)', cursor: 'pointer', fontSize: 14 }}>
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <div>
          <label style={s.label}>RÔLE *</label>
          <div style={s.selectWrapper}>
            <select style={s.input} value={form.role} onChange={f('role')}>
              {ROLES.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
            </select>
            <span style={s.selectArrow}>▼</span>
          </div>
        </div>
      </div>
      {restaurants && restaurants.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>RESTAURANT ASSIGNÉ</label>
          <div style={s.selectWrapper}>
            <select style={s.input} value={form.restaurantId} onChange={f('restaurantId')}>
              <option value="">— Choisir un restaurant —</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.nom} ({r.ville})</option>)}
            </select>
            <span style={s.selectArrow}>▼</span>
          </div>
        </div>
      )}
      {roleInfo && (
        <div style={{ background: `${roleInfo.color}11`, border: `1px solid ${roleInfo.color}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
          <span style={{ color: roleInfo.color, fontSize: 12 }}>{roleInfo.emoji} {roleInfo.desc}</span>
        </div>
      )}
      <button onClick={soumettre} disabled={busy} style={s.btnPrimary}>
        {busy ? 'Création...' : 'Créer l\'employé'}
      </button>
    </div>
  )
}

// ── EquipePanel principal ─────────────────────────────────────────────────────
export default function EquipePanel({ user }) {
  const userRole = user?.role || 'manager'
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [ficheOuverte, setFicheOuverte] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [filtreRole, setFiltreRole]   = useState('tous')
  const [recherche, setRecherche]     = useState('')
  const [err, setErr]                 = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch { setErr('Impossible de charger l\'équipe') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    if (userRole === 'super_admin') {
      fetch('/api/restaurants').then(r => r.json()).then(d => setRestaurants(Array.isArray(d) ? d : [])).catch(() => {})
    }
  }, [load, userRole])

  async function toggleActif(u) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !u.actif }),
    })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, actif: !u.actif } : x))
  }

  const usersFiltres = users
    .filter(u => filtreRole === 'tous' || u.role === filtreRole)
    .filter(u => !recherche || u.name.toLowerCase().includes(recherche.toLowerCase()) || u.login.toLowerCase().includes(recherche.toLowerCase()))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(201,151,60,0.2)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* Carte Mon compte — super_admin uniquement */}
      {userRole === 'super_admin' && <MonCompteCard />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>👥 Équipe</h2>
          <p style={{ color: 'rgba(245,239,230,0.5)', fontSize: 13, margin: 0 }}>
            {users.filter(u => u.actif).length} actif{users.filter(u => u.actif).length > 1 ? 's' : ''} sur {users.length} membres
          </p>
        </div>
        <button onClick={() => setShowForm(p => !p)} style={s.btnPrimary}>
          {showForm ? '✕ Annuler' : '+ Ajouter un employé'}
        </button>
      </div>

      {err && <div style={s.msgErr}>{err}</div>}

      {showForm && <FormulaireAjout onSuccess={(u) => { setUsers(p => [u, ...p]); setShowForm(false) }} restaurants={restaurants} />}
      {ficheOuverte && (
        <FicheEmploye
          user={ficheOuverte}
          userRole={userRole}
          onClose={() => setFicheOuverte(null)}
          onUpdated={(u) => { setUsers(p => p.map(x => x.id === u.id ? { ...x, ...u } : x)); setFicheOuverte(u) }}
        />
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder="🔍 Rechercher..."
          style={{ ...s.input, width: 200, padding: '8px 12px', fontSize: 12 }}
        />
        {['tous', ...ROLES.map(r => r.id)].map(roleId => (
          <button key={roleId} onClick={() => setFiltreRole(roleId)} style={{
            padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            background: filtreRole === roleId ? 'rgba(201,151,60,0.25)' : 'rgba(255,255,255,0.05)',
            color: filtreRole === roleId ? 'var(--gold)' : 'rgba(245,239,230,0.5)',
          }}>
            {roleId === 'tous' ? 'Tous' : (ROLE_MAP[roleId]?.emoji + ' ' + ROLE_MAP[roleId]?.label)}
          </button>
        ))}
      </div>

      {/* Liste */}
      {usersFiltres.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'rgba(245,239,230,0.4)', fontSize: 14 }}>Aucun employé trouvé</p>
        </div>
      ) : usersFiltres.map(u => {
        const rInfo = ROLE_MAP[u.role] || { emoji: '👤', color: '#6b7280', label: u.role }
        return (
          <div key={u.id} style={{ ...s.card, opacity: u.actif ? 1 : 0.5,
            borderLeft: `3px solid ${rInfo.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${rInfo.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {rInfo.emoji}
                </div>
                <div>
                  <div style={{ color: 'var(--cream)', fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: rInfo.color }}>{rInfo.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(245,239,230,0.35)', marginTop: 2 }}>@{u.login}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setFicheOuverte(ficheOuverte?.id === u.id ? null : u)}
                  style={{ background: 'rgba(201,151,60,0.1)', border: '1px solid rgba(201,151,60,0.25)',
                    color: 'var(--gold)', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  {ficheOuverte?.id === u.id ? 'Fermer' : '📋 Fiche'}
                </button>
                <button onClick={() => toggleActif(u)}
                  style={{ background: u.actif ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${u.actif ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    color: u.actif ? 'var(--danger)' : 'var(--success)',
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  {u.actif ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
