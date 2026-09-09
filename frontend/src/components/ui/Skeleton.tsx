import { cn } from '@/lib/cn'

/** Skeleton — a neutral placeholder block used while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />
}

/**
 * The resume-card placeholder, shaped like the real card so the dashboard
 * doesn't jump when the data arrives.
 */
export function ResumeCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <Skeleton className="mt-4 h-12 w-full rounded-lg" />
      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
    </div>
  )
}
