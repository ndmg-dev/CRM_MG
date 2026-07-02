import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/authStore'
import { Navigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import UsersTable from './UsersTable'
import AuditLogViewer from './AuditLogViewer'

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users')

  if (user?.perfil !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <PageHeader
        title="Painel de Administração"
        description="Gerencie usuários, permissões e consulte logs de auditoria"
      />

      <div className="mb-6 flex gap-1 rounded-lg bg-[#1a1a1a] p-1 w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-[#d4a843] text-black'
              : 'text-[#a0a0a0] hover:text-[#f5f5f5]'
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'audit'
              ? 'bg-[#d4a843] text-black'
              : 'text-[#a0a0a0] hover:text-[#f5f5f5]'
          }`}
        >
          Logs de Auditoria
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'users' ? <UsersTable /> : <AuditLogViewer />}
      </motion.div>
    </div>
  )
}
