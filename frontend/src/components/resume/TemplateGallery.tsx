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
 * Each card renders an actual miniature of the template through the shared
 * renderer, so what you pick is what the resume becomes. Selection is
 * controlled by the parent, which lets the same gallery serve the dedicated
 * templates page and the editor's "change template" dialog.
 */
export function TemplateGallery({
  selectedId,
  onSelect,
  /** When given, cards preview the user's own resume instead of sample data. */
  previewResume,
  className,
}: {
  selectedId?: string
  onSelect: (id: string) => void
  previewResume?: Resume | ResumeInput
  className?: string
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

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([['All', TEMPLATES.length]])
    for (const category of TEMPLATE_CATEGORIES) {
      map.set(category, TEMPLATES.filter((t) => t.category === category).length)
    }
    return map
  }, [])

  const filters: Filter[] = ['All', ...TEMPLATE_CATEGORIES]

  return (
    <div className={className}>
      {/* Filters + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'flex-shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
                filter === f
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-ink-muted hover:border-brand-300 hover:text-brand-700',
              )}
            >
              {f}
              <span className={cn('ml-1.5 text-xs', filter === f ? 'text-white/70' : 'text-ink-subtle')}>
                {counts.get(f) ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="relative lg:w-64 lg:flex-shrink-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-semibold text-ink">No templates match “{query}”</p>
          <p className="mt-1 text-sm text-ink-muted">
            Try a different search, or browse another category.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuery('')
              setFilter('All')
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200',
        selected
          ? 'border-brand-500 shadow-glow'
          : 'border-slate-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card',
      )}
    >
      {/* Miniature */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Preview and select the ${spec.name} template`}
        className="relative block w-full bg-slate-100 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <div className="overflow-hidden rounded-md shadow-sm ring-1 ring-slate-200">
          <TemplateThumbnail spec={spec} resume={previewResume} />
        </div>

        {spec.badge && !selected && (
          <span className="absolute right-5 top-5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 shadow-sm ring-1 ring-brand-100">
            {spec.badge}
          </span>
        )}

        {selected && (
          <span className="absolute right-5 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">
            <CheckIcon width={14} height={14} />
          </span>
        )}
      </button>

      {/* Meta */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{spec.name}</h3>
          <span className="flex-shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-ink-subtle">
            {spec.category}
          </span>
        </div>
        <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-muted">{spec.description}</p>
        {spec.useCase && (
          <p className="mt-2 text-[11px] font-medium text-ink-subtle">{spec.useCase}</p>
        )}

        <Button
          size="sm"
          variant={selected ? 'secondary' : 'primary'}
          className="mt-3.5 w-full"
          onClick={onSelect}
          disabled={selected}
        >
          {selected ? 'Selected' : 'Use template'}
        </Button>
      </div>
    </div>
  )
}

/** The catalog entry for an id — re-exported so pages need one import. */
export { getTemplate }
