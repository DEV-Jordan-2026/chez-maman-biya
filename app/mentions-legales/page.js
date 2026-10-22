// @author TSJORDAN - Dev
// app/mentions-legales/page.js
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Mentions légales — Chez Maman Biya',
}

export default function MentionsLegalesPage() {
  return (
    <div style={{ background: '#0d0a07', minHeight: '100vh', color: '#f5efe6', fontFamily: 'var(--font-dm)' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '140px 24px 80px' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', opacity: .35, marginBottom: 12 }}>Légal</div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 32, color: '#c8783a', marginBottom: 40 }}>Mentions légales</h1>

        {[
          { titre: '1. Éditeur du site', contenu: 'Le site chezmamanbiya.cm est édité par le restaurant Chez Maman Biya, établissement situé au Quartier Bastos, Yaoundé, Cameroun.\nResponsable de publication : Maman Biya\nContact : contact@chezmamanbiya.cm · +237 691 78 33 41' },
          { titre: '2. Hébergement', contenu: 'Ce site est hébergé par Vercel Inc., 340 Pine Street, San Francisco, CA 94104, États-Unis.' },
          { titre: '3. Propriété intellectuelle', contenu: 'L\'ensemble des contenus de ce site (textes, images, logos) est la propriété exclusive de Chez Maman Biya. Toute reproduction sans autorisation écrite est interdite.' },
          { titre: '4. Responsabilité', contenu: 'Chez Maman Biya s\'efforce d\'assurer l\'exactitude des informations diffusées sur ce site. Toutefois, elle ne peut garantir l\'exhaustivité ni l\'exactitude des informations et décline toute responsabilité pour toute imprécision ou omission.' },
          { titre: '5. Contact', contenu: 'Pour toute question relative aux mentions légales, contactez-nous à contact@chezmamanbiya.cm.' },
        ].map(s => (
          <section key={s.titre} style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 17, color: '#c8783a', marginBottom: 10 }}>{s.titre}</h2>
            <p style={{ fontSize: 14, opacity: .6, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{s.contenu}</p>
          </section>
        ))}

        <Link href="/" style={{ color: '#c8783a', textDecoration: 'none', fontSize: 13 }}>← Retour à l'accueil</Link>
      </div>
      <Footer />
    </div>
  )
}
