import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
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

/** The initials shown in the avatar — one or two letters, never more. */
function initialsOf(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/** One label/value row in the account details card. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="break-words text-sm font-medium text-ink sm:text-right">{value}</dd>
    </div>
  )
}

/** A single figure drawn from the user's own resumes. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

/**
 * AccountPage — the details behind the navbar's account menu.
 *
 * It shows what the app genuinely knows about the signed-in user: their profile
 * from `/auth/me`, and a summary computed from their own resumes. Nothing here
 * is invented to fill the page out — every figure and action maps to something
 * the backend already supports.
 */
export function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [statsError, setStatsError] = useState('')

  // The summary is supplementary: if it fails, the profile itself still renders.
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
  const bestScore = scored.length
    ? Math.max(...scored.map((r) => r.atsAnalysis!.score))
    : null

  /** The three quick actions, all routes that already exist. */
  const actions = [
    {
      label: 'New resume',
      hint: 'Start from scratch, AI or an upload.',
      Icon: PlusIcon,
      to: '/resume/new',
    },
    {
      label: 'Browse templates',
      hint: 'Choose the design your next resume starts in.',
      Icon: LayoutIcon,
      to: '/templates',
    },
    {
      label: 'Tailor for a job',
      hint: 'Match a resume to a job description with AI.',
      Icon: SparkleIcon,
      to: '/customize',
    },
  ]

  return (
    <PageShell title="Profile" description="Manage your account and resume activity.">
      {/* Two columns on desktop: the account on the left, what you can do with
          it on the right. The page used to be a narrow column with the content
          area empty beside it. */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Identity. A quiet card rather than a full-width gradient banner —
              the avatar already carries the brand colour. */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  aria-hidden
                  className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xl font-bold text-white"
                >
                  {initialsOf(user?.name)}
                </div>
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
              <Button variant="secondary" onClick={handleLogout} className="flex-shrink-0">
                Log out
              </Button>
            </div>
          </section>

          {/* Resume overview */}
          <section aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="text-sm font-semibold text-ink">
              Resume overview
            </h2>

            {statsError ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {statsError}
              </p>
            ) : resumes === null ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[88px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Resumes"
                  value={String(total)}
                  hint={total === 0 ? 'None yet' : undefined}
                />
                <Stat
                  label="Last updated"
                  value={mostRecent ? formatDate(mostRecent.updatedAt) || '—' : '—'}
                  hint={mostRecent?.title}
                />
                <Stat
                  label="Best ATS score"
                  value={bestScore === null ? '—' : String(bestScore)}
                  hint={bestScore === null ? 'Run a check from the editor' : 'Across all resumes'}
                />
              </div>
            )}
          </section>

          {/* Account details — read-only, as the API provides them. */}
          <section className="rounded-xl border border-slate-200 bg-white px-5 py-1">
            <dl>
              <Field label="Name" value={user?.name ?? '—'} />
              <Field label="Email" value={user?.email ?? '—'} />
              {memberSince && <Field label="Member since" value={memberSince} />}
            </dl>
          </section>
          <p className="-mt-2 px-1 text-xs text-ink-subtle">
            Profile details come from your account and can't be edited here yet.
          </p>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-ink">Quick actions</h2>
          <div className="mt-3 space-y-2.5">
            {actions.map((action) => (
              <button
                key={action.to}
                type="button"
                onClick={() => navigate(action.to)}
                className="flex w-full items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <action.Icon width={18} height={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{action.label}</span>
                  <span className="block text-xs leading-relaxed text-ink-muted">
                    {action.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
