'use client'
// HeroClient.js — v12 LUXURY · Chez Maman Biya

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Navbar from './Navbar'
import Footer from './Footer'

// ── Témoignages ────────────────────────────────────────────────────────────────
const TEMOS = [
  { nom: 'Christelle Mvondo', quartier: 'Bastos', texte: 'Le ndolé est exactement comme celui de ma grand-mère à Bafang. Ça m\'a mis les larmes aux yeux, honnêtement.', note: 5, plat: 'Ndolé au poisson fumé', initiales: 'CM' },
  { nom: 'Patrick Owona', quartier: 'Melen', texte: 'J\'ai commandé pour toute ma famille — 8 personnes. Tout était chaud à la livraison. Le livreur était même en avance.', note: 5, plat: 'Poulet DG', initiales: 'PO' },
  { nom: 'Dr. Fanta Bello', quartier: 'Nlongkak', texte: 'Le salon VIP pour mon anniversaire — c\'était magnifique. Service discret et professionnel. Je recommande les yeux fermés.', note: 5, plat: 'Poisson braisé', initiales: 'FB' },
  { nom: 'Jean-Claude Nkouanyang', quartier: 'Omnisport', texte: 'Ce qui me surprend à chaque fois c\'est la constance. Ça fait 3 ans, le goût ne change jamais. C\'est ça le vrai.', note: 5, plat: 'Eru avec waterleaf', initiales: 'JN' },
]

// ── Plats vedettes — fallback si aucun item popular en base ──────────────────
const VEDETTES_FALLBACK = [
  { name: 'Ndolé au poisson fumé', price: 3500, image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=700&q=90', desc: 'La recette de Maman, inchangée depuis 2012.', tag: 'Le plus commandé', tagColor: 'var(--gold)' },
  { name: 'Poulet DG braisé',      price: 5000, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=700&q=90', desc: 'Braisé au feu de bois, servi avec plantain doré.', tag: 'Coup de cœur', tagColor: 'var(--success)' },
  { name: 'Poisson braisé entier', price: 4500, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=700&q=90', desc: 'Tilapia du marché de Mokolo, grillé minute.', tag: 'Fraîcheur garantie', tagColor: 'var(--info)' },
]

// Tags mis en avant pour les 3 premières vedettes
const VEDETTE_TAGS = [
  { tag: 'Le plus commandé', tagColor: 'var(--gold)' },
  { tag: 'Coup de cœur',     tagColor: 'var(--success)' },
  { tag: 'Fraîcheur garantie', tagColor: 'var(--info)' },
]

const CHIFFRES = [
  { val: '+12', label: 'années d\'excellence' },
  { val: '4.9', label: 'Note moyenne' },
  { val: '+200', label: 'livraisons / mois' },
  { val: '100%', label: 'recettes originales' },
]

export default function HeroClient({ platDuJour, siteImages = {}, platsVedettes = [] }) {
  const [vis, setVis]         = useState(false)
  const [temoIdx, setTemoIdx] = useState(0)
  const [srVis, setSrVis]     = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const srRef = useRef(null)

  // ── Résoudre les images depuis props (server) avec fallbacks ─────────────
  const IMG = {
    hero_bg: siteImages.hero_bg || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1800&q=85',
    cta_bg:  siteImages.cta_bg  || 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1400&q=80',
    galerie: Array.isArray(siteImages.galerie) && siteImages.galerie.length === 5
      ? siteImages.galerie
      : [
          { url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=90',  label: 'Ambiance salle' },
          { url: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b5?w=500&q=85', label: 'Marché de Mokolo' },
          { url: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=500&q=85', label: 'Ndolé maison' },
          { url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=85', label: 'Préparation' },
          { url: 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=500&q=85', label: 'Plantain doré' },
        ],
  }

  // ── Plats vedettes : depuis la base (popular) ou fallback statique ────────
  const VEDETTES = (platsVedettes.length >= 1 ? platsVedettes.slice(0, 3) : VEDETTES_FALLBACK)
    .map((plat, i) => ({
      nom:      plat.name  || plat.nom,
      prix:     (plat.price || plat.prix || 0).toLocaleString('fr-FR'),
      photo:    plat.image || plat.photo || VEDETTES_FALLBACK[i]?.image || '',
      desc:     plat.desc  || plat.description || '',
      tag:      VEDETTE_TAGS[i]?.tag      || 'Incontournable',
      tagColor: VEDETTE_TAGS[i]?.tagColor || 'var(--gold)',
    }))

  useEffect(() => { const t = setTimeout(() => setVis(true), 60); return () => clearTimeout(t) }, [])
  useEffect(() => { const t = setTimeout(() => setHeroLoaded(true), 400); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const iv = setInterval(() => setTemoIdx(i => (i + 1) % TEMOS.length), 7000)
    return () => clearInterval(iv)
  }, [])

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('vis') }),
      { threshold: .12 }
    )
    document.querySelectorAll('.sr').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const WA_NUM = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '237691783341'
  const wa = `https://wa.me/${WA_NUM}?text=Bonjour%20Maman%20Biya%2C%20je%20voudrais%20commander%20!`
  const temo = TEMOS[temoIdx]

  return (
    <div className="dark-theme" style={{ background: 'var(--ebony)', color: 'var(--cream)', fontFamily: 'var(--font-dm)', overflowX: 'hidden' }}>
      <style>{`
        /* Grain */
        .grain-overlay::after {
          content:''; position:fixed; inset:-200%; width:400%; height:400%;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity:.018; animation:grain 8s steps(8) infinite; pointer-events:none; z-index:1000;
        }
        @keyframes grain { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-1%,-2%)} 40%{transform:translate(2%,1%)} 60%{transform:translate(-2%,2%)} 80%{transform:translate(1%,-1%)} }
        
        /* Hero animations */
        @keyframes fuAnim { from{opacity:0;transform:translateY(36px)} to{opacity:1;transform:none} }
        @keyframes fiAnim { from{opacity:0} to{opacity:1} }
        @keyframes lineGrow { from{width:0;opacity:0} to{width:100%;opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes countNum { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes temoFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes auraPulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.5;transform:scale(1.06)} }
        @keyframes scrollDot { 0%,100%{transform:translateY(0);opacity:.7} 50%{transform:translateY(8px);opacity:.2} }

        .fu { opacity:0 } .fu.v { animation:fuAnim .9s cubic-bezier(.22,1,.36,1) forwards }
        .fi { opacity:0 } .fi.v { animation:fiAnim 1s ease forwards }
        .d1{animation-delay:.07s!important} .d2{animation-delay:.16s!important} .d3{animation-delay:.27s!important}
        .d4{animation-delay:.40s!important} .d5{animation-delay:.55s!important} .d6{animation-delay:.72s!important}

        /* Cards plats */
        .card-plat { transition:transform .38s cubic-bezier(.22,1,.36,1), box-shadow .38s, border-color .3s }
        .card-plat:hover { transform:translateY(-10px); box-shadow:0 32px 72px rgba(0,0,0,.65); border-color:rgba(201,151,60,.5)!important }
        .card-plat:hover .card-img { transform:scale(1.08) }
        .card-img { transition:transform .65s cubic-bezier(.22,1,.36,1) }

        /* Buttons */
        .btn-or { transition:all .22s cubic-bezier(.22,1,.36,1) }
        .btn-or:hover { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 14px 40px rgba(201,151,60,.4) }
        .btn-or:active { transform:translateY(0) }
        .btn-ghost-hero { transition:all .22s }
        .btn-ghost-hero:hover { background:rgba(240,232,216,.1)!important; transform:translateY(-2px) }

        /* Galerie */
        .gal-item { overflow:hidden; border-radius:12px; position:relative; cursor:pointer }
        .gal-img { transition:transform .65s cubic-bezier(.22,1,.36,1), filter .4s; filter:brightness(.85) }
        .gal-item:hover .gal-img { transform:scale(1.06); filter:brightness(1) }
        .gal-overlay { opacity:0; transition:opacity .3s }
        .gal-item:hover .gal-overlay { opacity:1 }

        /* Témoignage */
        .temo-card { animation:temoFade .5s ease both }

        /* Scroll reveal */
        .sr { opacity:0; transform:translateY(32px); transition:opacity .75s ease, transform .75s ease }
        .sr.vis { opacity:1; transform:none }

        /* Bande texte défilant */
        @keyframes scrollText { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .scroll-track { animation:scrollText 24s linear infinite }
        .scroll-track:hover { animation-play-state:paused }

        /* Chiffres compteurs */
        .chiffre { transition:transform .3s }
        .chiffre:hover { transform:scale(1.04) }

        @media(max-width:768px) {
          .hero-split { flex-direction:column!important }
          .vedettes-grid { grid-template-columns:1fr!important }
          .galerie-grid { grid-template-columns:1fr 1fr!important }
          .chiffres-grid { grid-template-columns:1fr 1fr!important }
        }
        @media(max-width:768px) {
          .hero-content { padding:100px 32px 70px!important }
        }
        @media(max-width:480px) {
          .hero-cta-row { flex-direction:column!important; align-items:stretch!important }
          .hero-content { padding:90px 20px 60px!important }
        }
      `}</style>

      <div className="grain-overlay" />
      <Navbar />

      {/* ══════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>

        {/* Image de fond */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('${IMG.hero_bg}')`,
          backgroundSize: 'cover', backgroundPosition: 'center 40%',
          filter: 'brightness(.22) saturate(1.1)',
          transform: 'scale(1.03)',
          transition: 'transform 8s ease',
        }} />

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(8,6,5,.92) 40%, rgba(201,151,60,.06) 100%)',
        }} />

        {/* Motif wax subtil */}
        <div style={{
          position: 'absolute', inset: 0, opacity: .018, pointerEvents: 'none',
          backgroundImage: `
            repeating-linear-gradient(60deg, transparent 0, transparent 14px, rgba(201,151,60,.6) 14px, rgba(201,151,60,.6) 16px),
            repeating-linear-gradient(-60deg, transparent 0, transparent 14px, rgba(196,96,58,.4) 14px, rgba(196,96,58,.4) 16px)
          `,
          backgroundSize: '32px 32px',
        }} />

        {/* Auras colorées */}
        <div style={{ position: 'absolute', top: '10%', right: '5%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,151,60,.06) 0%, transparent 60%)', animation: 'auraPulse 6s ease infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,96,58,.05) 0%, transparent 60%)', animation: 'auraPulse 9s ease infinite', pointerEvents: 'none' }} />

        {/* Contenu Hero */}
        <div className="hero-content" style={{ position: 'relative', zIndex: 2, padding: '120px 60px 80px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <div style={{ maxWidth: 680 }}>

            {/* Overline */}
            <div className={`fu${vis ? ' v' : ''}`} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 2, background: 'linear-gradient(90deg, var(--gold), var(--terracotta))', borderRadius: 1 }} />
              <span style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600 }}>
                Restaurant Camerounais · Yaoundé, Bastos
              </span>
              <span title="Restaurant fictif : site de démonstration" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--cream)', fontWeight: 600, border: '1px solid var(--border-gold)', borderRadius: 4, padding: '2px 7px' }}>
                Démo
              </span>
            </div>

            {/* Titre */}
            <h1 className={`fu${vis ? ' v' : ''} d1 hero-title`} style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 'clamp(42px,7vw,80px)',
              fontWeight: 300,
              lineHeight: 1.08,
              letterSpacing: -1,
              color: '#fff',
              marginBottom: 10,
            }}>
              La cuisine de<br />
              <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontWeight: 400 }}>Maman Biya</em>
            </h1>
            <h1 className={`fu${vis ? ' v' : ''} d2 hero-title`} style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 'clamp(42px,7vw,80px)',
              fontWeight: 300,
              lineHeight: 1.08,
              letterSpacing: -1,
              color: 'rgba(240,232,216,.45)',
              marginBottom: 32,
            }}>
              vous voyager au Cameroun
            </h1>

            {/* Description */}
            <p className={`fu${vis ? ' v' : ''} d3`} style={{ fontSize: 16, color: 'rgba(240,232,216,.6)', lineHeight: 1.75, maxWidth: 500, marginBottom: 40 }}>
              Depuis 2012, des plats préparés avec amour, les ingrédients du marché de Mokolo, et la fierté du savoir-faire camerounais.
            </p>

            {/* CTA */}
            <div className={`fu${vis ? ' v' : ''} d4 hero-cta-row`} style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/commande" className="btn-or" style={{
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                color: 'var(--ebony)', padding: '16px 36px',
                borderRadius: 8, fontSize: 13, fontWeight: 800,
                letterSpacing: 2, textTransform: 'uppercase',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 32px rgba(201,151,60,.3)',
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.56l1.38-7.44H6"/>
                </svg>
                Commander maintenant
              </Link>
              <Link href="/reservation" className="btn-ghost-hero" style={{
                background: 'transparent', color: 'var(--cream)',
                border: '1px solid rgba(240,232,216,.2)',
                padding: '16px 36px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, letterSpacing: 2,
                textTransform: 'uppercase', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Réserver une table
              </Link>
            </div>

            {/* Badge live */}
            <div className={`fu${vis ? ' v' : ''} d5`} style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', rowGap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 20, padding: '6px 14px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'auraPulse 1.8s ease infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', letterSpacing: 1 }}>Ouvert maintenant</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(240,232,216,.3)', letterSpacing: .5 }}>
                Livraison en 30-45 min
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(240,232,216,.2)' }}>Découvrir</span>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, rgba(201,151,60,.5), transparent)', margin: '0 auto' }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          BANDE DÉROULANTE — Chiffres clés
      ══════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid var(--border-gold)', borderBottom: '1px solid var(--border-gold)', overflow: 'hidden', padding: '20px 0', background: 'var(--ebony-1)' }}>
        <div className="scroll-track" style={{ display: 'flex', gap: 0, width: 'max-content' }}>
          {[...Array(4)].flatMap(() => [
            'Ndolé au poisson fumé', '·', 'Poulet DG braisé', '·',
            'Eru avec waterleaf', '·', 'Poisson braisé entier', '·',
            'Koki maïs', '·', 'Soya de bœuf', '·', 'Mbongo tchobi', '·',
          ]).map((item, i) => (
            <span key={i} style={{
              fontSize: 11, letterSpacing: item === '·' ? 0 : 2.5,
              textTransform: 'uppercase',
              color: item === '·' ? 'var(--gold)' : 'rgba(240,232,216,.25)',
              padding: '0 16px', whiteSpace: 'nowrap',
              fontWeight: item === '·' ? 400 : 500,
            }}>{item}</span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          CHIFFRES CLÉS
      ══════════════════════════════════════════════════════════ */}
      <section className="sr" style={{ padding: '80px 60px', maxWidth: 1280, margin: '0 auto' }}>
        <div className="chiffres-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2 }}>
          {CHIFFRES.map((c, i) => (
            <div key={i} className="chiffre" style={{
              textAlign: 'center', padding: '40px 20px',
              borderRight: i < 3 ? '1px solid var(--border-gold)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 52, fontWeight: 300, color: 'var(--gold)', lineHeight: 1, marginBottom: 8 }}>
                {c.val}
              </div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,232,216,.4)' }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          PLATS VEDETTES
      ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '80px 60px', maxWidth: 1280, margin: '0 auto' }}>

        {/* En-tête section */}
        <div className="sr" style={{ marginBottom: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 1, background: 'var(--gold)' }} />
              Nos incontournables
            </div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 44, fontWeight: 300, lineHeight: 1.1, letterSpacing: -0.5 }}>
              La carte de Maman Biya
            </h2>
          </div>
          <Link href="/menu" style={{
            fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600,
            borderBottom: '1px solid rgba(201,151,60,.3)', paddingBottom: 4,
            transition: 'border-color .2s',
          }}>
            Voir toute la carte
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>

        <div className="vedettes-grid sr" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {VEDETTES.map((plat, i) => (
            <Link key={i} href="/menu" className="card-plat" style={{
              display: 'block', textDecoration: 'none',
              background: 'var(--ebony-2)',
              border: '1px solid var(--border-gold)',
              borderRadius: 18, overflow: 'hidden',
            }}>
              {/* Image */}
              <div style={{ height: 240, overflow: 'hidden', position: 'relative' }}>
                {plat.photo ? (
                  <img src={plat.photo} alt={plat.nom} className="card-img" style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: 'brightness(.85)',
                  }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'rgba(201,151,60,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🍽️</div>
                )}
                {/* Tag */}
                <div style={{
                  position: 'absolute', top: 14, left: 14,
                  background: `${plat.tagColor}20`, border: `1px solid ${plat.tagColor}50`,
                  color: plat.tagColor, backdropFilter: 'blur(8px)',
                  borderRadius: 20, padding: '5px 12px',
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {plat.tag}
                </div>
              </div>
              {/* Infos */}
              <div style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 22, fontWeight: 500, letterSpacing: -.3, color: 'var(--cream)' }}>
                    {plat.nom}
                  </h3>
                  <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: 18, fontWeight: 600, color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                    {plat.prix} F
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'rgba(240,232,216,.5)', lineHeight: 1.6 }}>
                  {plat.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          GALERIE PHOTOS
      ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '40px 60px 80px', maxWidth: 1280, margin: '0 auto' }}>
        <div className="sr" style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
            L'univers Maman Biya
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 44, fontWeight: 300 }}>
            Notre restaurant, notre famille
          </h2>
        </div>

        <div className="galerie-grid sr" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gridTemplateRows: '220px 220px', gap: 10 }}>
          {IMG.galerie.map((img, i) => (
            <div key={i} className="gal-item" style={{
              gridColumn: i === 0 ? '1' : undefined,
              gridRow: i === 0 ? '1 / 3' : undefined,
            }}>
              <img src={img.url} alt={img.label} className="gal-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div className="gal-overlay" style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 50%, rgba(8,6,5,.6) 100%)',
                display: 'flex', alignItems: 'flex-end', padding: 16,
              }}>
                <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,232,216,.8)', fontWeight: 500 }}>
                  {img.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TÉMOIGNAGES
      ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '80px 60px', background: 'var(--ebony-1)', borderTop: '1px solid var(--border-gold)', borderBottom: '1px solid var(--border-gold)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="sr" style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>
              Ce qu'ils disent
            </div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 44, fontWeight: 300 }}>Ils nous font confiance</h2>
            {/* Étoiles */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
              {Array(5).fill(0).map((_, i) => (
                <svg key={i} width={16} height={16} viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(240,232,216,.5)' }}>4.9 / 5 — 200+ avis</span>
            </div>
          </div>

          {/* Témoignage actif */}
          <div key={temoIdx} className="temo-card" style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(20px,3vw,28px)',
              fontStyle: 'italic', fontWeight: 300, lineHeight: 1.55,
              color: 'var(--cream)', marginBottom: 28,
            }}>
              "{temo.texte}"
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14, color: 'var(--ebony)', flexShrink: 0,
              }}>
                {temo.initiales}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>{temo.nom}</div>
                <div style={{ fontSize: 11, color: 'rgba(240,232,216,.4)', letterSpacing: .5 }}>{temo.quartier} · {temo.plat}</div>
              </div>
            </div>
          </div>

          {/* Points de navigation */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
            {TEMOS.map((_, i) => (
              <button key={i} onClick={() => setTemoIdx(i)} style={{
                width: i === temoIdx ? 20 : 7, height: 7, borderRadius: 4,
                background: i === temoIdx ? 'var(--gold)' : 'rgba(201,151,60,.25)',
                border: 'none', cursor: 'pointer',
                transition: 'width .3s cubic-bezier(.22,1,.36,1), background .2s',
              }} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════════════════════ */}
      <section className="sr" style={{ padding: '100px 60px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        {/* Fond */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url('${IMG.cta_bg}')`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(.12) saturate(.8)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(201,151,60,.06) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 16 }}>
            Commandez dès maintenant
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 52, fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>
            Laissez-vous porter<br />
            <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>par les saveurs</em>
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(240,232,216,.55)', lineHeight: 1.7, marginBottom: 40 }}>
            Livraison à domicile dans tout Yaoundé, ou réservez votre table pour une expérience inoubliable.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/commande" className="btn-or" style={{
              background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
              color: 'var(--ebony)', padding: '16px 40px',
              borderRadius: 8, fontSize: 13, fontWeight: 800,
              letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none',
              boxShadow: '0 12px 40px rgba(201,151,60,.35)',
            }}>
              Commander en ligne
            </Link>
            <Link href="/reservation" className="btn-ghost-hero" style={{
              background: 'transparent', color: 'var(--cream)',
              border: '1px solid rgba(240,232,216,.2)',
              padding: '16px 40px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, letterSpacing: 2,
              textTransform: 'uppercase', textDecoration: 'none',
            }}>
              Réserver une table
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
