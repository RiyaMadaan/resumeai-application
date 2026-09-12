import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { CheckIcon } from '@/components/ui/icons'
import { TEMPLATES, getTemplate } from '@/templates/catalog'
import { TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateSpec } from '@/templates/types'
import { TemplateThumbnail } from '@/templates/TemplateThumbnail'
import type { Resume, ResumeInput } from '@/types/resume'

/** "All" plus every category, as the filter row shows them. */
type Filter = 'All' | TemplateCategory

/**
 * TemplateGallery — browse and choose a resume template.
 *
 * The thumbnail is the product here: each card renders a real miniature
 * through the shared renderer, so what you pick is exactly what the resume
 * becomes. Everything else on the card is deliberately quiet — a name and a
 * category, no paragraph — because a design is understood by looking at it,
 * and prose competing with sixty thumbnails is just noise.
 *
 * Selection is controlled by the parent, which lets the same gallery serve the
 * creation wizard's Design step and the editor's template dialog.
 */
export function TemplateGallery({
  selectedId,
  onSelect,
  /** When given, cards preview the user's own resume instead of sample data. */
  previewResume,
  className,
  stickyControls,
}: {
  selectedId?: string
  onSelect: (id: string) => void
  previewResume?: Resume | ResumeInput
  className?: string
  /**
   * Keep search and categories pinned while the grid scrolls. Set when the
   * gallery fills a scrolling dialog; left off when it sits in a page that
   * scrolls as a whole.
   */
  stickyControls?: boolean
}) {
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TEMPLATES.filter((t) => {
      if (filter !== 'All' && t.category !== filter) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.useCase?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [filter, query])

  const filters: Filter[] = ['All', ...TEMPLATE_CATEGORIES]

  const clear = () => {
    setQuery('')
    setFilter('All')
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-shrink-0 space-y-3',
          // Bleed to the dialog's padding so the sticky band covers the full
          // width as cards pass underneath it.
          stickyControls && 'sticky -top-px z-10 -mx-6 border-b border-slate-100 bg-white px-6 pb-3 pt-1',
        )}
      >
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Category pills. The row scrolls when it has to, but the scrollbar
            itself is hidden — a native bar under the filters reads as a layout
            bug rather than an affordance. */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'flex-shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-ink-muted hover:bg-slate-200 hover:text-ink',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-ink">No templates found</p>
          <p className="mt-1 text-sm text-ink-muted">Try another search or category.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((spec) => (
            <TemplateCard
              key={spec.id}
              spec={spec}
              selected={spec.id === selectedId}
              onSelect={() => onSelect(spec.id)}
              previewResume={previewResume}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  spec,
  selected,
  onSelect,
  previewResume,
}: {
  spec: TemplateSpec
  selected: boolean
  onSelect: () => void
  previewResume?: Resume | ResumeInput
}) {
  return (
    // A flex column with the action pinned at the end, so every card in a row
    // is the same height and no button is ever clipped.
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200',
        selected
          ? 'border-brand-500 ring-2 ring-brand-500/25'
          : 'border-slate-200 hover:border-brand-300 hover:shadow-card',
      )}
    >
      {/* The thumbnail is the card. Clicking it selects, so the whole preview
          is the target rather than only the button beneath it. */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Use the ${spec.name} template`}
        className={cn(
          'relative block w-full p-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
          selected ? 'bg-brand-50/60' : 'bg-slate-50',
        )}
      >
        <div className="overflow-hidden rounded ring-1 ring-slate-200">
          <TemplateThumbnail spec={spec} resume={previewResume} />
        </div>

        {selected ? (
          <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
            <CheckIcon width={14} height={14} />
          </span>
        ) : (
          spec.badge && (
            <span className="absolute right-4 top-4 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 shadow-sm ring-1 ring-brand-100">
              {spec.badge}
            </span>
          )
        )}
      </button>

      {/* Name and category only — the thumbnail already says how it looks. */}
      <div className="flex flex-1 flex-col gap-3 border-t border-slate-100 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{spec.name}</h3>
          <p className="truncate text-xs text-ink-subtle">{spec.category}</p>
        </div>

        <Button
          size="sm"
          variant={selected ? 'secondary' : 'primary'}
          className="mt-auto w-full"
          onClick={onSelect}
          disabled={selected}
        >
          {selected ? (
            <>
              <CheckIcon width={14} height={14} /> Selected
            </>
          ) : (
            'Use template'
          )}
        </Button>
      </div>
    </div>
  )
}

/** The catalog entry for an id — re-exported so pages need one import. */
export { getTemplate }
