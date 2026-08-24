import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/v1/settings'),
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, string | boolean | number>) =>
      api.put('/api/v1/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useGenerateKioskKey() {
  return useMutation({
    mutationFn: () => api.post<{ kiosk_api_key: string }>('/api/v1/settings/kiosk-key/generate', {}),
  })
}

export function useRevokeKioskKey() {
  return useMutation({
    mutationFn: () => api.delete('/api/v1/settings/kiosk-key'),
  })
}
