// @author TSJORDAN - Dev
// app/confidentialite/page.js
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Politique de confidentialité — Chez Maman Biya',
}

export default function ConfidentialitePage() {
  return (
    <div style={{ background: '#0d0a07', minHeight: '100vh', color: '#f5efe6', fontFamily: 'var(--font-dm)' }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '140px 24px 80px' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', opacity: .35, marginBottom: 12 }}>Légal</div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 32, color: '#c8783a', marginBottom: 40 }}>Politique de confidentialité</h1>

        {[
          { titre: '1. Données collectées', contenu: 'Lors de vos commandes et réservations, nous collectons :\n• Votre prénom et numéro de téléphone\n• Votre adresse de livraison (si applicable)\n• L\'historique de vos commandes\n\nNous ne collectons aucune donnée de carte bancaire — les paiements Mobile Money sont traités par CinetPay.' },
          { titre: '2. Utilisation des données', contenu: 'Vos données sont utilisées exclusivement pour :\n• Traiter et livrer votre commande\n• Vous envoyer une confirmation WhatsApp\n• Améliorer nos services\n\nNous ne revendons jamais vos données à des tiers.' },
          { titre: '3. Conservation', contenu: 'Vos données de commande sont conservées 3 ans à compter de la dernière transaction, conformément aux obligations comptables.' },
          { titre: '4. Vos droits', contenu: 'Vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à contact@chezmamanbiya.cm.' },
          { titre: '5. Cookies', contenu: 'Ce site utilise uniquement des cookies techniques strictement nécessaires au fonctionnement du service (session d\'authentification). Aucun cookie publicitaire ou de tracking n\'est utilisé.' },
          { titre: '6. Contact DPO', contenu: 'Pour toute question relative à la confidentialité de vos données : contact@chezmamanbiya.cm · +237 691 78 33 41' },
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
