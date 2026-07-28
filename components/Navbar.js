'use client'
// Navbar.js — v12 LUXURY · Chez Maman Biya

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRestaurantConfig } from '@/hooks/useRestaurantConfig'

const LINKS = [
  { href: '/menu',        label: 'Notre carte' },
  { href: '/reservation', label: 'Réserver' },
  { href: '/a-propos',    label: 'Notre histoire' },
  { href: '/suivi',       label: 'Suivi commande' },
]

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileVis,  setMobileVis]  = useState(false)
  const pathname = usePathname()

  // [v18 branding] Nom, tagline, tel et logo dynamiques
  const { config } = useRestaurantConfig()
  const nomResto   = config.nom     || 'Chez Maman Biya'
  const tagline    = config.tagline || 'Restaurant · Yaoundé'
  const telAffiche = config.tel     || '+237 677 000 000'
  const telHref    = `tel:${(config.tel || '+237677000000').replace(/[\s\-().]/g, '')}`

  const isAdmin = pathname?.startsWith('/admin')

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (mobileOpen) { document.body.style.overflow = 'hidden'; setMobileVis(true) }
    else {
      const t = setTimeout(() => { document.body.style.overflow = ''; setMobileVis(false) }, 400)
      return () => clearTimeout(t)
    }
  }, [mobileOpen])

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => { return () => { document.body.style.overflow = '' } }, [])

  const closeMenu = useCallback(() => setMobileOpen(false), [])

  if (isAdmin) return null

  return (
    <>
      <style>{`
        @keyframes menuIn  { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:none} }
        @keyframes menuOut { from{opacity:1;transform:none} to{opacity:0;transform:translateX(100%)} }
        @keyframes linkUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        .nav-link { position:relative; transition:color .22s; }
        .nav-link::after {
          content:''; position:absolute; bottom:-6px; left:0; width:0; height:1px;
          background:var(--gold); transition:width .28s cubic-bezier(.22,1,.36,1);
        }
        .nav-link:hover::after, .nav-link.active::after { width:100%; }
        .nav-cta {
          position:relative; overflow:hidden;
          background:transparent; color:var(--gold);
          border:1px solid rgba(201,151,60,.4); border-radius:6px;
          padding:9px 22px; font-size:12px; font-weight:700; letter-spacing:2px;
          text-transform:uppercase; text-decoration:none; font-family:var(--font-dm);
          transition: background .22s, border-color .22s, transform .18s, box-shadow .22s;
          display:inline-flex; align-items:center; gap:7px;
        }
        .nav-cta:hover {
          background:var(--gold); color:var(--ebony);
          border-color:var(--gold);
          transform:translateY(-1px);
          box-shadow:0 8px 24px rgba(201,151,60,.3);
        }
        @media(max-width:900px){.nav-links-desktop{display:none!important}.nav-hamburger{display:flex!important}}
        @media(min-width:901px){.nav-hamburger{display:none!important}}
      `}</style>

      <nav
        role="navigation"
        aria-label="Navigation principale"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: scrolled ? '14px 40px' : '22px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: scrolled ? 'var(--nav-scrolled-bg)' : 'transparent',
          backdropFilter: scrolled ? 'blur(18px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-gold)' : 'none',
          transition: 'all 0.4s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* Logo */}
        <Link href="/" aria-label="Chez Maman Biya — Accueil" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* [v18] Icône : vraie image si logo uploadé, emoji de secours sinon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(201,151,60,.2), rgba(201,151,60,.06))',
            border: '1px solid rgba(201,151,60,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0, overflow: 'hidden',
          }}>
            {config.logo
              ? <img src={config.logo} alt={nomResto} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
              : '🍲'
            }
          </div>
          <div>
            {/* [v18] Nom et tagline dynamiques */}
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 18, fontWeight: 600, color: 'var(--gold)', lineHeight: 1.1, letterSpacing: .3 }}>
              {nomResto}
            </div>
            <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--nav-tagline-color)', marginTop: 1 }}>
              {tagline}
            </div>
          </div>
        </Link>

        {/* Liens Desktop */}
        <div className="nav-links-desktop" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`nav-link${pathname === l.href ? ' active' : ''}`} style={{
              fontFamily: 'var(--font-dm)', fontSize: 12, letterSpacing: 2,
              textTransform: 'uppercase', textDecoration: 'none',
              color: pathname === l.href ? 'var(--gold)' : 'var(--nav-link-color)',
              fontWeight: 500,
            }}>
              {l.label}
            </Link>
          ))}
          <Link href="/commande" className="nav-cta">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.56l1.38-7.44H6"/>
            </svg>
            Commander
          </Link>
        </div>

        {/* Hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileOpen(v => !v)}
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileOpen}
          style={{
            display: 'none', flexDirection: 'column', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer', padding: 8, zIndex: 210,
          }}
        >
          {[
            { transform: mobileOpen ? 'rotate(45deg) translateY(7px)' : 'none' },
            { opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? 'scaleX(0)' : 'none' },
            { transform: mobileOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' },
          ].map((s, i) => (
            <span key={i} style={{
              display: 'block', width: 22, height: 1.5,
              background: 'var(--gold)', borderRadius: 2,
              transition: 'all 0.32s cubic-bezier(.22,1,.36,1)', ...s,
            }} />
          ))}
        </button>
      </nav>

      {/* Mobile overlay */}
      {(mobileOpen || mobileVis) && (
        <div
          role="dialog" aria-modal="true" aria-label="Menu mobile"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'var(--nav-mobile-bg)',
            backdropFilter: 'blur(24px)',
            animation: mobileOpen ? 'menuIn .38s cubic-bezier(.22,1,.36,1) forwards' : 'menuOut .32s ease forwards',
          }}
        >
          {/* Pattern kente */}
          <div style={{
            position: 'absolute', inset: 0, opacity: .03, pointerEvents: 'none',
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent 18px, rgba(201,151,60,.8) 18px, rgba(201,151,60,.8) 20px)`,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 0, padding: '80px 32px 48px', position: 'relative' }}>

            {/* [v18] Logo dynamique dans le menu mobile */}
            <div style={{ textAlign: 'center', marginBottom: 48, animation: mobileOpen ? 'linkUp .4s ease both' : 'none' }}>
              {config.logo ? (
                <div style={{ marginBottom: 10 }}>
                  <img src={config.logo} alt={nomResto}
                    style={{ height: 56, maxWidth: 160, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                </div>
              ) : (
                <div style={{ fontSize: 40, marginBottom: 10 }}>🍲</div>
              )}
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 26, fontWeight: 600, color: 'var(--gold)', letterSpacing: .5 }}>
                {nomResto}
              </div>
              <div style={{ width: 40, height: 1, margin: '10px auto 0', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
            </div>

            {/* Links */}
            {LINKS.map((l, i) => (
              <Link key={l.href} href={l.href} onClick={closeMenu} style={{
                fontFamily: 'var(--font-dm)', fontSize: 16, letterSpacing: 3,
                textTransform: 'uppercase', textDecoration: 'none',
                color: pathname === l.href ? 'var(--gold)' : 'var(--nav-mobile-link)',
                padding: '16px 32px', width: '100%', maxWidth: 320, textAlign: 'center',
                borderBottom: '1px solid rgba(201,151,60,.07)',
                animation: mobileOpen ? `linkUp .4s ${i * .07}s ease both` : 'none',
                transition: 'color .2s',
              }}>
                {l.label}
              </Link>
            ))}

            <Link href="/commande" onClick={closeMenu} style={{
              marginTop: 32, padding: '16px 48px', borderRadius: 8,
              background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
              color: 'var(--ebony)', textDecoration: 'none',
              fontFamily: 'var(--font-dm)', fontSize: 13, fontWeight: 800,
              letterSpacing: 2, textTransform: 'uppercase',
              animation: mobileOpen ? 'linkUp .4s .32s ease both' : 'none',
              boxShadow: '0 12px 36px rgba(201,151,60,.3)',
            }}>
              Commander maintenant
            </Link>

            {/* [v18] Téléphone dynamique */}
            <a href={telHref} style={{
              marginTop: 32, color: 'rgba(240,232,216,.3)', textDecoration: 'none',
              fontSize: 12, letterSpacing: 2,
              animation: mobileOpen ? 'linkUp .4s .42s ease both' : 'none',
            }}>
              {telAffiche}
            </a>
          </div>
        </div>
      )}
    </>
  )
}
