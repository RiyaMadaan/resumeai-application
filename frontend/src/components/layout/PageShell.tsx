import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * PageShell — the one page container.
 *
 * Every page inside the application rail renders through this, so horizontal
 * padding, vertical rhythm and the title block are defined once. Pages had
 * been choosing their own: four different vertical paddings and five different
 * maximum widths were in use, which is why the product felt misaligned moving
 * between screens even after the navigation was unified.
 *
 * The width is a deliberate choice per page, not a free value — see `Width`.
 * Whichever is chosen, the container is left-aligned, so the left edge is
 * identical on every page and only the right edge moves.
 */

/**
 * How much horizontal room a page gets.
 *
 * - `narrow` — a single column of form fields. Wider than this and labels
 *   drift too far from their inputs.
 * - `default` — the standard page: lists, dashboards, most tools.
 * - `wide` — pages whose content *is* the width, like the template gallery,
 *   where a reading column would shrink the thumbnails that are the point.
 */
type Width = 'narrow' | 'default' | 'wide'

const WIDTHS: Record<Width, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-container',
  wide: 'max-w-[1600px]',
}

/**
 * The spacing scale, named so pages stop inventing margins.
 *
 * `PAGE_X` matches the rail's own gutter, so content lines up with the
 * navigation beside it rather than sitting at a slightly different inset.
 */
const PAGE_X = 'px-5 sm:px-6 lg:px-8'
const PAGE_Y = 'py-8 lg:py-10'

export function PageShell({
  back,
  title,
  description,
  /** Actions or status shown opposite the title. */
  actions,
  width = 'default',
  className,
  children,
}: {
  back?: { to: string; label: string }
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  width?: Width
  className?: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const hasHeader = !!(title || description || actions)

  return (
    // Left-aligned, not centred. `mx-auto` centres the box inside the content
    // area, so each width produced a different left edge — a narrow page began
    // ~200px right of a wide one, and the page's own back link, title and cards
    // inherited that offset. Aligning left means every page starts at the same
    // x after the rail and only the right edge varies with the width.
    <div className={cn('w-full', WIDTHS[width], PAGE_X, PAGE_Y, className)}>
      {back && (
        <button
          type="button"
          onClick={() => navigate(back.to)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
        >
          <span aria-hidden>←</span> {back.label}
        </button>
      )}

      {hasHeader && (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
            )}
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div>}
        </header>
      )}

      {/* One step between the header and the page's content, everywhere. */}
      <div className={hasHeader ? 'mt-7' : undefined}>{children}</div>
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
      className={cn('rounded-xl border border-slate-200 bg-white', !flush && 'p-5', className)}
    >
      {children}
    </div>
  )
}

/** A heading inside a Panel, with an optional supporting line. */
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
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
