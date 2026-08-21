import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

/** Aparece uma vez por versão nova, pra cada usuário — some pra sempre depois
 * de marcado como lido (release_reads, uma linha por usuário+release). */
export function UpdateModal() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const { data: release } = useQuery({
    queryKey: ['latest-unread-release'],
    queryFn: () => api.releases.getLatestUnread(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.releases.marcarComoLida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-unread-release'] })
      queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
  })

  const handleClose = () => {
    if (release) markRead.mutate(release.id)
  }

  return (
    <AnimatePresence>
      {release && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-gold-border-soft bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-raised px-5 py-4">
              <h2 className="text-lg font-bold text-text-primary">
                Seu CRM foi atualizado — v{release.version} 🎉🎉
              </h2>
              <button
                onClick={handleClose}
                aria-label="Fechar"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[50vh] space-y-4 overflow-y-auto px-5 py-4">
              {release.notes.length === 0 ? (
                <p className="text-sm text-text-muted">Sem notas de mudança pra essa versão.</p>
              ) : (
                release.notes.map((note) => (
                  <div key={note.id}>
                    <p className="text-sm font-semibold text-gold">{note.systemName}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-text-secondary">{note.description}</p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border px-5 py-3">
              <button
                onClick={handleClose}
                disabled={markRead.isPending}
                className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Marcar como lido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
