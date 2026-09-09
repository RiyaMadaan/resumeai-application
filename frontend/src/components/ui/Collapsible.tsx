import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CollapsibleProps {
  /** The section name, e.g. "Experience". */
  title: string
  /**
   * A compact summary shown beside the title while collapsed — "3 positions",
   * or the entry's own headline. Keeps a long form scannable.
   */
  summary?: ReactNode
  /** Optional status pill on the right (e.g. "Updated"). */
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  /** Visual weight: `section` for form sections, `row` for list entries. */
  variant?: 'section' | 'row'
}

/** Chevron that rotates with the open state. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * Collapsible — an accessible disclosure section.
 *
 * Uses a real button with `aria-expanded`/`aria-controls` rather than a
 * `<details>` element, so the open state can be driven from outside and the
 * header can carry a summary and a badge.
 */
export function Collapsible({
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
  className,
  variant = 'section',
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  const isRow = variant === 'row'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white',
        isRow ? 'border-slate-200' : 'border-slate-200',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 text-left transition-colors hover:bg-slate-50/80',
          isRow ? 'px-4 py-3' : 'px-4 py-3.5',
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate font-semibold text-ink',
              isRow ? 'text-sm' : 'text-sm',
            )}
          >
            {title}
          </span>
          {summary && (
            <span className="mt-0.5 block truncate text-xs text-ink-subtle">{summary}</span>
          )}
        </span>
        {badge}
        <Chevron open={open} />
      </button>

      {open && (
        <div id={panelId} className={cn('border-t border-slate-100', isRow ? 'p-4' : 'p-4')}>
          {children}
        </div>
      )}
    </div>
  )
}
