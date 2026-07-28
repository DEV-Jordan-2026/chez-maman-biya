'use client'
// @author TSJORDAN - Dev
// app/cuisine/offline/page.js
// Page affichée par le Service Worker quand le réseau est indisponible

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#080605', color: '#f0e8d8',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', gap: 24, padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 72 }}>📵</div>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#c9973c' }}>
          Connexion perdue
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(240,232,216,.6)', maxWidth: 320, margin: '0 auto' }}>
          L'interface cuisine nécessite une connexion réseau.
          Vérifiez le Wi-Fi de la tablette et rechargez la page.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'linear-gradient(135deg,#c9973c,#a85f28)',
          border: 'none', borderRadius: 12,
          padding: '14px 32px', fontSize: 15, fontWeight: 700, color: '#fff',
          cursor: 'pointer', letterSpacing: .5,
        }}
      >
        🔄 Réessayer
      </button>
    </div>
  )
}
