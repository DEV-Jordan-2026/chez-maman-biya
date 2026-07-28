'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const ROLES_DEST = [
  { id: 'tous',     label: '📢 Toute l\'équipe' },
  { id: 'staff',    label: '👨‍🍳 Staff cuisine' },
  { id: 'caissier', label: '💳 Caissier' },
  { id: 'manager',  label: '🧑‍💼 Gérant' },
]

const ROLE_COLORS = {
  super_admin: 'var(--gold)',
  manager:     '#8b5cf6',
  caissier:    'var(--success)',
  staff:       'var(--warning)',
}

export default function MessageriePanel({ user }) {
  const [messages,  setMessages]  = useState([])
  const [contenu,   setContenu]   = useState('')
  const [dest,      setDest]      = useState('tous')
  const [priorite,  setPriorite]  = useState('normal')
  const [sending,   setSending]   = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [erreur,    setErreur]    = useState('')
  const listRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
      setErreur('')
    } catch (e) {
      setErreur('Impossible de charger les messages. Vérifiez votre connexion.')
      console.error('[MessageriePanel]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    const iv = setInterval(fetchMessages, 15_000)
    return () => clearInterval(iv)
  }, [fetchMessages])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  async function envoyer() {
    if (!contenu.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu, destinataire: dest, priorite }),
      })
      if (!res.ok) throw new Error(await res.text())
      setContenu(''); fetchMessages()
    } catch (e) {
      console.error('[MessageriePanel envoyer]', e)
    } finally {
      setSending(false)
    }
  }

  async function marquerLu(id) {
    try {
      await fetch(`/api/messages/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lu: true }),
      })
      setMessages(prev => prev.map(m => m.id === id ? { ...m, lu: true } : m))
    } catch (e) {
      console.error('[MessageriePanel marquerLu]', e)
    }
  }

  async function supprimer(id) {
    try {
      await fetch(`/api/messages/${id}`, { method: 'DELETE' })
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      console.error('[MessageriePanel supprimer]', e)
    }
  }

  const nonLus = messages.filter(m => !m.lu && m.auteur !== (user.name || user.login)).length

  if (loading) return <div style={{ textAlign:'center',padding:'60px 0',opacity:.3 }}>Chargement…</div>
  if (erreur)  return <div style={{ padding: 40, color: '#f87171', textAlign: 'center' }}>{erreur}</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, height: 600 }}>

      {/* Liste messages */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.12)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,151,60,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>
            💬 Messages équipe
            {nonLus > 0 && <span style={{ marginLeft: 8, background: 'var(--danger)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '2px 8px' }}>{nonLus} non lus</span>}
          </div>
          <button onClick={fetchMessages} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, cursor: 'pointer' }}>↻</button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', opacity: .3 }}>Chargement…</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', opacity: .25 }}>Aucun message. Envoyez une note à l'équipe !</div>
          ) : messages.map(m => {
            const isMine = m.auteur === (user.name || user.login)
            const couleur = ROLE_COLORS[m.auteurRole] || 'var(--gold)'
            return (
              <div key={m.id} style={{
                alignSelf: isMine ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                background: isMine ? 'rgba(201,151,60,.12)' : 'rgba(255,255,255,.04)', animation: 'fadeIn .2s ease',
                border: `1px solid ${isMine ? 'rgba(201,151,60,.3)' : 'rgba(255,255,255,.08)'}`,
                borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '10px 14px',
                opacity: m.lu || isMine ? 1 : 0.95,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: couleur }}>{m.auteur}</span>
                  {m.destinataire !== 'tous' && (
                    <span style={{ fontSize: 10, background: 'rgba(139,92,246,.15)', color: '#8b5cf6', borderRadius: 4, padding: '1px 6px' }}>→ {m.destinataire}</span>
                  )}
                  {m.priorite === 'urgent' && (
                    <span style={{ fontSize: 10, background: 'rgba(239,68,68,.15)', color: 'var(--danger)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>🚨 URGENT</span>
                  )}
                  <span style={{ fontSize: 10, opacity: .35, marginLeft: 'auto' }}>
                    {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {/* Contenu */}
                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.contenu}</div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {!isMine && !m.lu && (
                    <button onClick={() => marquerLu(m.id)} style={{ fontSize: 10, color: 'var(--success)', background: 'none', border: 'none', cursor: 'pointer' }}>✓ Lu</button>
                  )}
                  {(isMine || user.role === 'super_admin') && (
                    <button onClick={() => supprimer(m.id)} style={{ fontSize: 10, color: 'rgba(239,68,68,.5)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>× Supprimer</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Composer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.12)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>✍️ Nouveau message</div>

          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>DESTINATAIRE</label>
            <select value={dest} onChange={e => setDest(e.target.value)} style={sel}>
              {ROLES_DEST.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>PRIORITÉ</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['normal','🟢 Normal'],['urgent','🚨 Urgent']].map(([v,l]) => (
                <button key={v} onClick={() => setPriorite(v)} style={{
                  flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${priorite === v ? (v === 'urgent' ? 'var(--danger)' : 'var(--success)') : 'rgba(201,151,60,.2)'}`,
                  background: priorite === v ? (v === 'urgent' ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)') : 'transparent',
                  color: priorite === v ? (v === 'urgent' ? 'var(--danger)' : 'var(--success)') : 'var(--cream-faint)',
                }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>MESSAGE</label>
            <textarea
              value={contenu}
              onChange={e => setContenu(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) envoyer() }}
              placeholder="Écrivez votre message… (Ctrl+Entrée pour envoyer)"
              rows={5}
              style={{ ...inp, resize: 'vertical' }}
            />
          </div>

          <button onClick={envoyer} disabled={sending || !contenu.trim()} style={{
            width: '100%', background: 'linear-gradient(135deg,var(--gold),#a85f28)', border: 'none',
            color: '#fff', padding: 11, borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: sending || !contenu.trim() ? 'not-allowed' : 'pointer',
            opacity: !contenu.trim() ? .5 : 1,
          }}>
            {sending ? '⏳ Envoi…' : '📤 Envoyer'}
          </button>
        </div>

        {/* Légende statut messages */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(201,151,60,.08)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, opacity: .4, marginBottom: 8 }}>MEMBRES EN LIGNE</div>
          {['Propriétaire','Gérant','Caissier','Staff'].map((r,i) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: ['var(--gold)','#8b5cf6','var(--success)','var(--warning)'][i], display: 'inline-block' }} />
              <span style={{ fontSize: 12, opacity: .6 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 10, color: 'var(--cream-faint)', letterSpacing: 1, display: 'block', marginBottom: 4 }
const inp = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,151,60,.2)', borderRadius: 8, color: 'var(--cream)', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', transition: 'border-color .18s, box-shadow .18s' }
const sel = { ...inp, background: 'rgba(20,16,8,.95)' }
