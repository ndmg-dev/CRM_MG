import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Permission } from './useAuth'

export interface EmployeeLink {
  employee_id: string
  company_user_id: string
  name: string
}

export function useEmployeeLinks() {
  return useQuery<EmployeeLink[]>({
    queryKey: ['company-users', 'employee-links'],
    queryFn: () => api.get('/api/v1/auth/users/employee-links'),
  })
}

export interface CreateUserFromEmployeePayload {
  employee_id: string
  password?: string
  permissions: Permission[]
}

export interface CreateUserFromEmployeeResult {
  user: {
    id: string
    name: string
    email: string
    role: string
    permissions: string[]
    is_active: boolean
  }
  generated_password: string | null
}

export function useCreateUserFromEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserFromEmployeePayload) =>
      api.post<CreateUserFromEmployeeResult>('/api/v1/auth/users/from-employee', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-users'] })
      qc.invalidateQueries({ queryKey: ['sectors'] })
    },
  })
}
