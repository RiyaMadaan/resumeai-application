import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface MenuProps {
  /** The control that opens the menu. Receives no props — style it yourself. */
  trigger: ReactNode
  /** Accessible label for the trigger button. */
  label: string
  children: (close: () => void) => ReactNode
  /** Which edge of the trigger the panel aligns to. */
  align?: 'left' | 'right'
  className?: string
  triggerClassName?: string
}

/** Roughly how tall a panel gets; used to decide whether it fits below. */
const ESTIMATED_PANEL_HEIGHT = 160

/**
 * Menu — a small accessible dropdown.
 *
 * Closes on Escape, on outside click, and after any item is chosen (items call
 * the `close` passed to the render function). Opening one closes any other,
 * since each closes on an outside press.
 *
 * The panel flips above the trigger when there isn't room below, so a card in
 * the last dashboard row doesn't open its menu off-screen.
 *
 * NOTE on stacking: the wrapper deliberately does NOT set a z-index. Doing so
 * creates a stacking context that traps the panel underneath any later sibling
 * with an equal z-index — which is exactly how this menu once ended up painted
 * behind the card content below it. Callers raise the wrapper instead.
 */
export function Menu({
  trigger,
  label,
  children,
  align = 'right',
  className,
  triggerClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const close = useCallback(() => setOpen(false), [])

  // Decide which way to open before the panel paints.
  useLayoutEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    setDropUp(spaceBelow < ESTIMATED_PANEL_HEIGHT && rect.top > spaceBelow)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        // Return focus so keyboard users don't lose their place.
        triggerRef.current?.focus()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // A menu anchored to a card would drift if the page moved beneath it.
    const onScroll = () => setOpen(false)

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn('inline-flex items-center', triggerClassName)}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card',
            align === 'right' ? 'right-0' : 'left-0',
            dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  onSelect: () => void
  children: ReactNode
  /** Destructive items are tinted red and separated from the rest. */
  tone?: 'default' | 'danger'
  icon?: ReactNode
}

/** A single row inside a Menu. */
export function MenuItem({ onSelect, children, tone = 'default', icon }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:outline-none',
        tone === 'danger'
          ? 'text-red-600 hover:bg-red-50 focus-visible:bg-red-50'
          : 'text-ink hover:bg-slate-50 hover:text-brand-700 focus-visible:bg-slate-50',
      )}
    >
      {icon && <span className="shrink-0 text-ink-subtle">{icon}</span>}
      {children}
    </button>
  )
}

/** A hairline divider between groups of menu items. */
export function MenuSeparator() {
  return <div className="my-1 h-px bg-slate-100" role="separator" />
}
