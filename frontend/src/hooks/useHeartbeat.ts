import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const HEARTBEAT_INTERVAL = 60_000 // 60 seconds

export function useHeartbeat() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    // Send initial heartbeat immediately
    api.sessoes.heartbeat().catch(() => {})

    // Set up recurring heartbeat
    intervalRef.current = setInterval(() => {
      api.sessoes.heartbeat().catch(() => {})
    }, HEARTBEAT_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isAuthenticated])
}
