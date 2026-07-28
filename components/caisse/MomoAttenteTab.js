'use client'
import { useState } from 'react'

function MomoAttenteTab({ commandes, onConfirmer }) {
  const [busy, setBusy] = useState(null)

  async function confirmer(cmd) {
    setBusy(cmd.id)
    await onConfirmer(cmd)
    setBusy(null)
  }

  if (commandes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', opacity: .4 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
        <p>Aucun paiement Mobile Money en attente de confirmation</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 22 }}>⏳</span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 14 }}>
            {commandes.length} paiement{commandes.length > 1 ? 's' : ''} Mobile Money en attente
          </div>
          <div style={{ fontSize: 12, opacity: .5, marginTop: 2 }}>
            Le webhook CinetPay n'a pas encore confirmé ces paiements. Vous pouvez les confirmer manuellement après vérification.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {commandes.map(cmd => {
          const total = Array.isArray(cmd.items) ? cmd.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0) : cmd.total || 0
          return (
            <div key={cmd.id} style={{ background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 13, marginBottom: 3 }}>⏳ {cmd.id}</div>
                  {cmd.client && cmd.client !== 'Client sur place' && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{cmd.client}</div>}
                  {cmd.tel && <div style={{ fontSize: 12, opacity: .55 }}>📞 <a href={`tel:${cmd.tel}`} style={{ color: 'var(--info)', textDecoration: 'none' }}>{cmd.tel}</a></div>}
                  <div style={{ fontSize: 11, opacity: .4, marginTop: 4 }}>
                    {new Date(cmd.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--warning)' }}>{total.toLocaleString('fr-FR')}</div>
                  <div style={{ fontSize: 10, opacity: .4 }}>FCFA</div>
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: .6, marginBottom: 12 }}>
                {Array.isArray(cmd.items) ? cmd.items.map(it => `${it.qty||1}× ${it.name}`).join('  ·  ') : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`tel:${cmd.tel}`} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(6,182,212,.1)', border: '1px solid rgba(6,182,212,.3)', color: 'var(--info)', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                  📞 Appeler
                </a>
                <button
                  onClick={() => confirmer(cmd)}
                  disabled={busy === cmd.id}
                  style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: busy === cmd.id ? 'rgba(16,185,129,.2)' : 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: busy === cmd.id ? 'wait' : 'pointer' }}>
                  {busy === cmd.id ? '⏳ Confirmation…' : '✅ Confirmer le paiement MoMo'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


export default MomoAttenteTab
