import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LoadingState } from '@/components/ui/LoadingState'

/**
 * ProtectedRoute — gate for authenticated app routes.
 * While the auth state initializes we show a loader; unauthenticated users are
 * redirected to /login (preserving where they were headed).
 */
export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return <LoadingState label="Loading your workspace…" fullscreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
