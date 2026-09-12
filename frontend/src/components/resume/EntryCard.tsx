import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Menu, MenuItem } from '@/components/ui/Menu'

/**
 * EntryCard — one item in a repeatable resume section.
 *
 * Collapsed, it reads as a record: what the role was, where, and when. That is
 * how someone scans a work history, and it means a section with six jobs is
 * six short cards rather than six identical form headers.
 *
 * Opened, the same card holds the fields. Editing happens in place, so nothing
 * navigates and no dialog covers the preview the user is editing against.
 *
 * Every repeatable section — experience, education, projects — uses this, so
 * they cannot drift into three slightly different patterns.
 */
export function EntryCard({
  title,
  subtitle,
  meta,
  removeLabel,
  onRemove,
  defaultOpen,
  children,
}: {
  /** The entry's headline, e.g. the job title. */
  title: string
  /** The line beneath it, e.g. the company. */
  subtitle?: string
  /** A third, quieter line — usually dates. */
  meta?: string
  /** Accessible label for the remove action. */
  removeLabel: string
  onRemove: () => void
  /** Open on mount — used for an entry the user just added. */
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const panelId = useId()

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white transition-colors',
        open ? 'border-brand-300' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* The summary is the toggle, so the whole row is the target rather
            than a small chevron at its edge. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[13px] text-ink-muted">{subtitle}</span>
          )}
          {meta && <span className="mt-0.5 block truncate text-xs text-ink-subtle">{meta}</span>}
        </button>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {open ? 'Done' : 'Edit'}
          </button>

          <Menu
            label={removeLabel}
            className="relative"
            triggerClassName="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            trigger={
              <span className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink">
                <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="19" r="1.6" />
                </svg>
              </span>
            }
          >
            {(close) => (
              <MenuItem
                tone="danger"
                onSelect={() => {
                  close()
                  onRemove()
                }}
              >
                Delete
              </MenuItem>
            )}
          </Menu>
        </div>
      </div>

      {open && (
        <div id={panelId} className="border-t border-slate-100 bg-slate-50/40 p-4">
          {children}
        </div>
      )}
    </div>
  )
}

/** The action that appends a new entry, consistent across every section. */
export function AddEntryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span aria-hidden className="text-base leading-none">
        +
      </span>
      {label}
    </button>
  )
}

/** An empty repeatable section — one quiet line, not a decorated panel. */
export function EntryEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-ink-subtle">
      {children}
    </p>
  )
}
