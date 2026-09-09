import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Container — centers content and applies the site's max width and
 * responsive horizontal padding. Use inside every Section.
 */
export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-container px-5 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  )
}
