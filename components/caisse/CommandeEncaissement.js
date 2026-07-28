'use client'
import { PAIEMENT_LABELS } from '@/components/caisse/constants'

// ── Carte encaissement ────────────────────────────────────────────────────────
// Fix Bug 2 : désactivé si caisse fermée (caisseOuverte=false)
function CommandeEncaissement({ cmd, onEncaisser, onAnnuler, caisseOuverte, total }) {
  const paiementPreselect = PAIEMENT_LABELS[cmd.paiement] || cmd.paiement

  return (
    <div style={{
      background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.25)',
      borderLeft: '4px solid var(--success)',
      borderRadius: 12, padding: '16px 18px', marginBottom: 10,
      opacity: caisseOuverte ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>{cmd.id}</span>
            <span style={{ background: 'rgba(34,197,94,.12)', color: 'var(--success)', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>✅ PRÊT</span>
            {cmd.mode && <span style={{ background: 'rgba(240,232,216,.06)', padding: '1px 7px', borderRadius: 4, fontSize: 10, opacity: .6 }}>{cmd.mode}</span>}
          </div>
          {(cmd.mode === 'livraison' || cmd.mode === 'emporter') && cmd.client && (
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: 'var(--cream)' }}>{cmd.client}</div>
          )}

          <div style={{ fontSize: 12, opacity: .55, lineHeight: 1.6, marginBottom: 6 }}>
            {Array.isArray(cmd.items)
              ? cmd.items.map(it => `${it.qty || 1}× ${it.name}`).join('  ·  ')
              : String(cmd.items || '')}
          </div>
          {cmd.note && (
            <div style={{ display: 'inline-block', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--warning)' }}>
              💬 {cmd.note}
            </div>
          )}
          <div style={{ fontSize: 11, marginTop: 6 }}>
            <span style={{ opacity: .35 }}>Paiement prévu : </span>
            <span style={{ color: 'var(--warning)' }}>{paiementPreselect}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>
            {total.toLocaleString('fr-FR')}
          </div>
          <div style={{ fontSize: 10, opacity: .4, marginBottom: 10 }}>FCFA</div>

          {caisseOuverte ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={onEncaisser} style={{
                padding: '9px 18px', borderRadius: 8,
                background: 'linear-gradient(135deg,var(--gold),#a85f28)',
                color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                🧾 Encaisser
              </button>
              {onAnnuler && (
                <button onClick={onAnnuler} style={{
                  padding: '6px 12px', borderRadius: 7,
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,.25)',
                  color: 'rgba(239,68,68,.6)', fontSize: 11, cursor: 'pointer',
                }}>
                  🚫 Annuler
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--danger)', maxWidth: 100, textAlign: 'right', lineHeight: 1.4 }}>
              ⚠️ Ouvrez la caisse d'abord
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


export default CommandeEncaissement
