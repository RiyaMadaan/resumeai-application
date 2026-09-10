import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button, buttonClasses } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { PlusIcon, WandIcon } from '@/components/ui/icons'
import { coverLettersApi } from '@/api/coverLetters.api'
import { getApiErrorMessage } from '@/api/client'
import type { CoverLetter } from '@/types/coverLetter'

/** "2 days ago" style relative date, matching the dashboard's resume cards. */
function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A letter's display name — its title, or what it was written for. */
function labelOf(letter: CoverLetter): string {
  if (letter.title.trim()) return letter.title.trim()
  const target = [letter.jobTitle, letter.company].filter(Boolean).join(' at ')
  return target || 'Untitled cover letter'
}

/**
 * CoverLettersPage — every cover letter the user has written.
 *
 * Deliberately shaped like the resume dashboard so the two feel like one
 * product rather than two features bolted together.
 */
export function CoverLettersPage() {
  const navigate = useNavigate()
  const [letters, setLetters] = useState<CoverLetter[] | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState('')

  useEffect(() => {
    let active = true
    coverLettersApi
      .list()
      .then((list) => active && setLetters(list))
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load your cover letters')))
    return () => {
      active = false
    }
  }, [])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    setError('')
    try {
      await coverLettersApi.remove(id)
      setLetters((current) => (current ?? []).filter((l) => l._id !== id))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete that cover letter'))
    } finally {
      setDeleting('')
    }
  }

  return (
    <Container className="py-8 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Cover letters</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Written from your resume and tailored to a specific job.
          </p>
        </div>
        <Button onClick={() => navigate('/cover-letters/new')} className="flex-shrink-0">
          <PlusIcon width={16} height={16} />
          New cover letter
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {letters === null ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : letters.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<WandIcon width={22} height={22} />}
            title="No cover letters yet"
            description="Pick a resume, paste the job description, and we'll draft a letter using only what's already on your resume."
            action={
              <Button onClick={() => navigate('/cover-letters/new')}>Write a cover letter</Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {letters.map((letter) => (
            <div
              key={letter._id}
              className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 text-sm font-semibold text-ink">
                  <Link
                    to={`/cover-letters/${letter._id}`}
                    className="after:absolute after:inset-0 after:content-[''] hover:text-brand-700"
                  >
                    <span className="line-clamp-2">{labelOf(letter)}</span>
                  </Link>
                </h2>
                <Menu
                  label={`More actions for ${labelOf(letter)}`}
                  className="relative z-30"
                  triggerClassName="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  trigger={
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink">
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                      </svg>
                    </span>
                  }
                >
                  {(close) => (
                    <MenuItem
                      tone="danger"
                      onSelect={() => {
                        close()
                        handleDelete(letter._id)
                      }}
                    >
                      {deleting === letter._id ? 'Deleting…' : 'Delete'}
                    </MenuItem>
                  )}
                </Menu>
              </div>

              {/* Who it's for, then when it changed. */}
              {(letter.jobTitle || letter.company) && (
                <p className="mt-1 truncate text-xs font-medium text-brand-700">
                  {letter.jobTitle || 'Role not set'}
                  {letter.company && <span className="text-ink-muted"> · {letter.company}</span>}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-subtle">
                Updated {formatUpdated(letter.updatedAt)}
                {!letter.generatedAt && ' · Draft'}
              </p>

              <p className="mt-3 flex-1 text-xs leading-relaxed text-ink-muted line-clamp-4">
                {letter.body.trim() || 'Not generated yet — open it to write the draft.'}
              </p>

              {/* An explicit action, above the card's stretched link so it is
                  the thing actually clicked. */}
              <div className="relative z-10 mt-3.5">
                <Link
                  to={`/cover-letters/${letter._id}`}
                  className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'w-full' })}
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}
