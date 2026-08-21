import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Employee } from './useEmployees'

export interface Sector {
  id: string
  name: string
  color: string
  coordinator_id?:   string | null
  coordinator_name?: string | null
  assistant_id?:     string | null
  assistant_name?:   string | null
  break_enabled?: boolean
  break_paid?:    boolean
  break_minutes?: number
  created_at: string
  company_id: string
}

export interface SectorWithMembers extends Sector {
  member_count: number
  members: Employee[]
}

export function useSectors() {
  return useQuery<SectorWithMembers[]>({
    queryKey: ['sectors'],
    queryFn: () => api.get('/api/v1/sectors'),
  })
}

export interface SectorPayload {
  name: string
  color: string
  coordinator_id?: string | null
  assistant_id?:   string | null
  break_enabled?: boolean
  break_paid?:    boolean
  break_minutes?: number
}

export function useCreateSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SectorPayload) => api.post<Sector>('/api/v1/sectors', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors'] }),
  })
}

export function useUpdateSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: SectorPayload & { id: string }) =>
      api.put<Sector>(`/api/v1/sectors/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sectors'] }),
  })
}

export function useDeleteSector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/sectors/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sectors'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateSectorMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, member_ids }: { id: string; member_ids: string[] }) =>
      api.put(`/api/v1/sectors/${id}/members`, { member_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sectors'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
