'use client'

import { useState, useEffect, useCallback } from 'react'

const CATS = ['Achats', 'Énergie', 'Personnel', 'Entretien', 'Marketing', 'Loyer', 'Autre']

// ── Couleurs par catégorie de dépense ─────────────────────────────────────────
const CAT_COLORS = {
  'Achats':    '#f59e0b',
  'Énergie':   '#06b6d4',
  'Personnel': '#8b5cf6',
  'Entretien': '#64748b',
  'Marketing': '#ec4899',
  'Loyer':     '#f97316',
  'Autre':     '#94a3b8',
}

export default function ComptabilitePanel({ commandes }) {
  const [depenses, setDepenses] = useState([])
  const [newDep, setNewDep]     = useState({ label: '', montant: '', cat: 'Achats' })
  const [periode, setPeriode]   = useState('mois')
  const [loading, setLoading]   = useState(true)

  // ── Calcul de la date de début de période ────────────────────────────────
  const today  = new Date()
  const debut  = periode === 'jour'
    ? today.toISOString().split('T')[0]
    : periode === 'semaine'
      ? new Date(today - 7 * 86_400_000).toISOString().split('T')[0]
      : new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

  const fetchDepenses = useCallback(async () => {
    try {
      const res = await fetch(`/api/depenses?depuis=${debut}`, { cache: 'no-store' })
      const data = await res.json()
      setDepenses(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[ComptabilitePanel] fetch depenses:', e)
    } finally {
      setLoading(false)
    }
  }, [debut])

  useEffect(() => { fetchDepenses() }, [fetchDepenses])

  const commandesPeriode = commandes.filter(c => {
    if (c.status !== 'livre') return false
    // Utiliser updatedAt (date d'encaissement réelle) ou createdAt si updatedAt absent
    const dateRef = (c.updatedAt || c.createdAt || '').slice(0, 10)
    return dateRef >= debut
  })

  // CA = somme des totaux encaissés (source : commandes.total, champ DB fiable)
  const ca = commandesPeriode.reduce((s, c) => s + (c.total || 0), 0)

  // Réconciliation TVA DGI-Cameroun : 19.25% inclus dans le total TTC
  // HT = TTC / 1.1925 — TVA collectée = TTC - HT
  const tauxTVA   = 0.1925
  const caHT      = ca > 0 ? Math.round(ca / (1 + tauxTVA)) : 0
  const tvaColl   = ca - caHT

  // Décomposition des dépenses par catégorie
  const depParCat = CATS.reduce((acc, c) => ({ ...acc, [c]: 0 }), {})
  depenses.forEach(d => {
    if (depParCat[d.categorie] !== undefined) depParCat[d.categorie] += (d.montant || 0)
    else depParCat['Autre'] = (depParCat['Autre'] || 0) + (d.montant || 0)
  })

  const totalDepenses = depenses.reduce((s, d) => s + (d.montant || 0), 0)
  const marge         = caHT - totalDepenses   // Marge sur HT — plus pertinent fiscalement
  const margeGross    = ca - totalDepenses     // Marge brute TTC (avant impôts)
  const tauxMarge     = caHT > 0 ? Math.round((marge / caHT) * 100) : 0
  const ticketMoyen   = commandesPeriode.length > 0 ? Math.round(ca / commandesPeriode.length) : 0

  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Libellé', 'Catégorie', 'Montant TTC FCFA', 'Montant HT FCFA', 'TVA FCFA', 'N° Facture'],
      ...commandesPeriode.map(c => {
        const ttc = c.total || 0
        const ht  = Math.round(ttc / (1 + tauxTVA))
        const tva = ttc - ht
        return [
          (c.updatedAt || c.createdAt)?.slice(0,10),
          'Recette',
          `Cmd ${c.id}${c.client ? ' — ' + c.client : ''}`,
          'CA',
          ttc, ht, tva,
          c.numeroFacture || '',
        ]
      }),
      ...depenses.map(d => [d.date, 'Dépense', d.libelle, d.categorie, -d.montant, '', '', '']),
      // Ligne récap
      [],
      ['TOTAL CA TTC', '', '', '', ca, caHT, tvaColl, ''],
      ['TOTAL DÉPENSES', '', '', '', -totalDepenses, '', '', ''],
      ['MARGE (HT - charges)', '', '', '', marge, '', '', ''],
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `compta-${debut}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const ajouterDepense = async () => {
    if (!newDep.label || !newDep.montant) return
    try {
      const res = await fetch('/api/depenses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          libelle:   newDep.label,
          montant:   parseInt(newDep.montant),
          categorie: newDep.cat,
          date:      today.toISOString().split('T')[0],
        }),
      })
      const dep = await res.json()
      setDepenses(prev => [dep, ...prev])
      setNewDep({ label: '', montant: '', cat: 'Achats' })
    } catch (e) {
      console.error('[ComptabilitePanel] ajout depense:', e)
    }
  }

  const supprimerDepense = async (id) => {
    // Optimistic
    setDepenses(prev => prev.filter(d => d.id !== id))
    try {
      await fetch(`/api/depenses/${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('[ComptabilitePanel] suppression depense:', e)
      fetchDepenses()
    }
  }

  const kpiStyle = (color) => ({
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${color}30`,
    borderRadius: 12, padding: '18px 22px', flex: '1 1 140px',
  })

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(201,151,60,.2)',
    borderRadius: 8, color: 'var(--cream)',
    padding: '8px 12px', fontSize: 13,
  }

  return (
    <div>
      {/* Sélecteur période */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['jour', "Aujourd'hui"], ['semaine', 'Semaine'], ['mois', 'Ce mois']].map(([id, label]) => (
          <button key={id} onClick={() => setPeriode(id)} style={{
            padding: '6px 16px', borderRadius: 20,
            border: `1px solid ${periode === id ? 'var(--success)' : 'rgba(16,185,129,.2)'}`,
            background: periode === id ? 'rgba(16,185,129,.1)' : 'transparent',
            color: periode === id ? 'var(--success)' : 'var(--cream-faint)',
            fontSize: 12, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* ── KPIs principaux ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={kpiStyle('var(--success)')}>
          <div style={{ fontSize: 10, opacity: .4, marginBottom: 5, letterSpacing: 1 }}>CA TTC</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>{ca.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize: 10, opacity: .4 }}>{commandesPeriode.length} commandes encaissées</div>
        </div>
        <div style={kpiStyle('rgba(201,151,60,.6)')}>
          <div style={{ fontSize: 10, opacity: .4, marginBottom: 5, letterSpacing: 1 }}>CA HT</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{caHT.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize: 10, opacity: .4 }}>TVA : {tvaColl.toLocaleString('fr-FR')} FCFA (19,25%)</div>
        </div>
        <div style={kpiStyle('var(--danger)')}>
          <div style={{ fontSize: 10, opacity: .4, marginBottom: 5, letterSpacing: 1 }}>DÉPENSES</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>{totalDepenses.toLocaleString('fr-FR')}</div>
          <div style={{ fontSize: 10, opacity: .4 }}>FCFA · {depenses.length} entrées</div>
        </div>
        <div style={kpiStyle(marge >= 0 ? 'var(--gold)' : 'var(--danger)')}>
          <div style={{ fontSize: 10, opacity: .4, marginBottom: 5, letterSpacing: 1 }}>MARGE (HT − charges)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: marge >= 0 ? 'var(--gold)' : 'var(--danger)' }}>
            {marge >= 0 ? '' : '−'}{Math.abs(marge).toLocaleString('fr-FR')}
          </div>
          <div style={{ fontSize: 10, opacity: .4 }}>{tauxMarge >= 0 ? tauxMarge : '−' + Math.abs(tauxMarge)}% du HT · ticket moy. {ticketMoyen.toLocaleString('fr-FR')} FCFA</div>
        </div>
      </div>

      {/* ── Réconciliation TVA ────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(201,151,60,.04)', border: '1px solid rgba(201,151,60,.15)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, opacity: .5, fontWeight: 700, letterSpacing: 1 }}>RÉCAP TVA DGI</div>
        <div style={{ fontSize: 12 }}>
          <span style={{ opacity: .4 }}>TTC : </span>
          <strong>{ca.toLocaleString('fr-FR')} FCFA</strong>
        </div>
        <div style={{ fontSize: 12 }}>
          <span style={{ opacity: .4 }}>HT : </span>
          <strong>{caHT.toLocaleString('fr-FR')} FCFA</strong>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gold)' }}>
          <span style={{ opacity: .6 }}>TVA collectée (19,25%) : </span>
          <strong>{tvaColl.toLocaleString('fr-FR')} FCFA</strong>
        </div>
      </div>

      {/* ── Répartition dépenses par catégorie ───────────────────────────────── */}
      {totalDepenses > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, opacity: .35, letterSpacing: 1, marginBottom: 10 }}>RÉPARTITION DES DÉPENSES</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATS.filter(c => depParCat[c] > 0).map(c => {
              const pct = Math.round((depParCat[c] / totalDepenses) * 100)
              return (
                <div key={c} style={{ flex: `0 0 auto`, background: 'rgba(255,255,255,.03)', border: `1px solid ${CAT_COLORS[c]}30`, borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: CAT_COLORS[c] }}>{pct}%</div>
                  <div style={{ fontSize: 10, opacity: .5, marginTop: 2 }}>{c}</div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>{depParCat[c].toLocaleString('fr-FR')}</div>
                </div>
              )
            })}
          </div>
          {/* Barre de progression stacked */}
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10, gap: 1 }}>
            {CATS.filter(c => depParCat[c] > 0).map(c => (
              <div key={c} style={{ flex: depParCat[c], background: CAT_COLORS[c], opacity: .8, minWidth: 2 }} />
            ))}
          </div>
        </div>
      )}

      {/* Ajout dépense */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(201,151,60,0.12)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 12, opacity: .5, marginBottom: 12, letterSpacing: 1 }}>+ AJOUTER UNE DÉPENSE</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={newDep.label} onChange={e => setNewDep(p => ({ ...p, label: e.target.value }))}
            placeholder="Description" style={{ ...inputStyle, flex: '2 1 160px' }} />
          <input value={newDep.montant} onChange={e => setNewDep(p => ({ ...p, montant: e.target.value }))}
            placeholder="Montant FCFA" type="number" style={{ ...inputStyle, flex: '1 1 120px' }} />
          <select value={newDep.cat} onChange={e => setNewDep(p => ({ ...p, cat: e.target.value }))}
            style={{ ...inputStyle, flex: '1 1 110px', background: 'rgba(30,20,10,0.95)' }}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={ajouterDepense} style={{ background: 'rgba(201,151,60,0.12)', border: '1px solid rgba(201,151,60,.4)', color: 'var(--gold)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste dépenses */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
        <div style={{ fontSize: 11, opacity: .35, letterSpacing: 1 }}>DÉPENSES DE LA PÉRIODE</div>
        <button onClick={exportCSV} style={{ fontSize:11,color:'var(--gold)',background:'rgba(201,151,60,.06)',border:'1px solid rgba(201,151,60,.25)',padding:'4px 12px',borderRadius:6,cursor:'pointer' }}>
          ⬇️ Export CSV
        </button>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0', opacity: .25 }}>Chargement…</div>
      ) : depenses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', opacity: .25 }}>Aucune dépense enregistrée</div>
      ) : depenses.map(dep => (
        <div key={dep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.08)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 13 }}>{dep.libelle}</span>
            <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 600, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 4 }}>
              {dep.categorie}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{dep.montant.toLocaleString('fr-FR')} FCFA</span>
            <button onClick={() => supprimerDepense(dep.id)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        </div>
      ))}
    </div>
  )
}
