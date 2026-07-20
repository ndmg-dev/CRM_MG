import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { Navigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { Tabs } from '@mg/ui'
import UsersTable from './UsersTable'
import AuditLogViewer from './AuditLogViewer'

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)

  if (user?.perfil !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <PageHeader
        title="Painel de Administração"
        description="Gerencie usuários, permissões e consulte logs de auditoria"
      />

      <Tabs
        items={[
          { value: 'users', label: 'Usuários', content: <UsersTable /> },
          { value: 'audit', label: 'Logs de Auditoria', content: <AuditLogViewer /> }
        ]}
      />
    </div>
  )
}
