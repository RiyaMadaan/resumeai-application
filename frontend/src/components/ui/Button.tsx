import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Button tiers.
 *
 * `primary` is the one purple action on a screen; `secondary` is the neutral
 * companion; `ghost` is for low-emphasis actions that shouldn't compete; and
 * `danger` is reserved for destructive confirmations — red only where it is
 * genuinely needed, never for an ordinary "Delete" entry point.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-soft hover:shadow-lift hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-white text-ink border border-slate-200 hover:border-brand-300 hover:text-brand-700 shadow-soft',
  ghost: 'text-ink-muted hover:text-brand-700 hover:bg-brand-50',
  danger: 'bg-red-600 text-white shadow-soft hover:bg-red-700',
}

/** Fixed heights so buttons line up wherever they sit next to each other. */
const sizes: Record<Size, string> = {
  sm: 'h-9 text-sm px-3.5',
  md: 'h-10 text-sm px-5',
  lg: 'h-11 text-base px-6',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

/**
 * The button's classes, for the rare case where the element has to be
 * something Button can't render — a react-router `<Link>`, for instance.
 * Sharing the builder keeps those cases from drifting out of style.
 */
export function buttonClasses(options: {
  variant?: Variant
  size?: Size
  className?: string
} = {}): string {
  const { variant = 'primary', size = 'md', className } = options
  return cn(base, variants[variant], sizes[size], className)
}

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' }

type LinkProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; href: string }

/**
 * Button — the primary interactive primitive.
 * Render as a real <button> (default) or an <a> via `as="a"` for links/CTAs.
 */
export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', className, children } = props

  const classes = cn(base, variants[variant], sizes[size], className)

  if (props.as === 'a') {
    const { as: _as, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props
    return (
      <a className={classes} {...rest}>
        {children}
      </a>
    )
  }

  const { as: _as, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
