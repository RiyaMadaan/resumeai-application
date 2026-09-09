import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
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

  return (
    <Container className="max-w-4xl py-8 sm:py-12">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
      >
        ← Back to dashboard
      </button>

      {/* Identity card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="h-20 bg-brand-gradient sm:h-24" aria-hidden />
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div
                aria-hidden
                className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-brand-600 text-2xl font-bold text-white shadow-card sm:h-24 sm:w-24 sm:text-3xl"
              >
                {initialsOf(user?.name)}
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  {user?.name ?? '—'}
                </h1>
                <p className="truncate text-sm text-ink-muted">{user?.email ?? '—'}</p>
              </div>
            </div>

            <Button size="sm" onClick={() => navigate('/resume/new')} className="flex-shrink-0">
              <PlusIcon width={16} height={16} />
              New resume
            </Button>
          </div>
        </div>
      </section>

      {/* Summary of the user's own work */}
      <section className="mt-6" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-sm font-semibold text-ink">
          Your resumes
        </h2>

        {statsError ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {statsError}
          </p>
        ) : resumes === null ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[92px] rounded-xl" />
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

      {/* Account details */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-1 shadow-soft sm:px-6">
        <dl>
          <Field label="Name" value={user?.name ?? '—'} />
          <Field label="Email" value={user?.email ?? '—'} />
          {memberSince && <Field label="Member since" value={memberSince} />}
        </dl>
      </section>
      <p className="mt-2 px-1 text-xs text-ink-subtle">
        Profile details come from your account and can't be edited here yet.
      </p>

      {/* Shortcuts to things that exist */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/templates')}
          className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <LayoutIcon width={20} height={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Browse templates</span>
            <span className="block text-xs text-ink-muted">
              Choose the design your next resume starts in.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/customize')}
          className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <SparkleIcon width={20} height={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Tailor for a job</span>
            <span className="block text-xs text-ink-muted">
              Match a resume to a job description with AI.
            </span>
          </span>
        </button>
      </section>

      {/* Session */}
      <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Sign out</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            You'll need to sign in again to reach your resumes.
          </p>
        </div>
        <Button variant="secondary" onClick={handleLogout} className="flex-shrink-0">
          Log out
        </Button>
      </section>
    </Container>
  )
}
