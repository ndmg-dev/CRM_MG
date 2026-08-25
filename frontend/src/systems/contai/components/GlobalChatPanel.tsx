import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send } from 'react-feather'
import { useEmpresa } from '../context/EmpresaContext'

interface ChatMessage {
  id: number
  text: string
  side: 'user' | 'ai'
}

// Porta simplificada de app/web/static/js/chat_panel.js.
//
// SIMPLIFICAÇÃO DELIBERADA: o original chama /chat/history e /chat/send no
// backend Flask (histórico persistido por sessão + resposta de IA via
// OpenAI). Nenhum desses dois endpoints está entre os 7 endpoints JSON
// stateless portados para esta migração (ver contexto da tarefa) — então
// este painel não persiste histórico nem chama um backend de IA real.
// Ele mantém a mesma UI/UX (bolha de usuário à direita, borda dourada nas
// respostas, disparo por Enter) mas responde localmente com um aviso
// explicando a limitação, para não fingir uma integração que não existe.
//
// TODO: ContAI upload endpoints not yet stateless-JWT-clean, verify against
// ContAI_PRO before wiring in production — o mesmo vale pra /chat/*: quando
// esses endpoints forem portados para o padrão JSON+Bearer, plugar aqui.
export function GlobalChatPanel() {
  const { empresaNome } = useEmpresa()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      side: 'ai',
      text: empresaNome
        ? `Olá! Sou o ContAI, seu assistente contábil para ${empresaNome}. O chat com IA ainda não foi portado para a API JSON stateless — esta é uma prévia da interface.`
        : 'Selecione uma empresa para ativar o assistente contábil. O chat com IA ainda não foi portado para a API JSON stateless — esta é uma prévia da interface.',
    },
  ])
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight })
  }, [messages, open])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { id: prev.length, side: 'user', text },
      {
        id: prev.length + 1,
        side: 'ai',
        text: 'O envio de mensagens para a IA do ContAI ainda depende de um endpoint que não foi portado para o padrão JSON+Bearer (ver TODO no código).',
      },
    ])
    setInput('')
  }

  return (
    <>
      <button
        type="button"
        className="contai-chat-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fechar assistente ContAI' : 'Abrir assistente ContAI'}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="contai-chat-panel" role="dialog" aria-label="Assistente ContAI">
          <div className="contai-chat-header">
            <MessageCircle size={16} /> ContAI Assistente
          </div>
          <div className="contai-chat-messages" ref={messagesRef}>
            {messages.map((m) => (
              <div key={m.id} className={m.side === 'user' ? 'contai-chat-bubble-user' : 'contai-chat-bubble-ai'}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="contai-chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Pergunte ao ContAI..."
              aria-label="Mensagem para o ContAI"
            />
            <button type="button" onClick={send} aria-label="Enviar">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
