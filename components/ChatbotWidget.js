'use client'
// components/ChatbotWidget.js
// Chatbot IA propulsé par Claude (Anthropic)
// Assistant virtuel de Maman Biya — répond en français

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Prompt système géré dynamiquement par /api/chatbot (menu depuis la BDD)
const SUGGESTIONS = [
  'Quels sont vos plats populaires ?',
  'Comment commander en livraison ?',
  'Quelles sont vos horaires ?',
  'Comment réserver une table ?',
]

// Pages où les bulles flottantes (WhatsApp + Chatbot) gênent une action
// principale déjà présente en bas d'écran (panier, encaissement, cuisine…)
const PAGES_SANS_BULLES = ['/admin', '/cuisine', '/commande', '/table']

export default function ChatbotWidget() {
  const pathname = usePathname()
  const masque = PAGES_SANS_BULLES.some(p => pathname?.startsWith(p))

  const [ouvert, setOuvert] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Bonsoir ! Je suis l\'assistante de Chez Maman Biya 🍽️ Comment puis-je vous aider aujourd\'hui ?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestionsVues, setSuggestionsVues] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (ouvert) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [ouvert, messages])

  async function envoyer(texte) {
    const msg = texte || input.trim()
    if (!msg || loading) return
    setInput('')
    setSuggestionsVues(true)

    const nouveauxMessages = [...messages, { role: 'user', content: msg }]
    setMessages(nouveauxMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nouveauxMessages }),
      })
      const data = await res.json()
      if (data.reponse) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reponse }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolée, je rencontre un problème technique. Appelez-nous au +237 677 000 000 🙏',
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      envoyer()
    }
  }

  const bubbleStyle = (role) => ({
    maxWidth: '82%',
    padding: '10px 14px',
    borderRadius: role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    fontSize: 13,
    lineHeight: 1.55,
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user'
      ? 'linear-gradient(135deg, var(--gold), #a85f28)'
      : 'rgba(255,255,255,0.07)',
    color: 'var(--cream)',
    border: role === 'assistant' ? '1px solid rgba(201,151,60,0.15)' : 'none',
    wordBreak: 'break-word',
  })

  if (masque) return null

  return (
    <>
      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setOuvert(o => !o)}
        aria-label="Ouvrir le chatbot"
        style={{
          position: 'fixed', bottom: 20, right: 16, zIndex: 999,
          width: 54, height: 54, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold), #a85f28)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(201,151,60,0.45)',
          fontSize: 22,
          transition: 'transform 0.2s',
        }}
      >
        {ouvert ? '✕' : '🤖'}
      </button>

      {/* ── Fenêtre chat ── */}
      {ouvert && (
        <div style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 998,
          width: 'min(340px, calc(100vw - 32px))',
          height: 'min(480px, calc(100vh - 120px))',
          background: 'rgba(13,10,7,0.97)',
          border: '1px solid rgba(201,151,60,0.25)',
          borderRadius: 18,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(201,151,60,0.1)',
            borderBottom: '1px solid rgba(201,151,60,0.15)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--gold), #a85f28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>🤖</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>Assistante Biya</div>
              <div style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                En ligne · propulsée par IA
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((m, i) => (
              <div key={i} style={bubbleStyle(m.role)}>
                {m.content}
              </div>
            ))}

            {/* Suggestions initiales */}
            {!suggestionsVues && messages.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => envoyer(s)} style={{
                    background: 'rgba(201,151,60,0.08)',
                    border: '1px solid rgba(201,151,60,0.2)',
                    borderRadius: 12, padding: '8px 12px',
                    color: 'rgba(245,239,230,0.7)', fontSize: 12,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}>{s}</button>
                ))}
              </div>
            )}

            {/* Indicateur de frappe */}
            {loading && (
              <div style={{ ...bubbleStyle('assistant'), padding: '12px 16px' }}>
                <span style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--gold)', display: 'inline-block',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(201,151,60,0.12)',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Écrivez votre message…"
              rows={1}
              style={{
                flex: 1, resize: 'none', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(201,151,60,0.2)', borderRadius: 10,
                color: 'var(--cream)', padding: '8px 12px', fontSize: 13,
                outline: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                maxHeight: 80, overflowY: 'auto',
              }}
            />
            <button
              onClick={() => envoyer()}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, var(--gold), #a85f28)'
                  : 'rgba(201,151,60,0.1)',
                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                color: 'var(--cream)', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >➤</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  )
}
