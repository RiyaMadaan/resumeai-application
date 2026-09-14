import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell, Panel } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { LayoutIcon, PlusIcon, SparkleIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import type { Resume } from '@/types/resume'

/** A long date, e.g. "12 March 2025". Empty when the value isn't a real date. */
function formatDate(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** A short date for the stats row, where the long form would wrap. */
function formatShortDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The initials shown in the avatar — one or two letters, never more. */
function initialsOf(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** The heading above each band of the page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
      {children}
    </h2>
  )
}

/**
 * One figure in the activity strip.
 *
 * The number leads and the label sits under it, at a size that reads as
 * supporting text rather than a dashboard tile — this is a profile, and the
 * counts are context, not the point of the page.
 */
function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-ink-muted">{label}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-ink-subtle">{hint}</p>}
    </div>
  )
}

/** One read-only fact about the account. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}

/**
 * AccountPage — the signed-in user's profile.
 *
 * Composed as one downward flow — who you are, what you've been doing, the
 * details behind it, then somewhere to go next — rather than a grid of cards
 * competing for attention. Everything shown is either the profile the API
 * returns or a figure derived from the user's own resumes; nothing is invented
 * to fill the page, and nothing here is editable that the backend can't change.
 */
export function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [statsError, setStatsError] = useState('')

  // The activity strip is supplementary: if it fails, the profile still renders.
  useEffect(() => {
    let active = true
    resumesApi
      .list()
      .then((list) => active && setResumes(list))
      .catch(
        (err) =>
          active && setStatsError(getApiErrorMessage(err, 'Could not load your resume summary')),
      )
    return () => {
      active = false
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const memberSince = formatDate(user?.createdAt)

  // Derived entirely from resumes the user already has.
  const total = resumes?.length ?? 0
  const mostRecent = resumes?.[0]
  const scored = (resumes ?? []).filter((r) => typeof r.atsAnalysis?.score === 'number')
  const bestScore = scored.length ? Math.max(...scored.map((r) => r.atsAnalysis!.score)) : null

  const actions = [
    { label: 'New resume', hint: 'From scratch, AI or an upload', Icon: PlusIcon, to: '/resume/new' },
    { label: 'Browse templates', hint: '63 designs to start from', Icon: LayoutIcon, to: '/templates' },
    { label: 'Tailor for a job', hint: 'Match a posting with AI', Icon: SparkleIcon, to: '/customize' },
  ]

  return (
    <PageShell title="Profile" description="Manage your account and resume activity.">
      {/* One column, one grid. The order is the hierarchy: who you are, then
          what you've done, then the details, then where to go next. */}
      <div className="space-y-7">
        {/* ── Identity ── */}
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white"
              >
                {initialsOf(user?.name)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
                  {user?.name ?? '—'}
                </h2>
                <p className="truncate text-sm text-ink-muted">{user?.email ?? '—'}</p>
                {memberSince && (
                  <p className="mt-0.5 text-xs text-ink-subtle">Member since {memberSince}</p>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleLogout} className="flex-shrink-0">
              Log out
            </Button>
          </div>
        </Panel>

        {/* ── Resume activity ── */}
        <section>
          <SectionLabel>Resume activity</SectionLabel>
          {statsError ? (
            <Panel className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {statsError}
            </Panel>
          ) : resumes === null ? (
            <Skeleton className="h-[86px] rounded-xl" />
          ) : (
            // One surface split into three, rather than three separate cards.
            <Panel flush>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Stat
                  value={String(total)}
                  label="Resumes"
                  hint={total === 0 ? 'None yet' : undefined}
                />
                <Stat
                  value={mostRecent ? formatShortDate(mostRecent.updatedAt) : '—'}
                  label="Last updated"
                  hint={mostRecent?.title}
                />
                <Stat
                  value={bestScore === null ? '—' : String(bestScore)}
                  label="Best ATS score"
                  hint={bestScore === null ? 'Run a check from the editor' : 'Across all resumes'}
                />
              </div>
            </Panel>
          )}
        </section>

        {/* ── Account details ── */}
        <section>
          <SectionLabel>Account details</SectionLabel>
          <Panel flush>
            <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Detail label="Name" value={user?.name ?? '—'} />
              <Detail label="Email" value={user?.email ?? '—'} />
              <Detail label="Member since" value={memberSince || '—'} />
            </dl>
          </Panel>
          <p className="mt-2 text-xs text-ink-subtle">
            Profile details come from your account and can't be edited here yet.
          </p>
        </section>

        {/* ── Quick actions ── */}
        <section>
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {actions.map((action) => (
              <button
                key={action.to}
                type="button"
                onClick={() => navigate(action.to)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <action.Icon width={16} height={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {action.label}
                  </span>
                  <span className="block truncate text-xs text-ink-subtle">{action.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
