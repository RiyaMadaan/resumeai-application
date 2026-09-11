import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * ToolPage — the shell every focused screen shares.
 *
 * The resume tools, the creation flows and the cover letter screens all have
 * the same shape in the reference: a back link, a title, one line explaining
 * what the screen is for, then the work itself on a light ground. Putting that
 * here means the spacing, type scale and back-link treatment are defined once
 * instead of drifting page by page.
 */
export function ToolPage({
  back,
  title,
  description,
  /** Optional status or actions shown opposite the title. */
  aside,
  width = 'md',
  children,
}: {
  back?: { to: string; label: string }
  title: string
  description?: ReactNode
  aside?: ReactNode
  /** `md` suits a single form; `lg` a two-column or list layout. */
  width?: 'md' | 'lg' | 'xl'
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className={cn(
          'mx-auto w-full px-5 py-8 sm:px-6 sm:py-10',
          width === 'md' && 'max-w-3xl',
          width === 'lg' && 'max-w-5xl',
          width === 'xl' && 'max-w-7xl',
        )}
      >
        {back && (
          <button
            type="button"
            onClick={() => navigate(back.to)}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
          >
            <span aria-hidden>←</span> {back.label}
          </button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
            )}
          </div>
          {aside && <div className="flex-shrink-0">{aside}</div>}
        </div>

        <div className="mt-7">{children}</div>
      </div>
    </div>
  )
}

/**
 * Panel — the standard white surface.
 *
 * One border, one radius, one padding scale, so screens stop inventing their
 * own boxes. `flush` drops the padding for panels that manage their own.
 */
export function Panel({
  children,
  className,
  flush,
}: {
  children: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white',
        !flush && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A heading inside a Panel, with optional supporting line. */
export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

/**
 * PageHeader — the title block for the surfaces that sit beside the nav rail.
 * Same type scale as ToolPage so the two modes feel like one product.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
