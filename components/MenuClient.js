'use client'
// components/MenuClient.js — v11
// Page menu publique — côté client pour les filtres interactifs

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MenuClient({ initialMenu = [], siteImages = {} }) {
  const router = useRouter()

  // Retour intelligent : revient à la page précédente (accueil le plus
  // souvent) plutôt que de forcer une destination fixe.
  // Repli sur / si aucun historique (accès direct / nouvel onglet).
  const handleRetour = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const menuBg = siteImages.menu_bg || 'https://images.unsplash.com/photo-1609501676725-7186f017a4b5?w=1200&q=60'
  const [catActive, setCatActive] = useState('Tous')
  const [search, setSearch] = useState('')

  const cats = ['Tous', ...new Set(initialMenu.map(p => p.cat))]

  const affichés = initialMenu.filter(p => {
    if (!p.actif) return false
    if (catActive !== 'Tous' && p.cat !== catActive) return false
    if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ebony)',
      color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      paddingTop: 80,
    }}>

      <style>{`
        .plat-card{transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s,border-color .3s}
        .plat-card:hover{transform:translateY(-6px);box-shadow:0 20px 48px rgba(0,0,0,.5);border-color:rgba(201,151,60,.4)!important}
        .cat-btn{transition:all .18s}
        .cat-btn:hover{border-color:rgba(201,151,60,.55)!important;color:var(--gold)!important}
        .cmd-btn{transition:background .15s,transform .15s}
        .cmd-btn:hover{background:rgba(201,151,60,.22)!important;transform:scale(1.03)}
        .search-input:focus{border-color:rgba(201,151,60,.6)!important;outline:none}
      `}</style>

      {/* ── Hero menu ── */}
      <div style={{
        padding: '52px 32px 36px',
        textAlign: 'center',
        borderBottom: '1px solid rgba(201,151,60,.1)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Fond subtil — marché africain flou */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('${menuBg}')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'brightness(.08) saturate(0.5)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(201,151,60,.08) 0%, transparent 65%)',
        }} />
        <button onClick={handleRetour} style={{
          position: 'fixed', top: 16, left: 16, zIndex: 60,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--cream-dim)', background: 'var(--ebony-1)',
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
          fontSize: 13, padding: '6px 10px', borderRadius: 8,
          border: '1px solid rgba(201,151,60,0.2)',
          cursor: 'pointer', font: 'inherit',
        }}>
          ← Retour
        </button>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', opacity: .4, marginBottom: 14 }}>
            Cuisine Camerounaise Authentique
          </div>
          <h1 style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: 'clamp(28px,5vw,48px)',
            fontWeight: 700, color: 'var(--gold)',
            margin: '0 0 12px',
          }}>
            Notre Carte
          </h1>
          <p style={{ opacity: .5, fontSize: 14, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.7 }}>
            Plats traditionnels préparés chaque jour avec des ingrédients frais du marché de Mokolo.
            Livraison à Yaoundé · MTN MoMo · Orange Money
          </p>
          <Link href="/commande" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg,var(--gold),#b06a2e)',
            color: '#fff', textDecoration: 'none',
            padding: '13px 28px', borderRadius: 6,
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase',
            boxShadow: '0 4px 20px rgba(201,151,60,.3)',
          }}>
            Commander en ligne →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Barre recherche + filtres ── */}
        <div style={{ marginBottom: 28 }}>
          {/* Recherche */}
          <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, opacity: .35, pointerEvents: 'none',
            }}>🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Rechercher un plat…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 16px 11px 40px',
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(201,151,60,.2)',
                borderRadius: 8, color: 'var(--cream)',
                fontSize: 14, outline: 'none',
                transition: 'border-color .2s',
              }}
            />
          </div>

          {/* Filtres catégorie */}
          <div style={{
            display: 'flex', gap: 8,
            overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'none',
          }}>
            {cats.map(cat => (
              <button
                key={cat}
                className="cat-btn"
                onClick={() => setCatActive(cat)}
                style={{
                  flexShrink: 0,
                  padding: '8px 18px', borderRadius: 24,
                  border: `1px solid ${catActive === cat ? 'var(--gold)' : 'rgba(201,151,60,.2)'}`,
                  background: catActive === cat ? 'rgba(201,151,60,.15)' : 'transparent',
                  color: catActive === cat ? 'var(--gold)' : 'rgba(245,239,230,.45)',
                  fontSize: 13, fontWeight: catActive === cat ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
                <span style={{ marginLeft: 6, opacity: .6, fontSize: 11 }}>
                  ({cat === 'Tous'
                    ? initialMenu.filter(p => p.actif).length
                    : initialMenu.filter(p => p.actif && p.cat === cat).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Résultats count */}
        {search && (
          <p style={{ fontSize: 13, opacity: .4, marginBottom: 20 }}>
            {affichés.length} plat{affichés.length > 1 ? 's' : ''} trouvé{affichés.length > 1 ? 's' : ''}
          </p>
        )}

        {/* ── Grille des plats ── */}
        {affichés.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', opacity: .35 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
            <p style={{ fontSize: 15 }}>Aucun plat trouvé</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {affichés.map(plat => (
              <PlatCard key={plat.id} plat={plat} />
            ))}
          </div>
        )}

        {/* ── Footer CTA ── */}
        <div style={{
          marginTop: 64, textAlign: 'center',
          padding: '48px 24px',
          background: 'rgba(201,151,60,.04)',
          border: '1px solid rgba(201,151,60,.1)',
          borderRadius: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Motif géo */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 18px,rgba(201,151,60,.025) 18px,rgba(201,151,60,.025) 20px)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛵</div>
            <h2 style={{
              fontFamily: 'var(--font-playfair)',
              fontSize: 22, color: 'var(--gold)', marginBottom: 8,
            }}>
              Livraison à domicile
            </h2>
            <p style={{ opacity: .5, fontSize: 14, marginBottom: 6 }}>
              Yaoundé · Commande min. 2 000 FCFA · Frais de livraison : 500 FCFA
            </p>
            <p style={{ opacity: .35, fontSize: 13, marginBottom: 24 }}>
              Gratuit dès 5 000 FCFA · MTN MoMo · Orange Money · Espèces
            </p>
            <Link href="/commande" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg,var(--gold),#b06a2e)',
              color: '#fff', textDecoration: 'none',
              padding: '14px 32px', borderRadius: 6,
              fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(201,151,60,.3)',
            }}>
              Passer commande
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlatCard({ plat }) {
  return (
    <div
      className="plat-card"
      style={{
        background: 'rgba(255,255,255,.028)',
        border: '1px solid rgba(201,151,60,.1)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Zone image si dispo */}
      {plat.image && (
        <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
          <img
            src={plat.image}
            alt={plat.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
            background: 'linear-gradient(to top, rgba(13,10,7,.7), transparent)',
          }} />
        </div>
      )}

      <div style={{ padding: '20px 18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Popular badge */}
        {plat.popular && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'rgba(201,151,60,.15)',
            color: 'var(--gold)', border: '1px solid rgba(201,151,60,.3)',
            padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            ⭐ Populaire
          </div>
        )}

        {/* Emoji si pas d'image */}
        {!plat.image && (
          <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>{plat.emoji}</div>
        )}

        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 7 }}>
          {plat.name}
        </div>
        <div style={{ fontSize: 13, opacity: .48, lineHeight: 1.6, flex: 1, marginBottom: 16 }}>
          {plat.desc}
        </div>

        {/* Catégorie tag */}
        <div style={{
          fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
          opacity: .3, marginBottom: 14,
        }}>{plat.cat}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>
              {plat.price.toLocaleString('fr-FR')}
            </span>
            <span style={{ fontSize: 12, opacity: .4, marginLeft: 4 }}>FCFA</span>
          </div>
          <Link href="/commande" className="cmd-btn" style={{
            background: 'rgba(201,151,60,.1)',
            border: '1px solid rgba(201,151,60,.3)',
            color: 'var(--gold)', textDecoration: 'none',
            padding: '8px 14px', borderRadius: 6,
            fontSize: 12, fontWeight: 600,
          }}>
            Commander
          </Link>
        </div>
      </div>
    </div>
  )
}
