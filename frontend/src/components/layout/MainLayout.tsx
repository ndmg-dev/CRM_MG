import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'
import { useUIStore } from '@/stores/uiStore'
import { useHeartbeat } from '@/hooks/useHeartbeat'

export default function MainLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const fullBleedSystem = useUIStore((s) => s.fullBleedSystem)
  useHeartbeat()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarOpen ? 256 : 72 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex-1"
      >
        {!fullBleedSystem && <Header />}
        <div className={fullBleedSystem ? '' : 'p-6'}>
          <Outlet />
        </div>
      </motion.main>
    </div>
  )
}
