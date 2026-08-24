import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Employee } from './useEmployees'

export interface Group {
  id: string
  name: string
  created_at: string
  company_id: string
}

export interface GroupWithMembers extends Group {
  member_count: number
  members: Employee[]
}

export function useGroups() {
  return useQuery<GroupWithMembers[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/api/v1/groups'),
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => api.post<Group>('/api/v1/groups', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put<Group>(`/api/v1/groups/${id}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useUpdateGroupMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, member_ids }: { id: string; member_ids: string[] }) =>
      api.put(`/api/v1/groups/${id}/members`, { member_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}
