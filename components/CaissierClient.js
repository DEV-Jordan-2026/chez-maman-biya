'use client'
// components/CaissierClient.js
// Composant orchestrateur — logique d'état et routing des onglets caisse.
// Les sous-composants sont dans components/caisse/

import { useState, useEffect, useCallback } from 'react'
import Link                 from 'next/link'
import { useRouter }        from 'next/navigation'
import NotifAlert           from '@/components/NotifAlert'
import RHPanel              from '@/components/panels/RHPanel'
import MessageriePanel      from '@/components/panels/MessageriePanel'
import useSSE               from '@/hooks/useSSE'
import CommandeEncaissement from '@/components/caisse/CommandeEncaissement'
import FacturationTab       from '@/components/caisse/FacturationTab'
import EncaissementModal    from '@/components/caisse/EncaissementModal'
import CaisseDirecteTab     from '@/components/caisse/CaisseDirecteTab'
import MomoAttenteTab       from '@/components/caisse/MomoAttenteTab'
import ClotureTab           from '@/components/caisse/ClotureTab'
import {
  STATUS,
  PAIEMENT_LABELS,
  parsePaiement,
  buildReceiptHTML,
  totalCommande,
} from '@/components/caisse/constants'
// miniInput et MODES_PAIEMENT sont importés directement par les sous-composants qui les utilisent

export default function CaissierClient({ user }) {
  const router = useRouter()
  const [tab,           setTab]           = useState('encaissement')
  const [commandes,     setCommandes]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [syncing,       setSyncing]       = useState(false)
  const [selectedId,    setSelectedId]    = useState(null)
  const [encModal,      setEncModal]      = useState(null)   // Fix Bug 1 — state déclaré
  const [encLoading,    setEncLoading]    = useState(false)
  const [encError,      setEncError]      = useState('')
  const [annulModal,    setAnnulModal]    = useState(null)   // commande à annuler
  const [annulBusy,     setAnnulBusy]     = useState(false)
  const [annulMotif,    setAnnulMotif]    = useState('Client absent')
  const [parametres,    setParametres]    = useState(null)   // infos restaurant pour reçu
  const [branding,      setBranding]      = useState(null)   // logo base64 depuis /api/parametres/branding
  const [sessionCaisse, setSessionCaisse] = useState(undefined)

  // Fix Bug 4 — hauteur dynamique des banners
  const bannerHeight = sessionCaisse === null ? 44 : sessionCaisse ? 30 : 0

  useEffect(() => {
    fetch('/api/caisse')
      .then(r => r.json())
      .then(data => setSessionCaisse(data || null))
      .catch(() => setSessionCaisse(null))
    // Charger les paramètres restaurant pour le reçu dynamique
    fetch('/api/parametres')
      .then(r => r.json())
      .then(d => setParametres(d || null))
      .catch(() => {})
    // Bug 2 — Charger le branding (logo base64) depuis /api/parametres/branding
    fetch('/api/parametres/branding')
      .then(r => r.json())
      .then(d => setBranding(d?.parametres || null))
      .catch(() => {})
    // Refresh session caisse toutes les 60s
    const iv = setInterval(() => {
      fetch('/api/caisse').then(r => r.json()).then(d => setSessionCaisse(d || null)).catch(() => {})
    }, 60_000)
    return () => clearInterval(iv)
  }, [])

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchCommandes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const res  = await fetch('/api/commandes', { cache: 'no-store' })
      const data = await res.json()
      const list = Array.isArray(data) ? data : (Array.isArray(data?.commandes) ? data.commandes : [])
      setCommandes(list)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setSyncing(false) }
  }, [])

  useEffect(() => {
    fetchCommandes()
    // Polling de secours uniquement (SSE gère le temps réel)
    const iv = setInterval(() => fetchCommandes(true), 120_000)
    return () => clearInterval(iv)
  }, [fetchCommandes])

  // ── SSE : temps réel ─────────────────────────────────────────────────────
  const { connected: sseConnected } = useSSE({
    onCommandeNouvelle: (commande) => {
      setCommandes(prev => prev.find(c => c.id === commande.id) ? prev : [commande, ...prev])
    },
    onCommandeStatus: ({ id, status, paiement, updatedAt }) => {
      setCommandes(prev => prev.map(c =>
        c.id === id ? { ...c, status, ...(paiement && { paiement: parsePaiement(paiement) }), updatedAt } : c
      ))
    },
  })

  // ── Encaissement réel ────────────────────────────────────────────────────
  async function confirmerEncaissement(cmd, modePaiement, renduMonnaie = 0) {
    setEncLoading(true)
    setEncError('')
    try {
      const res = await fetch(`/api/commandes/${cmd.id}/encaisser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // modePaiement est soit une string (mode simple) soit un array [{mode,label,montant}] (mixte)
        body: JSON.stringify({ paiement: modePaiement }),
      })
      if (!res.ok) {
        const err = await res.json()
        setEncError(err.error || 'Erreur lors de l\'encaissement')
        setEncLoading(false)
        return
      }
      // Bug 1 — Parser la réponse pour récupérer numeroFacture et qrUrl
      const resData = await res.json()
      const { numeroFacture, qrUrl } = resData

      // Imprimer automatiquement le reçu avec le rendu monnaie si espèces
      if (renduMonnaie > 0) {
        const dateStr = new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
        const t = typeof cmd.total === 'number' ? cmd.total : (cmd.items?.reduce((s,i) => s+(i.price||0)*(i.qty||1), 0) || 0)
        const win = window.open('', '_blank', 'width=400,height=700')
        if (win) {
          win.document.write(buildReceiptHTML({
            id: cmd.id, client: cmd.client, tel: cmd.tel,
            mode: cmd.mode || 'Sur place',
            paiement: Array.isArray(modePaiement) ? modePaiement : (PAIEMENT_LABELS[modePaiement] || modePaiement),
            dateStr, items: Array.isArray(cmd.items) ? cmd.items : [],
            sousTotal: t, reduction: 0, total: t,
            caissier: sessionCaisse?.ouvertPar,
            sessionId: sessionCaisse?.id,
            note: cmd.note,
            renduMonnaie,
            // Bug 1 — numéro de facture depuis la réponse API
            numeroFacture: numeroFacture || null,
            // Bug 2 — logo depuis /api/parametres/branding
            logo: branding?.logo || null,
            // Bug 3 — URL QR signée depuis la réponse API
            qrUrl: qrUrl || null,
            restaurantNom: parametres?.nom || 'CHEZ MAMAN BIYA',
            restaurantAdresse: parametres?.adresse || 'Yaoundé, Cameroun',
            restaurantTel: parametres?.telephone || '+237 677 000 000',
          }))
          win.document.close()
          setTimeout(() => { win.focus(); win.print() }, 300)
        }
      }
      setEncModal(null)
      setSelectedId(cmd.id)
      setTab('factures')
      await fetchCommandes(true)
    } catch (e) {
      setEncError('Erreur réseau — réessayez')
    }
    setEncLoading(false)
  }

  async function annulerCommande(cmd, motif) {
    setAnnulBusy(true)
    try {
      const res = await fetch(`/api/commandes/${cmd.id}/annuler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Impossible d\'annuler cette commande')
        setAnnulBusy(false)
        return
      }
      setAnnulModal(null)
      await fetchCommandes(true)
    } catch {
      alert('Erreur réseau — réessayez')
    }
    setAnnulBusy(false)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login'); router.refresh()
  }

  // ── Données ──────────────────────────────────────────────────────────────
  const aEncaisser    = commandes.filter(c => c.status === 'pret')
  // C5 — Inclure les paiements mixtes avec MoMo en attente (stockés en JSON stringifié)
  const momoEnAttente = commandes.filter(c => {
    if (c.paiement === 'cinetpay_pending') return true
    try {
      const p = JSON.parse(c.paiement)
      return Array.isArray(p) && p.some(l => l.mode === 'cinetpay_pending')
    } catch { return false }
  })
  const todayStr   = new Date().toLocaleDateString('fr-CA')

  // Fix Bug 6 — CA basé sur updatedAt (date réelle d'encaissement) pas createdAt
  const encaisses  = commandes.filter(c => c.status === 'livre')
  const caJour     = encaisses.filter(c => {
    const dateRef = c.updatedAt || c.createdAt
    const d = dateRef ? new Date(dateRef).toLocaleDateString('fr-CA') : ''
    return d === todayStr
  }).reduce((s, c) => s + totalCommande(c), 0)

  const selected = commandes.find(c => c.id === selectedId)
    || aEncaisser[0]
    || commandes[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ebony)', color: 'var(--cream)', fontFamily: 'var(--font-dm)' }}>

      {/* Bannière caisse fermée */}
      {sessionCaisse === null && (
        <div style={{ background: 'rgba(239,68,68,.12)', borderBottom: '1px solid rgba(239,68,68,.3)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span>⚠️</span>
          <span style={{ flex: 1 }}>La caisse n'est pas ouverte. Ouvrez une session avant d'encaisser.</span>
          <Link href="/admin?tab=caisse" style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 12 }}>Ouvrir la caisse →</Link>
        </div>
      )}
      {/* Bannière session ouverte */}
      {sessionCaisse && (
        <div style={{ background: 'rgba(34,197,94,.06)', borderBottom: '1px solid rgba(34,197,94,.15)', padding: '6px 20px', fontSize: 11, color: 'var(--success)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>🟢 Session ouverte — {sessionCaisse.ouvertPar}</span>
          <span style={{ opacity: .6 }}>Depuis {new Date(sessionCaisse.ouvertureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span style={{ opacity: .6 }}>Fond : {sessionCaisse.fondCaisse?.toLocaleString('fr-FR')} FCFA</span>
        </div>
      )}

      {/* Header */}
      <header style={{
        position: 'sticky', top: bannerHeight, zIndex: 50, height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(8,6,5,.95)', borderBottom: '1px solid rgba(201,151,60,.18)',
        backdropFilter: 'blur(14px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,rgba(201,151,60,.2),rgba(201,151,60,.06))', border:'1px solid rgba(201,151,60,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>💳</div>
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 16, fontWeight: 600, color: 'var(--gold)' }}>
              Chez Maman Biya
            </div>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', opacity: .35 }}>
              Caisse · {user.name || user.login}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {syncing && <span style={{ fontSize: 10, opacity: .35 }}>↻</span>}
          <div className="caisse-header-ca" style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>
            💰 {caJour.toLocaleString('fr-FR')} FCFA
          </div>
          <div className="caisse-dev-sig" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'rgba(201,151,60,.18)', letterSpacing: .5 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(201,151,60,.22)' }}>&lt;/&gt;</span>
            Jordan – full-Dev
          </div>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid rgba(201,151,60,.3)', color: 'var(--gold)', padding: '6px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
            Quitter
          </button>
        </div>
      </header>

      {/* Tabs — Fix Bug 4: top = bannerHeight + headerHeight */}
      <div className="caisse-tabs" style={{
        borderBottom: '1px solid rgba(201,151,60,.15)',
        position: 'sticky', top: bannerHeight + 60,
        background: 'rgba(8,6,5,.97)', backdropFilter: 'blur(12px)', zIndex: 40,
      }}>
        {[
          { id: 'encaissement',   label: '💳 Encaissement',    badge: aEncaisser.length },
          { id: 'caisse_directe', label: '🛒 Caisse directe' },
          { id: 'factures',       label: '🧾 Reçus & Factures' },
          ...(momoEnAttente.length > 0 ? [{ id: 'momo',  label: `📱 MoMo (${momoEnAttente.length})`, badge: momoEnAttente.length }] : []),
          { id: 'messagerie',     label: '💬 Messages' },
          { id: 'cloture',        label: '🔒 Clôture' },
          { id: 'rh',             label: '👤 Mon espace RH' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '12px 0', border: 'none', background: 'none',
            fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
            color: tab === t.id ? 'var(--gold)' : 'var(--cream-faint)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`,
            marginBottom: -1, cursor: 'pointer', fontFamily: 'var(--font-dm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: 'var(--gold)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 7px', lineHeight: '16px' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {/* ONGLET 1 — ENCAISSEMENT */}
        {tab === 'encaissement' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

            {aEncaisser.length > 0 && (
              <div style={{ background: 'rgba(34,197,94,.07)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>
                    {aEncaisser.length} commande{aEncaisser.length > 1 ? 's' : ''} prête{aEncaisser.length > 1 ? 's' : ''} à encaisser
                  </div>
                  <div style={{ fontSize: 12, opacity: .5, marginTop: 2 }}>
                    Total : {aEncaisser.reduce((s,c) => s+totalCommande(c), 0).toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', opacity: .4 }}>Chargement…</div>
            ) : (
              <>
                {/* Commandes prêtes à encaisser */}
                {aEncaisser.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: .35, marginBottom: 10 }}>
                      À encaisser maintenant
                    </div>
                    {aEncaisser.map(cmd => (
                      <CommandeEncaissement
                        key={cmd.id}
                        cmd={cmd}
                        onEncaisser={sessionCaisse ? () => setEncModal(cmd) : null}
                        onAnnuler={sessionCaisse ? () => { setAnnulMotif('Client absent'); setAnnulModal(cmd) } : null}
                        caisseOuverte={!!sessionCaisse}
                        total={totalCommande(cmd)}
                      />
                    ))}
                  </div>
                )}

                {/* Fix Bug 3 — En préparation inclut en_preparation */}
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: .35, marginBottom: 10 }}>
                    En préparation
                  </div>
                  {commandes.filter(c => ['nouveau','en_cours','en_preparation','en_livraison'].includes(c.status)).length === 0 ? (
                    <div style={{ textAlign: 'center', opacity: .3, padding: '20px 0', fontSize: 13 }}>Aucune commande en cours</div>
                  ) : commandes.filter(c => ['nouveau','en_cours','en_preparation','en_livraison'].includes(c.status)).map(cmd => (
                    <div key={cmd.id} style={{ background: 'rgba(240,232,216,.025)', border: '1px solid rgba(201,151,60,.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: .75 }}>
                      <div>
                        <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{cmd.id}</span>

                        <div style={{ fontSize: 11, opacity: .35, marginTop: 2 }}>
                          {STATUS[cmd.status]?.emoji} {STATUS[cmd.status]?.label}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 14 }}>
                        {totalCommande(cmd).toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ONGLET 2 — CAISSE DIRECTE */}
        {tab === 'caisse_directe' && (
          <CaisseDirecteTab
            bannerHeight={bannerHeight}
            sessionCaisse={sessionCaisse}
            parametres={parametres}
            branding={branding}
          />
        )}

        {/* ONGLET 3 — REÇUS & FACTURATION */}
        {tab === 'factures' && (
          <FacturationTab
            commandes={commandes}
            selectedId={selected?.id || null}
            onSelect={setSelectedId}
            bannerHeight={bannerHeight}
            sessionCaisse={sessionCaisse}
            caissier={user?.name || user?.login}
            parametres={parametres}
            branding={branding}
          />
        )}

        {/* ONGLET 4 — MON ESPACE RH (sorti de CaisseDirecteTab) */}
        {tab === 'rh' && (
          <div style={{ padding: '4px 0' }}>
            <RHPanel user={user} />
          </div>
        )}

        {/* ONGLET 5 — MOMO EN ATTENTE */}
        {tab === 'momo' && (
          <MomoAttenteTab
            commandes={momoEnAttente}
            onConfirmer={async (cmd) => {
              await fetch(`/api/commandes/${cmd.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paiement: 'cinetpay_confirme', status: 'pret' }),
              })
              await fetchCommandes(true)
            }}
          />
        )}

        {/* ONGLET 6 — MESSAGERIE */}
        {tab === 'messagerie' && (
          <div style={{ padding: '4px 0' }}>
            <MessageriePanel user={user} />
          </div>
        )}

        {/* ONGLET 6 — CLÔTURE SESSION */}
        {tab === 'cloture' && (
          <ClotureTab
            sessionCaisse={sessionCaisse}
            commandes={commandes}
            caissier={user?.name || user?.login}
            onSessionChange={(s) => setSessionCaisse(s)}
          />
        )}
      </div>

      {/* Modal encaissement */}
      {encModal && (
        <EncaissementModal
          cmd={encModal}
          total={totalCommande(encModal)}
          loading={encLoading}
          error={encError}
          parametres={parametres}
          sessionCaisse={sessionCaisse}
          onConfirm={(mode, rendu) => confirmerEncaissement(encModal, mode, rendu)}
          onClose={() => { setEncModal(null); setEncError('') }}
        />
      )}

      {/* Modal annulation */}
      {annulModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
             onClick={e => e.target === e.currentTarget && setAnnulModal(null)}>
          <div style={{ background: '#141008', border: '1px solid rgba(239,68,68,.3)', borderRadius: 16, padding: '24px 20px', width: '100%', maxWidth: 380 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--danger)', marginBottom: 6 }}>🚫 Annuler la commande</div>
            <div style={{ fontSize: 12, opacity: .5, marginBottom: 16 }}>{annulModal.id} · {totalCommande(annulModal).toLocaleString('fr-FR')} FCFA</div>
            <div style={{ fontSize: 11, letterSpacing: 1, opacity: .35, marginBottom: 8 }}>MOTIF D'ANNULATION</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {['Client absent', 'Rupture de stock', 'Erreur de commande', 'Doublon', 'Demande client', 'Autre'].map(m => (
                <button key={m} onClick={() => setAnnulMotif(m)} style={{
                  padding: '9px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: annulMotif === m ? 'rgba(239,68,68,.12)' : 'rgba(240,232,216,.03)',
                  color: annulMotif === m ? 'var(--danger)' : 'rgba(240,232,216,.7)',
                  fontFamily: 'var(--font-dm)', fontSize: 13, fontWeight: annulMotif === m ? 700 : 400,
                  border: `1px solid ${annulMotif === m ? 'rgba(239,68,68,.4)' : 'rgba(201,151,60,.1)'}`,
                }}>
                  {annulMotif === m ? '● ' : '○ '}{m}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAnnulModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(201,151,60,.2)', color: 'var(--cream-faint)', fontSize: 12, cursor: 'pointer' }}>
                Retour
              </button>
              <button onClick={() => annulerCommande(annulModal, annulMotif)} disabled={annulBusy} style={{
                flex: 2, padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: annulBusy ? 'rgba(239,68,68,.2)' : 'linear-gradient(135deg,#ef4444,#b91c1c)',
                color: '#fff', border: 'none', cursor: annulBusy ? 'default' : 'pointer',
              }}>
                {annulBusy ? '⏳ Annulation…' : '🚫 Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fix Bug 5 — alertes sonores nouvelles commandes prêtes */}
      <NotifAlert commandes={commandes.filter(c => c.status === 'pret')} />
    </div>
  )
}

