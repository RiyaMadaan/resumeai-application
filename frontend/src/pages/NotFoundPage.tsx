import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { buttonClasses } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <Logo size={40} showWordmark={false} />
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-ink-muted">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/dashboard" className={buttonClasses({ size: 'lg', className: 'mt-8' })}>
        Back to resumes
      </Link>
      <Link to="/login" className="mt-4 text-sm font-medium text-brand-700 hover:underline">
        Sign in
      </Link>
    </div>
  )
}
