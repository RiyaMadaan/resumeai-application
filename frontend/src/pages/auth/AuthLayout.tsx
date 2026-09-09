import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'

/**
 * AuthLayout — centered card used by both Login and Register, with the brand
 * gradient backdrop so auth feels part of the same product.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-hero-radial">
      <div className="px-5 py-6 sm:px-8">
        <Link to="/" aria-label="ResumeAI home">
          <Logo />
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
        </div>
      </div>
    </div>
  )
}
