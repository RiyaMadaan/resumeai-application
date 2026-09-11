import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Optional footer area (e.g. action buttons). */
  footer?: ReactNode
  className?: string
  /**
   * `center` (default) is the standard dialog. `drawer` slides in from the
   * right edge at full height — the right shape for a panel of tools you work
   * alongside, rather than a decision to make and dismiss.
   */
  variant?: 'center' | 'drawer'
}

/**
 * Every dialog currently open, oldest first.
 *
 * Dialogs can legitimately nest — a panel of tools that opens a confirmation,
 * say — and without this, one Escape would close the whole stack, because both
 * dialogs' key handlers are bound to the document. Only the dialog on top
 * responds.
 */
const openDialogs: symbol[] = []

/**
 * Modal — accessible dialog. Closes on Escape and backdrop click, locks body
 * scroll while open. Kept dependency-free and intentionally simple.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  variant = 'center',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // A stable identity for this dialog's place in the stack.
  const idRef = useRef<symbol>(Symbol('dialog'))

  useEffect(() => {
    if (!open) return

    // Remember where focus came from so it can be handed back on close.
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)

    const id = idRef.current
    openDialogs.push(id)

    const onKey = (e: KeyboardEvent) => {
      // Only the topmost dialog reacts, so Escape closes one layer at a time.
      if (openDialogs[openDialogs.length - 1] !== id) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Keep Tab inside the dialog while it is open.
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // Move focus into the dialog rather than leaving it on the page behind.
    const timer = setTimeout(() => (focusable()[0] ?? panelRef.current)?.focus(), 0)

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      const index = openDialogs.indexOf(id)
      if (index !== -1) openDialogs.splice(index, 1)
      // Only release the page's scroll lock once nothing is left open.
      if (openDialogs.length === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        variant === 'drawer' ? 'justify-end' : 'items-center justify-center p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative bg-white shadow-card focus:outline-none',
          variant === 'drawer'
            ? 'h-full w-full max-w-md overflow-y-auto border-l border-slate-200 p-6 animate-fade-in'
            : 'w-full max-w-md rounded-xl border border-slate-200 p-6 animate-fade-up',
          className,
        )}
      >
        {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
        <div className={cn(title && 'mt-3')}>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}
