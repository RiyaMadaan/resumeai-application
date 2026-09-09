import { cn } from '@/lib/cn'

interface StepperProps {
  steps: string[]
  /** Zero-based index of the active step. */
  current: number
  className?: string
}

/**
 * Stepper — a compact progress indicator for a short guided flow.
 *
 * Rendered as an ordered list so the sequence is conveyed to assistive tech,
 * with the active step marked via `aria-current`.
 */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2 sm:gap-3', className)}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-brand-600 text-white',
                  active && 'bg-brand-600 text-white',
                  !done && !active && 'bg-slate-100 text-ink-subtle',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={cn(
                  'hidden truncate text-sm sm:block',
                  active ? 'font-semibold text-ink' : 'text-ink-subtle',
                )}
              >
                {step}
              </span>
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn('h-px flex-1 transition-colors', done ? 'bg-brand-300' : 'bg-slate-200')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
