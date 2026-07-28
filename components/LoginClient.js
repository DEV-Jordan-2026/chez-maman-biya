'use client'
// LoginClient.js — v12 LUXURY · Chez Maman Biya

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin'

  const [login, setLogin]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [focusLogin, setFocusLogin]   = useState(false)
  const [focusPwd, setFocusPwd]       = useState(false)

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!login || !password) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Identifiants incorrects'); setLoading(false); return }

      // Redirection sécurisée : on ignore le param `from` si ce n'est pas une route interne /admin/*
      // et on route selon le rôle retourné par l'API (staff → /admin, caissier → /admin, etc.)
      const safeFrom = (from && from.startsWith('/admin')) ? from : '/admin'
      window.location.href = safeFrom
    } catch {
      setError('Erreur de connexion. Réessayez.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ebony)',
      display: 'flex',
      color: 'var(--cream)',
      fontFamily: 'var(--font-dm)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes lineReveal { from{width:0} to{width:100%} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
        @keyframes shimmerBg {
          0%   { background-position: -200% 0 }
          100% { background-position:  200% 0 }
        }
        @keyframes auraPulse {
          0%,100% { opacity:.3; transform:scale(1) }
          50%     { opacity:.55; transform:scale(1.08) }
        }
        @keyframes gridMove {
          from { background-position: 0 0 }
          to   { background-position: 40px 40px }
        }
        .login-input {
          background: rgba(240,232,216,.04);
          border: 1px solid rgba(201,151,60,.18);
          border-radius: 10px;
          color: var(--cream);
          padding: 14px 16px;
          font-size: 15px;
          font-family: var(--font-dm);
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }
        .login-input:focus {
          border-color: var(--gold);
          background: rgba(240,232,216,.06);
          box-shadow: 0 0 0 3px rgba(201,151,60,.1);
        }
        .login-input::placeholder { opacity: .3; font-size: 14px; }
        .login-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #C9973C, #8B6820);
          color: var(--ebony);
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          font-family: var(--font-dm);
          transition: transform .2s, box-shadow .2s, filter .2s;
          position: relative;
          overflow: hidden;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(201,151,60,.4);
          filter: brightness(1.06);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled {
          background: linear-gradient(135deg, rgba(201,151,60,.3), rgba(139,104,32,.2));
          cursor: not-allowed;
          color: rgba(8,6,5,.5);
        }
        .login-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.12) 50%, transparent 100%);
          background-size: 200% 100%;
          opacity: 0;
          transition: opacity .2s;
        }
        .login-btn:hover::before { opacity: 1; animation: shimmerBg 1.2s linear; }
      `}</style>

      {/* ── Panneau gauche · Image ──────────────────────────────────── */}
      <div style={{
        flex: '1', display: 'flex', position: 'relative', overflow: 'hidden',
      }} className="login-left">
        <style>{`
          @media (max-width:860px) { .login-left { display:none!important } .login-right { width:100%!important } }
        `}</style>

        {/* Photo */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=90')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'brightness(.45) saturate(1.2)',
        }} />

        {/* Overlay gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(8,6,5,.6) 0%, rgba(201,151,60,.08) 100%)',
        }} />

        {/* Contenu */}
        <div style={{ position: 'relative', zIndex: 2, padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {/* Pattern kente décoratif */}
          <div style={{
            width: 48, height: 3, marginBottom: 24,
            background: 'linear-gradient(90deg, var(--gold), var(--terracotta), var(--forest))',
            borderRadius: 2,
          }} />

          <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 38, fontWeight: 300, color: '#fff', lineHeight: 1.2, marginBottom: 12, fontStyle: 'italic' }}>
            L'authenticité<br />du Cameroun<br />dans chaque assiette
          </div>
          <div style={{ fontSize: 13, color: 'rgba(240,232,216,.5)', letterSpacing: 1, maxWidth: 320, lineHeight: 1.7 }}>
            Depuis 2012, Maman Biya partage les saveurs de sa cuisine<br />
            traditionnelle avec passion et générosité.
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {['Bastos, Yaoundé', 'Ouvert 7j/7', '+12 ans d\'expérience'].map(b => (
              <div key={b} style={{
                padding: '6px 12px', borderRadius: 20,
                background: 'rgba(201,151,60,.15)',
                border: '1px solid rgba(201,151,60,.3)',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: 'rgba(240,232,216,.7)',
              }}>{b}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panneau droit · Formulaire ──────────────────────────────── */}
      <div className="login-right" style={{
        width: 460,
        flexShrink: 0,
        background: 'var(--ebony-1)',
        borderLeft: '1px solid var(--border-gold)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Grille décorative de fond */}
        <div style={{
          position: 'absolute', inset: 0, opacity: .025, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(201,151,60,.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,151,60,.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          animation: 'gridMove 12s linear infinite',
        }} />

        {/* Aura */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-20%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,151,60,.07) 0%, transparent 60%)',
          animation: 'auraPulse 5s ease infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-20%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,96,58,.05) 0%, transparent 60%)',
          animation: 'auraPulse 7s ease infinite',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 340 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 48, animation: 'fadeUp .7s ease both' }}>
            <div style={{
              display: 'inline-flex', width: 60, height: 60, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(201,151,60,.2), rgba(201,151,60,.06))',
              border: '1px solid rgba(201,151,60,.3)',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 26, marginBottom: 20,
              boxShadow: '0 8px 28px rgba(0,0,0,.3)',
            }}>🍲</div>

            {/* Ligne décorative */}
            <div style={{
              width: 40, height: 1, margin: '0 auto 20px',
              background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
            }} />

            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 24, fontWeight: 600, color: 'var(--gold)', letterSpacing: .5, marginBottom: 4 }}>
              Chez Maman Biya
            </div>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--cream-faint)' }}>
              Espace Administration
            </div>
          </div>

          {/* Formulaire */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp .7s .1s ease both', opacity: 0, animationFillMode: 'forwards' }}>

            {/* Login */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)', fontWeight: 600 }}>
                Identifiant
              </label>
              <input
                type="text" className="login-input"
                value={login} onChange={e => setLogin(e.target.value)}
                required autoComplete="username" autoCapitalize="none"
                placeholder="Votre identifiant"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--cream-faint)', fontWeight: 600 }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="login-input"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  placeholder="••••••••"
                  style={{ paddingRight: 48 }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  type="button" onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--cream-faint)',
                    cursor: 'pointer', padding: 4, lineHeight: 1,
                    transition: 'color .2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--cream-faint)'}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    {showPwd
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 10, padding: '12px 16px',
                color: '#FCA5A5', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'fadeUp .3s ease',
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="button" onClick={handleSubmit}
              className="login-btn"
              disabled={loading || !login || !password}
              style={{ marginTop: 4 }}
            >
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Connexion…
                  </span>
                : 'Accéder au tableau de bord'
              }
            </button>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 36, textAlign: 'center', fontSize: 10, color: 'var(--cream-faint)', letterSpacing: 1, lineHeight: 1.8 }}>
            Session sécurisée · Valide 8 heures
          </div>
          <div style={{ marginTop: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 9, color: 'rgba(240,232,216,.12)', letterSpacing: .5 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(201,151,60,.22)' }}>&lt;/&gt;</span>
            Jordan – full-Dev
          </div>

          {/* Pattern décoratif bas */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 4 }}>
            {['var(--gold)', 'var(--terracotta)', 'var(--forest)', 'var(--indigo)', 'var(--gold)'].map((c, i) => (
              <div key={i} style={{ width: i === 2 ? 20 : 8, height: 3, borderRadius: 2, background: c, opacity: .5 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginClient() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
