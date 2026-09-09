import { Outlet } from 'react-router-dom'
import { AppNavbar } from '@/components/layout/AppNavbar'

/**
 * AppLayout — shared shell for authenticated app pages: the AppNavbar plus the
 * routed page content. Rendered inside ProtectedRoute.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
