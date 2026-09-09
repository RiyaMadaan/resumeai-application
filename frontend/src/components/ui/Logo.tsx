import { cn } from '@/lib/cn'

interface LogoProps {
  /** Show the "ResumeAI" wordmark next to the mark. Default: true. */
  showWordmark?: boolean
  /** Overall size of the logo mark in pixels. Default: 32. */
  size?: number
  className?: string
}

/**
 * ResumeAI brand logo — a minimal "R + AI sparkle" mark.
 *
 * Built as a self-contained SVG component (no external image dependency).
 * The gradient rounded square holds a clean sans-serif "R"; a small sparkle
 * in the corner signals the AI assist.
 */
export function Logo({ showWordmark = true, size = 32, className }: LogoProps) {
  const gradientId = 'resumeai-logo-gradient'

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label="ResumeAI"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Rounded brand tile */}
        <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />

        {/* The "R" — clean, bold, sans-serif */}
        <path
          d="M11 23V9h5.4c2.6 0 4.3 1.5 4.3 3.9 0 1.8-1 3.1-2.6 3.6L21 23h-2.9l-2.4-5.2h-1.8V23H11zm2.9-7.4h2c1.2 0 2-.7 2-1.7s-.8-1.6-2-1.6h-2v3.3z"
          fill="#fff"
        />

        {/* AI sparkle */}
        <path
          d="M23.5 8.2l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z"
          fill="#fff"
          className="origin-center animate-sparkle"
        />
      </svg>

      {showWordmark && (
        <span className="text-lg font-bold tracking-tight text-ink">
          Resume<span className="text-gradient">AI</span>
        </span>
      )}
    </span>
  )
}
