import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface RegistrationLink {
  id: string
  token: string
  expires_at: string
  max_uses: number | null
  used_count: number
  is_active: boolean
  created_at: string
}

export interface PendingRegistration {
  id: string
  name: string
  email: string
  phone?: string | null
  has_face: boolean
  submitted_at: string
}

export function useRegistrationLinks() {
  return useQuery<RegistrationLink[]>({
    queryKey: ['registration', 'links'],
    queryFn: () => api.get('/api/v1/registration/links'),
  })
}

export function useCreateRegistrationLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { duration_minutes: number; max_uses: number | null }) =>
      api.post<RegistrationLink>('/api/v1/registration/links', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registration', 'links'] }),
  })
}

export function useRevokeRegistrationLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/registration/links/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registration', 'links'] }),
  })
}

export function usePendingRegistrations() {
  return useQuery<PendingRegistration[]>({
    queryKey: ['registration', 'pending'],
    queryFn: () => api.get('/api/v1/registration/pending'),
    refetchInterval: 30_000,
  })
}

export function useApproveRegistration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string
      phone?: string
      position?: string
      role: string
      is_external: boolean
      weekly_hours: number
      sector_id?: string
    }) => api.post(`/api/v1/registration/pending/${id}/approve`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registration', 'pending'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useRejectRegistration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/registration/pending/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registration', 'pending'] }),
  })
}
