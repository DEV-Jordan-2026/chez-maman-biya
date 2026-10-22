'use client'
// Footer.js — v12 LUXURY · Chez Maman Biya

import Link from 'next/link'
import { useMemo } from 'react'

const LIENS = [
  { href: '/menu',        label: 'Notre carte' },
  { href: '/reservation', label: 'Réserver une table' },
  { href: '/commande',    label: 'Commander en ligne' },
  { href: '/a-propos',    label: 'Notre histoire' },
  { href: '/suivi',       label: 'Suivre ma commande' },
]

const HORAIRES = [
  { jour: 'Lundi – Vendredi', heure: '11h00 – 22h00', open: [11, 22], days: [1,2,3,4,5] },
  { jour: 'Samedi',           heure: '10h00 – 23h00', open: [10, 23], days: [6] },
  { jour: 'Dimanche',         heure: '11h00 – 21h00', open: [11, 21], days: [0] },
]

function useIsOuvert() {
  return useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours() + now.getMinutes() / 60
    for (const h of HORAIRES) {
      if (h.days.includes(day)) return hour >= h.open[0] && hour < h.open[1]
    }
    return false
  }, [])
}

export default function Footer() {
  const year = new Date().getFullYear()
  const isOuvert = useIsOuvert()

  return (
    <footer className="site-footer" style={{ background: 'var(--ebony-1)', borderTop: '1px solid var(--border-gold)', color: 'var(--cream)', fontFamily: 'var(--font-dm)' }}>
      {/* Ligne or haut */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--gold) 20%, var(--terracotta) 50%, var(--gold) 80%, transparent)' }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 60px 40px' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', gap: 56 }}>

          {/* Col 1 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,rgba(201,151,60,.2),rgba(201,151,60,.06))', border: '1px solid rgba(201,151,60,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🍲</div>
              <div>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 20, fontWeight: 600, color: 'var(--gold)', letterSpacing: .3 }}>Chez Maman Biya</div>
                <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--cream-faint)', marginTop: 2 }}>Restaurant · Yaoundé</div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'rgba(240,232,216,.4)', lineHeight: 1.8, marginBottom: 24, maxWidth: 300 }}>
              Depuis 2012, Maman Biya prépare avec amour les saveurs authentiques du Cameroun. Chaque plat raconte une histoire, celle de nos traditions et de notre terroir.
            </p>

            {/* Paiements */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,232,216,.25)', marginBottom: 10 }}>Paiements acceptés</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'MTN MoMo', color: '#F59E0B' },
                  { label: 'Orange Money', color: '#F97316' },
                  { label: 'Espèces', color: 'var(--gold)' },
                ].map(p => (
                  <div key={p.label} style={{ padding: '5px 10px', borderRadius: 6, background: `${p.color}12`, border: `1px solid ${p.color}25`, fontSize: 10, color: p.color, fontWeight: 600, letterSpacing: .5 }}>
                    {p.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Statut */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: isOuvert ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${isOuvert ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, borderRadius: 8, padding: '7px 14px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOuvert ? 'var(--success)' : 'var(--danger)', display: 'inline-block', animation: isOuvert ? 'auraPulse 2s ease infinite' : 'none' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: isOuvert ? 'var(--success)' : 'var(--danger)' }}>
                {isOuvert ? 'Ouvert maintenant' : 'Fermé actuellement'}
              </span>
            </div>
          </div>

          {/* Col 2 — Navigation */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20, fontWeight: 600 }}>Navigation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {LIENS.map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 13, color: 'rgba(240,232,216,.45)', textDecoration: 'none', transition: 'color .2s', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,232,216,.45)'}
                >
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-gold-h)', display: 'inline-block', flexShrink: 0 }} />
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Col 3 — Horaires */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20, fontWeight: 600 }}>Horaires</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {HORAIRES.map(h => (
                <div key={h.jour}>
                  <div style={{ fontSize: 12, color: 'rgba(240,232,216,.6)', marginBottom: 2 }}>{h.jour}</div>
                  <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>{h.heure}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 20, fontWeight: 600 }}>Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', text: 'Quartier Bastos, Yaoundé, Cameroun' },
                { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', text: '+237 691 78 33 41', href: 'tel:+237691783341' },
                { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', text: 'contact@chezmamanbiya.cm', href: 'mailto:contact@chezmamanbiya.cm' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={1.5} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2, opacity: .7 }}>
                    <path d={item.icon} />
                  </svg>
                  {item.href
                    ? <a href={item.href} style={{ fontSize: 12, color: 'rgba(240,232,216,.45)', textDecoration: 'none', transition: 'color .2s', lineHeight: 1.5 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,232,216,.45)'}
                      >{item.text}</a>
                    : <span style={{ fontSize: 12, color: 'rgba(240,232,216,.45)', lineHeight: 1.5 }}>{item.text}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Séparateur + bas */}
        <div style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
          {/* Mention démo : le restaurant est fictif, le téléphone et WhatsApp mènent au développeur */}
          <p style={{ fontSize: 12, color: 'rgba(240,232,216,.55)', lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>
            Site de démonstration : Chez Maman Biya est un restaurant fictif. Le téléphone et WhatsApp
            mènent à Steve Jordan Tankoua, développeur du site.{' '}
            <a href="https://portfolio-steve-jordan.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>
              Voir son portfolio
            </a>
          </p>
          <div className="footer-bottom-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: 'rgba(240,232,216,.2)', letterSpacing: .5 }}>
                © {year} Chez Maman Biya — Tous droits réservés
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(240,232,216,.12)', letterSpacing: .4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(201,151,60,.25)' }}>&lt;/&gt;</span>
                <span>Jordan – full-Dev</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['var(--gold)', 'var(--terracotta)', 'var(--forest)', 'var(--indigo)', 'var(--gold)'].map((c, i) => (
                <div key={i} style={{ width: i === 2 ? 16 : 6, height: 3, borderRadius: 2, background: c, opacity: .4 }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {[
                { href: '/mentions-legales', label: 'Mentions légales' },
                { href: '/confidentialite', label: 'Confidentialité' },
              ].map(l => (
                <Link key={l.href} href={l.href} style={{ fontSize: 11, color: 'rgba(240,232,216,.2)', textDecoration: 'none', letterSpacing: .5, transition: 'color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,232,216,.5)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,232,216,.2)'}
                >
                  {l.label}
                </Link>
              ))}
              {/* Séparateur discret */}
              <span style={{ width: 1, height: 10, background: 'rgba(240,232,216,.08)', display: 'inline-block' }} />
              {/* Lien Espace Équipe — volontairement très atténué, visible aux staff */}
              <Link
                href="/admin/login"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(240,232,216,.12)', textDecoration: 'none', letterSpacing: .5, transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(201,151,60,.5)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,232,216,.12)'}
                title="Espace réservé au personnel"
              >
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Espace équipe
              </Link>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes auraPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.9;transform:scale(1.3)}}`}</style>
    </footer>
  )
}
