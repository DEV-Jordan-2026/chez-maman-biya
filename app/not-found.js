// app/not-found.js — Page 404 personnalisée
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ebony)', color: '#f5efe6',
      fontFamily: 'var(--font-dm)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: 24,
    }}>
      <div>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🍽️</div>
        <div style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 80, fontWeight: 900, color: 'var(--gold)',
          lineHeight: 1, marginBottom: 8,
        }}>
          404
        </div>
        <h1 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 24, fontWeight: 600,
          marginBottom: 12,
        }}>
          Oups ! Ce plat n&apos;est pas au menu
        </h1>
        <p style={{ fontSize: 15, opacity: 0.5, maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.7 }}>
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
          Mais ne vous inquiétez pas, notre cuisine est toujours ouverte !
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{
            background: 'linear-gradient(135deg, var(--gold), #a85f28)',
            color: '#fff', textDecoration: 'none',
            padding: '14px 32px', borderRadius: 8,
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}>
            Retour à l'accueil
          </Link>
          <Link href="/menu" style={{
            background: 'transparent', color: 'var(--gold)',
            border: '2px solid rgba(201,151,60,0.4)',
            padding: '12px 30px', borderRadius: 8, textDecoration: 'none',
            fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}>
            Voir le menu
          </Link>
        </div>
      </div>
    </div>
  )
}
