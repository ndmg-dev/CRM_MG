import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@mg/ui'
import { supabase } from '../integrations/supabase/client'
import { Campo } from '../components/Campo'
import { classesInput } from '../lib/estilos'

/**
 * Entrada do portal, por magic link.
 *
 * Sem senha de propósito: menos superfície de ataque, nada de reset de senha
 * para o escritório operar, e o e-mail já é o canal de contato do cliente.
 *
 * A mensagem de confirmação é a MESMA para e-mail cadastrado e não cadastrado.
 * Dizer "e-mail não encontrado" transformaria a tela num verificador de quem é
 * cliente do escritório.
 */
export function Login() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const limpo = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) {
      setErro('Informe um e-mail válido.')
      return
    }
    setErro('')
    setEnviando(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: limpo,
      options: {
        // `shouldCreateUser: false` é o que impede o portal de virar cadastro
        // aberto: só quem já foi convidado recebe o link.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/obrigacoes/portal`,
      },
    })

    setEnviando(false)
    // Mesmo em caso de erro mostramos a confirmação, para não revelar quem
    // está cadastrado. Falha real fica no console para diagnóstico.
    if (error) console.warn('[portal] signInWithOtp:', error.message)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <Moldura>
        <div className="text-center">
          <Mail className="mx-auto h-10 w-10 text-gold" aria-hidden="true" />
          <h1 className="mt-4 text-xl text-text-primary">Verifique seu e-mail</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Se <span className="font-mono text-text-primary">{email.trim().toLowerCase()}</span>{' '}
            estiver cadastrado no portal, enviamos um link de acesso. Ele vale por 15 minutos
            e só pode ser usado uma vez.
          </p>
          <button
            onClick={() => { setEnviado(false); setEmail('') }}
            className="mt-6 text-sm text-gold hover:underline focus:outline-none focus:ring-2 focus:ring-gold-border"
          >
            Usar outro e-mail
          </button>
        </div>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <h1 className="text-xl text-text-primary">Portal do cliente</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Acompanhe suas obrigações e envie documentos.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <Campo label="E-mail" erro={erro} obrigatorio>
          {(p) => (
            <input
              {...p}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="voce@suaempresa.com.br"
              className={classesInput(erro)}
            />
          )}
        </Campo>

        <Button type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Enviando…' : 'Receber link de acesso'}
        </Button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-text-muted">
        O acesso é por link enviado ao seu e-mail — não há senha para criar ou lembrar.
      </p>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-text-muted">
          Mendonça Galvão
        </p>
        {children}
      </div>
    </div>
  )
}
