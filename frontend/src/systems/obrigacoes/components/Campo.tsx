import type { ReactNode } from 'react'
import { useId } from 'react'
import { classesInput } from '../lib/estilos'

/**
 * Campo de formulário com rótulo e erro ligados por id.
 *
 * O erro é anunciado por `aria-describedby` + `role="alert"`: sem isso, quem
 * usa leitor de tela só percebe a falha se navegar de volta ao campo.
 */
export function Campo({
  label,
  erro,
  dica,
  obrigatorio,
  children,
}: {
  label: string
  erro?: string
  dica?: string
  obrigatorio?: boolean
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}) {
  const id = useId()
  const idErro = `${id}-erro`
  const idDica = `${id}-dica`
  const descrito = [erro ? idErro : null, dica ? idDica : null].filter(Boolean).join(' ')

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-text-secondary">
        {label}
        {obrigatorio && <span className="ml-0.5 text-error" aria-hidden="true">*</span>}
      </label>

      {children({
        id,
        'aria-describedby': descrito || undefined,
        'aria-invalid': erro ? true : undefined,
      })}

      {dica && !erro && (
        <p id={idDica} className="text-xs text-text-muted">{dica}</p>
      )}
      {erro && (
        <p id={idErro} role="alert" className="text-xs text-error">{erro}</p>
      )}
    </div>
  )
}

export function SelectNativo({
  opcoes,
  vazio,
  erro,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  opcoes: { valor: string; rotulo: string }[]
  vazio?: string
  erro?: string
}) {
  return (
    <select {...props} className={classesInput(erro)}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>{o.rotulo}</option>
      ))}
    </select>
  )
}
