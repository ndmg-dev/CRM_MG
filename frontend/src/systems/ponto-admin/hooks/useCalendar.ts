import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Holiday {
  id: string
  name: string
  date: string
  holiday_type: string
  recurrent: boolean
  company_id: string
}

export interface SpecialSchedule {
  id: string
  description: string
  schedule_type: string
  date?: string
  weekday?: number
  start_time: string
  end_time: string
  recurrent: boolean
  work_hours: number
  company_id: string
}

export function useHolidays(year?: number) {
  const qs = year ? `?year=${year}` : ''
  return useQuery<Holiday[]>({
    queryKey: ['calendar-holidays', year],
    queryFn: () => api.get(`/api/v1/calendar/holidays${qs}`),
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; date: string; holiday_type: string; recurrent: boolean }) =>
      api.post('/api/v1/calendar/holidays', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-holidays'] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/calendar/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-holidays'] }),
  })
}

export function useSpecialSchedules() {
  return useQuery<SpecialSchedule[]>({
    queryKey: ['calendar-schedules'],
    queryFn: () => api.get('/api/v1/calendar/schedules'),
  })
}

export function useCreateSpecialSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<SpecialSchedule>) => api.post('/api/v1/calendar/schedules', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-schedules'] }),
  })
}

export function useDeleteSpecialSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/calendar/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-schedules'] }),
  })
}
