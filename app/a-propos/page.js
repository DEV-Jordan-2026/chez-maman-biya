// @author TSJORDAN - Dev
// app/a-propos/page.js — Page "Notre Histoire"
// Server Component pour le SEO

import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { HISTOIRE, RESTAURANT_INFO, TEMOIGNAGES } from '@/lib/data'

export const metadata = {
  title: 'Notre histoire',
  description: 'Découvrez l\'histoire de Maman Biya et de son restaurant camerounais à Yaoundé. Depuis 2012, des recettes ancestrales préparées avec amour.',
}

export default function AProposPage() {
  return (
    <div style={{ background: 'var(--ebony)', minHeight: '100vh', color: '#f5efe6', fontFamily: 'var(--font-dm)' }}>
      <Navbar />

      {/* ── Hero ── */}
      <div style={{
        padding: '140px 24px 60px', textAlign: 'center',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(201,151,60,0.08) 0%, transparent 70%)',
        borderBottom: '1px solid rgba(201,151,60,0.1)',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.35, marginBottom: 14 }}>
          Notre histoire
        </div>
        <h1 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700,
          color: 'var(--gold)', marginBottom: 14,
        }}>
          L'histoire de {HISTOIRE.fondatrice} ❤️
        </h1>
        <p style={{ fontSize: 15, opacity: 0.5, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
          Depuis {HISTOIRE.annee}, nous cuisinons avec amour les recettes traditionnelles du Cameroun.
        </p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px' }}>

        {/* ── Récit ── */}
        <div style={{ marginBottom: 60 }}>
          {HISTOIRE.paragraphes.map((p, i) => (
            <p key={i} style={{
              fontSize: 16, lineHeight: 2, opacity: 0.7, marginBottom: 24,
              textAlign: 'justify',
            }}>
              {i === 0 ? (
                <>
                  {/* FIX: drop cap sans float — evite les bugs de layout mobile */}
                  <span style={{
                    fontFamily: 'var(--font-playfair)',
                    fontSize: 72, color: 'var(--gold)',
                    lineHeight: 0.72,
                    display: 'inline-block',
                    float: 'left',
                    marginRight: 8,
                    marginBottom: 4,
                    marginTop: 6,
                  }}>{p.charAt(0)}</span>
                  {p.slice(1)}
                  {/* FIX: clearfix après le drop cap */}
                  <span style={{ display: 'block', clear: 'both', height: 0 }} />
                </>
              ) : p}
            </p>
          ))}
        </div>

        {/* ── Nos valeurs ── */}
        <div style={{ marginBottom: 60 }}>
          <h2 style={{
            fontFamily: 'var(--font-playfair)', fontSize: 24, color: 'var(--gold)',
            marginBottom: 28, textAlign: 'center',
          }}>
            Nos valeurs
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {HISTOIRE.valeurs.map((v, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(201,151,60,0.12)',
                borderRadius: 16, padding: '28px 20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{v.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{v.titre}</div>
                <div style={{ fontSize: 13, opacity: 0.5, lineHeight: 1.6 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chiffres clés ── */}
        <div style={{
          background: 'rgba(201,151,60,0.05)',
          border: '1px solid rgba(201,151,60,0.15)',
          borderRadius: 20, padding: '40px 32px', marginBottom: 60,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-playfair)', fontSize: 20, color: 'var(--gold)',
            marginBottom: 28, textAlign: 'center',
          }}>
            Chez Maman Biya en chiffres
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
            {[
              { val: '12+', label: 'Années d\'expérience' },
              { val: '15', label: 'Employés du quartier' },
              { val: '50+', label: 'Plats à la carte' },
              { val: '2000+', label: 'Clients servis/mois' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-playfair)', fontSize: 36, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontFamily: 'var(--font-playfair)', color: 'var(--gold)', marginBottom: 20 }}>
            Venez goûter l'amour de Maman Biya 🍲
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/menu" className="cta-btn" style={{
              background: 'linear-gradient(135deg, var(--gold), #a85f28)',
              color: '#fff', textDecoration: 'none',
              padding: '14px 32px', borderRadius: 8,
              fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            }}>
              Voir le menu
            </Link>
            <Link href="/reservation" className="cta-btn" style={{
              background: 'transparent', border: '2px solid rgba(201,151,60,0.4)',
              color: 'var(--gold)', textDecoration: 'none',
              padding: '12px 30px', borderRadius: 8,
              fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            }}>
              Réserver
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
