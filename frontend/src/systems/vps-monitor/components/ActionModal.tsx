import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { vpsApi } from '../lib/api'
import type { ActionCatalogItem } from '../lib/types'

interface Props {
  action: ActionCatalogItem
  backupId?: number
  onClose: () => void
}

// Modal de confirmação digitada pras ações de nível-VPS (restart/recreate/…).
// O backend já exige perfil ADMIN + a palavra exata; aqui a UI só espelha isso.
export function ActionModal({ action, backupId, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const qc = useQueryClient()

  const run = useMutation({
    mutationFn: () =>
      vpsApi.runAction(action.key, {
        confirm: typed.trim(),
        ...(action.needsBackupId && backupId ? { backup_id: backupId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vps'] })
    },
  })

  const matches = typed.trim().toUpperCase() === action.confirm

  return createPortal(
    <div className="vm-modal-backdrop" onClick={run.isPending ? undefined : onClose}>
      <div className="vps-monitor-root" onClick={(e) => e.stopPropagation()}>
        <div className="vm-modal">
          <h3>
            <AlertTriangle size={18} color="var(--vm-bad)" /> {action.label}
          </h3>
          <div className="warn-box">{action.descricao}</div>

          {run.isSuccess ? (
            <>
              <div className="result-ok">{run.data.message}</div>
              <div className="vm-modal-actions">
                <button className="vm-btn" onClick={onClose}>Fechar</button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="vm-confirm">
                Digite <b>{action.confirm}</b> para confirmar:
              </label>
              <input
                id="vm-confirm"
                type="text"
                autoComplete="off"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={run.isPending}
              />
              {run.error && <div className="result-err">{(run.error as Error).message}</div>}
              <div className="vm-modal-actions">
                <button className="vm-btn" onClick={onClose} disabled={run.isPending}>
                  Cancelar
                </button>
                <button
                  className="vm-btn danger"
                  disabled={!matches || run.isPending}
                  onClick={() => run.mutate()}
                >
                  {run.isPending ? 'Enviando…' : 'Executar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
