import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { Bot, Plus, Send, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'
import { chatStream } from '../lib/api'
import type { ChatMessage, ChatSession } from '../lib/types'

// Port de chat/chat.html + app/routes/chat.py + app/static/js/chat.js. A
// diferença de arquitetura pro original: lá o Flask salvava as mensagens
// (save_message) e só depois streamava a resposta do n8n. Aqui quem grava
// em chat_messages é o próprio navegador via RLS (chat_sessions_own /
// chat_messages_own — 100% privado, nem admin acessa), e o proxy FastAPI
// (/ouvidoria-proxy/chat/stream) só repassa o SSE do webhook n8n, sem
// tocar no Supabase. Efeito "digitando" de verdade (token a token), não
// só os 3 pontinhos do original.
export default function Chat() {
  const { data: profile } = useOuvidoriaProfile()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: sessions } = useQuery({
    queryKey: ['ouvidoria-chat-sessions', profile?.id],
    queryFn: async (): Promise<ChatSession[]> => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as ChatSession[]
    },
    enabled: !!profile?.id,
  })

  // Sessão ativa ao carregar: a mais recente com is_active=true, ou cria
  // uma nova — mesmo comportamento de get_or_create_session() original.
  useEffect(() => {
    if (!profile?.id || sessionId || !sessions) return
    const active = sessions.find((s) => s.is_active)
    if (active) {
      setSessionId(active.id)
      return
    }
    ;(async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: profile.id, session_title: 'Nova Conversa', is_active: true })
        .select()
        .single()
      if (!error && data) {
        setSessionId(data.id)
        queryClient.invalidateQueries({ queryKey: ['ouvidoria-chat-sessions', profile.id] })
      }
    })()
  }, [profile?.id, sessions, sessionId, queryClient])

  const { data: messages } = useQuery({
    queryKey: ['ouvidoria-chat-messages', sessionId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId!)
        .order('created_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return data as ChatMessage[]
    },
    enabled: !!sessionId,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function handleNewSession() {
    if (!profile?.id) return
    await supabase.from('chat_sessions').update({ is_active: false }).eq('user_id', profile.id).eq('is_active', true)
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: profile.id, session_title: 'Nova Conversa', is_active: true })
      .select()
      .single()
    if (!error && data) {
      setSessionId(data.id)
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-chat-sessions', profile.id] })
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-chat-messages', data.id] })
    }
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isSending || !sessionId || !profile) return

    setChatError('')
    setInput('')
    setIsSending(true)

    // Grava a mensagem do usuário imediatamente (aparece na UI via
    // invalidate, sem precisar de estado otimista separado).
    await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: profile.id, role: 'user', content: text })
    queryClient.invalidateQueries({ queryKey: ['ouvidoria-chat-messages', sessionId] })

    setStreamingText('')
    let full = ''

    try {
      await chatStream(
        { session_id: sessionId, message: text, user: { id: profile.id, name: profile.full_name, email: profile.email } },
        (event) => {
          if ('token' in event) {
            full += event.token
            setStreamingText(full)
          } else if ('error' in event) {
            setChatError(event.error)
          }
        },
      )

      if (full) {
        await supabase.from('chat_messages').insert({ session_id: sessionId, user_id: profile.id, role: 'assistant', content: full })
        queryClient.invalidateQueries({ queryKey: ['ouvidoria-chat-messages', sessionId] })
      } else if (!chatError) {
        setChatError('O assistente não retornou nenhuma resposta.')
      }
    } catch {
      setChatError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setStreamingText(null)
      setIsSending(false)
    }
  }

  const firstName = (profile?.full_name || '').split(' ')[0]
  const userInitial = (profile?.full_name || 'U').slice(0, 1).toUpperCase()

  return (
    <div className="chat-layout" style={{ margin: '-2rem', height: 'calc(100vh - var(--topbar-height) - 52px)' }}>
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <button type="button" className="btn btn-primary btn-block btn-sm" onClick={handleNewSession}>
            <Plus /> Nova Conversa
          </button>
        </div>
        <div className="chat-sidebar-list">
          {sessions && sessions.length > 0 ? (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`chat-session-item${s.id === sessionId ? ' active' : ''}`}
                onClick={() => setSessionId(s.id)}
              >
                <div className="chat-session-title">{s.session_title || 'Conversa'}</div>
                <div className="chat-session-date">{s.created_at?.slice(0, 10)}</div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
              Nenhuma conversa ainda
            </div>
          )}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-info">
            <h3>Assistente de RH</h3>
            <p>Consulte políticas internas, orientações e dúvidas</p>
          </div>
        </div>

        <div className="chat-messages">
          {messages && messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className="chat-message-avatar">
                  {msg.role === 'user' ? userInitial : <Bot style={{ width: 20, height: 20 }} />}
                </div>
                <div>
                  <div className={`chat-message-bubble chat-bubble-${msg.role}`}>
                    {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                  </div>
                  <div className="chat-message-time">{msg.created_at?.slice(11, 16)}</div>
                </div>
              </div>
            ))
          ) : streamingText === null ? (
            <div className="chat-welcome">
              <div>
                <div className="chat-welcome-icon" style={{ color: 'var(--accent-gold)' }}><Bot style={{ width: 48, height: 48, strokeWidth: 1.5 }} /></div>
                <h3>Olá, {firstName}!</h3>
                <p>Sou o assistente virtual da Ouvidoria. Posso ajudar com dúvidas sobre políticas internas, benefícios, normas e orientações do RH.</p>
              </div>
            </div>
          ) : null}

          {streamingText !== null && (
            <div className="chat-message assistant">
              <div className="chat-message-avatar"><Bot style={{ width: 20, height: 20 }} /></div>
              <div>
                <div className="chat-message-bubble" style={{ display: 'flex', gap: 5, padding: streamingText ? undefined : '0.85rem 1.15rem' }}>
                  {streamingText ? (
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  ) : (
                    <>
                      <div className="chat-typing-dot" />
                      <div className="chat-typing-dot" />
                      <div className="chat-typing-dot" />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {chatError && (
            <div className="chat-error">
              <span><AlertTriangle style={{ width: 14, height: 14, marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} /> {chatError}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <form className="chat-input-wrapper" onSubmit={handleSend}>
            <textarea
              className="chat-input"
              placeholder="Digite sua dúvida..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button type="submit" className="chat-send-btn" aria-label="Enviar mensagem" disabled={isSending || !input.trim()}>
              <Send style={{ width: 18, height: 18 }} />
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
              O assistente utiliza IA para responder — as respostas podem conter imprecisões
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
