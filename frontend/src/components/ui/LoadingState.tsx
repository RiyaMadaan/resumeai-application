import { cn } from '@/lib/cn'

interface LoadingStateProps {
  label?: string
  /** Fill the viewport (used while auth initializes). */
  fullscreen?: boolean
  className?: string
}

/** A small brand spinner with an optional label. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

/** LoadingState — centered spinner + label for pages and panels. */
export function LoadingState({ label = 'Loading…', fullscreen, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        fullscreen ? 'min-h-screen' : 'py-16',
        className,
      )}
    >
      <Spinner />
      <p className="text-sm font-medium text-ink-muted">{label}</p>
    </div>
  )
}
