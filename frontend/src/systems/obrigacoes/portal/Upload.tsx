import { useRef, useState } from 'react'
import { CheckCircle2, Upload as UploadIcon } from 'lucide-react'
import { Button } from '@mg/ui'
import { ACCEPT, formatarTamanho, validarArquivo } from '../lib/arquivo'
import { useEnviarDocumento } from './usePortal'

/**
 * Envio de documento pelo cliente.
 *
 * O arquivo é validado pelo CONTEÚDO antes de sair do navegador (ver
 * lib/arquivo.ts): `file.type` é derivado da extensão e um `.exe` renomeado
 * para `.pdf` se anunciaria como PDF.
 */
export function Upload({
  acessoId,
  entregaId,
  rotulo = 'Enviar documento',
}: {
  acessoId: string
  entregaId: string | null
  rotulo?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erroLocal, setErroLocal] = useState('')
  const [concluido, setConcluido] = useState(false)
  const enviar = useEnviarDocumento()

  const escolher = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = ev.target.files?.[0]
    // Limpa o input para permitir reenviar o mesmo arquivo depois de um erro.
    ev.target.value = ''
    if (!arquivo) return

    setErroLocal('')
    setConcluido(false)

    const validacao = await validarArquivo(arquivo)
    if (!validacao.ok) {
      setErroLocal(validacao.erro!)
      return
    }

    try {
      await enviar.mutateAsync({ arquivo, entregaId, acessoId })
      setConcluido(true)
    } catch {
      // A mensagem vem da mutation, exibida abaixo.
    }
  }

  const falha = erroLocal || (enviar.error ? (enviar.error as Error).message : '')

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={escolher}
        className="sr-only"
        aria-label={rotulo}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={enviar.isPending}
      >
        {concluido && !enviar.isPending ? (
          <>
            <CheckCircle2 className="mr-1.5 h-4 w-4 text-success" aria-hidden="true" />
            Enviado
          </>
        ) : (
          <>
            <UploadIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {enviar.isPending ? 'Enviando…' : rotulo}
          </>
        )}
      </Button>

      {falha && (
        <p role="alert" className="max-w-xs text-xs text-error">{falha}</p>
      )}

      {!falha && !concluido && (
        <p className="text-xs text-text-muted">
          PDF, XML, JPEG, PNG ou XLSX · até {formatarTamanho(20 * 1024 * 1024)}
        </p>
      )}
    </div>
  )
}
