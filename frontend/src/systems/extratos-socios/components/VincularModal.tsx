import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Search, Link as LinkIcon, Loader2, Building2 } from 'lucide-react'
import { extratosApi } from '../lib/api'
import { fmtCNPJ } from '../lib/format'
import type { ClientePick } from '../lib/types'

interface Props {
  cnpj: string // CNPJ do extrato órfão (só dígitos ou formatado)
  onClose: () => void
  onDone: (vinculados: number) => void
}

export function VincularModal({ cnpj, onClose, onDone }: Props) {
  const [busca, setBusca] = useState('')
  const qc = useQueryClient()

  const { data: clientes, isFetching } = useQuery({
    queryKey: ['extratos', 'clientes', busca],
    queryFn: () => extratosApi.clientes(busca),
    enabled: busca.trim().length >= 2,
    retry: 1,
  })

  const vincular = useMutation({
    mutationFn: (clientId: string) => extratosApi.vincular(cnpj, clientId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['extratos'] })
      onDone(res.vinculados)
    },
  })

  return (
    <div className="ex-modal-overlay" onClick={onClose}>
      <div className="ex-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ex-modal-head">
          <div>
            <h3>Vincular extrato a um cliente</h3>
            <p className="ex-mono">{fmtCNPJ(cnpj)}</p>
          </div>
          <button type="button" className="ex-modal-x" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="ex-modal-search">
          <Search size={15} />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por razão social ou CNPJ…"
            aria-label="Buscar cliente"
          />
        </div>

        <div className="ex-modal-list">
          {busca.trim().length < 2 ? (
            <div className="ex-modal-hint">Digite ao menos 2 caracteres para buscar.</div>
          ) : isFetching ? (
            <div className="ex-modal-hint">
              <Loader2 size={16} className="ex-spin" /> Buscando…
            </div>
          ) : !clientes || clientes.length === 0 ? (
            <div className="ex-modal-hint">Nenhum cliente encontrado.</div>
          ) : (
            clientes.map((c: ClientePick) => (
              <button
                key={c.id}
                type="button"
                className="ex-modal-item"
                disabled={vincular.isPending}
                onClick={() => vincular.mutate(c.id)}
              >
                <span className="ex-modal-item-chip">
                  <Building2 size={15} />
                </span>
                <span className="ex-modal-item-id">
                  <span className="ex-modal-item-nome">{c.razao_social}</span>
                  <span className="ex-modal-item-cnpj ex-mono">{fmtCNPJ(c.cnpj)}</span>
                </span>
                <span className="ex-modal-item-action">
                  <LinkIcon size={14} /> Vincular
                </span>
              </button>
            ))
          )}
        </div>

        {vincular.isError && <div className="ex-modal-err">Não foi possível vincular. Tente novamente.</div>}
        <div className="ex-modal-foot">
          O vínculo é permanente e sobrevive a reenvios do n8n. Reprocessa os extratos deste CNPJ.
        </div>
      </div>
    </div>
  )
}
