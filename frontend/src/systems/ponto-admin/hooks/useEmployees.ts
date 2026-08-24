import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Employee {
  id: string
  name: string
  email: string
  phone?: string
  position?: string
  is_external: boolean
  weekly_hours: number
  role: string
  admission_date?: string | null
  work_start_time?: string
  work_end_time?: string
  lunch_start_time?: string
  lunch_end_time?: string
  is_active: boolean
  face_photos_count: number
  created_at: string
  company_id: string
  sector_id?: string | null
}

export interface ScheduleDay {
  day_of_week: number
  is_active: boolean
  start_time: string
  work_hours: number
  lunch_minutes: number
}

export function useSchedule(employeeId: string | null) {
  return useQuery<ScheduleDay[]>({
    queryKey: ['schedule', employeeId],
    queryFn: () => api.get(`/api/v1/employees/${employeeId}/schedule`),
    enabled: !!employeeId,
  })
}

export function useSaveSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: ScheduleDay[] }) =>
      api.put(`/api/v1/employees/${id}/schedule`, days),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['schedule', id] }),
  })
}

export function useBulkCreateEmployees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; phone?: string; position?: string; role?: string }[]) =>
      api.post('/api/v1/employees/bulk', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/api/v1/employees'),
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Employee, 'id' | 'is_active' | 'face_photos_count' | 'created_at' | 'company_id'>) =>
      api.post<Employee>('/api/v1/employees', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Employee> & { id: string }) =>
      api.put<Employee>(`/api/v1/employees/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useRegisterFace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, images_base64 }: { id: string; images_base64: string[] }) =>
      api.post(`/api/v1/employees/${id}/face`, { images_base64 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}
