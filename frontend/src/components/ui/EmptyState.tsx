import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  /** Optional icon node shown above the title. */
  icon?: ReactNode
  /** The single call to action for this state. */
  action?: ReactNode
}

/**
 * EmptyState — the placeholder for an empty list.
 *
 * One heading, one line of explanation, one action. Kept deliberately quiet so
 * it reads as a starting point rather than an error.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
