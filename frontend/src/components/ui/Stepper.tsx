import { cn } from '@/lib/cn'

interface StepperProps {
  steps: string[]
  /** Zero-based index of the active step. */
  current: number
  /**
   * Jump to a step. When given, every step the user has already reached
   * becomes a button; without it the stepper stays a read-only indicator, as
   * the linear flows want.
   */
  onSelect?: (index: number) => void
  /**
   * The furthest step reached so far. Steps up to here are selectable even
   * when the user has navigated back. Defaults to `current`.
   */
  maxReached?: number
  className?: string
  /**
   * `full` (default) shows a numbered circle and label per step — right for a
   * three- or four-step flow. `compact` reduces each step to a bar, with the
   * current step named once beneath: nine numbered circles and ticks read as a
   * checklist to complete rather than a position in a flow.
   */
  variant?: 'full' | 'compact'
}

/**
 * Stepper — a compact progress indicator for a short guided flow.
 *
 * Rendered as an ordered list so the sequence is conveyed to assistive tech,
 * with the active step marked via `aria-current`.
 */
export function Stepper({
  steps,
  current,
  onSelect,
  maxReached,
  className,
  variant = 'full',
}: StepperProps) {
  const furthest = Math.max(maxReached ?? current, current)

  if (variant === 'compact') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5">
          {steps.map((step, i) => {
            const reached = i <= furthest
            const active = i === current
            const selectable = !!onSelect && reached && !active
            const Tag = selectable ? 'button' : 'div'
            return (
              <Tag
                key={step}
                {...(selectable
                  ? {
                      type: 'button' as const,
                      onClick: () => onSelect?.(i),
                      'aria-label': `Go to step ${i + 1}: ${step}`,
                    }
                  : {})}
                aria-current={active ? 'step' : undefined}
                title={step}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  active ? 'bg-brand-600' : reached ? 'bg-brand-300' : 'bg-slate-200',
                  selectable && 'cursor-pointer hover:bg-brand-400',
                )}
              />
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          Step {current + 1} of {steps.length}
          <span className="mx-1.5" aria-hidden>
            ·
          </span>
          <span className="font-medium text-ink">{steps[current]}</span>
        </p>
      </div>
    )
  }

  return (
    <ol className={cn('flex items-center gap-2 sm:gap-3', className)}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        const selectable = !!onSelect && i <= furthest && !active
        // A step is a button only when it can actually be jumped to, so the
        // read-only usage keeps its original markup and semantics.
        const Tag = selectable ? 'button' : 'span'
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Tag
              {...(selectable
                ? {
                    type: 'button' as const,
                    onClick: () => onSelect?.(i),
                    'aria-label': `Go to step ${i + 1}: ${step}`,
                  }
                : {})}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-2',
                selectable &&
                  'rounded-lg transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              )}
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
            </Tag>
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
