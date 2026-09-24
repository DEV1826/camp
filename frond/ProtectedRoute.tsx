import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from './auth.store'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { accessToken, user, fetchMe } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      if (!accessToken) {
        if (isMounted) setIsChecking(false)
        return
      }

      await fetchMe()
      if (isMounted) setIsChecking(false)
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [accessToken, fetchMe])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-sage/20 border-t-sage animate-spin" />
          <p className="text-sm text-ink-3">Vérification de la session...</p>
        </div>
      </div>
    )
  }

  if (!accessToken || !user) return <Navigate to="/login" replace />

  return <>{children}</>
}

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore(s => s.user)
  return user?.role === 'SUPER_ADMIN' ? <>{children}</> : <Navigate to="/" replace />
}
