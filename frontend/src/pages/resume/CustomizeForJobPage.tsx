import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReturnTo } from '@/lib/returnTo'
import { getTemplate } from '@/templates/catalog'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState, Spinner } from '@/components/ui/LoadingState'
import { Stepper } from '@/components/ui/Stepper'
import { PageShell, Panel, PanelHeader } from '@/components/layout/PageShell'
import { SparkleIcon } from '@/components/ui/icons'
import { aiApi } from '@/api/ai.api'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import type { Resume } from '@/types/resume'

const STEPS = ['Choose resume', 'Job description', 'Review changes']

/** Mirrors the server's bounds so the user gets feedback before a round trip. */
const MIN_JOB_DESCRIPTION_LENGTH = 40
const MAX_JOB_DESCRIPTION_LENGTH = 20000

/** What the AI is doing while step 3 runs, so the wait isn't a blank screen. */
const PROGRESS_MESSAGES = [
  'Reading the job description…',
  'Matching it against your experience…',
  'Choosing what to emphasise…',
]

/** Format an ISO date into a short "Updated" label. */
function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * CustomizeForJobPage — "job description → tailored resume", as a short guided
 * flow rather than one long form.
 *
 * Step 3 is the AI run; its result is handed to the editor, which owns the
 * review, the live preview and Save. Nothing is saved from this page.
 */
export function CustomizeForJobPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Opened from a resume, Back belongs to that resume; opened from the
  // dashboard, it belongs to the dashboard.
  const back = useReturnTo({ to: '/dashboard', label: 'Back to resumes' })

  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [step, setStep] = useState(0)
  const [selectedId, setSelectedId] = useState(searchParams.get('resume') ?? '')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)

  useEffect(() => {
    let active = true
    resumesApi
      .list()
      .then((data) => {
        if (!active) return
        setResumes(data)
        setSelectedId((current) =>
          current && data.some((r) => r._id === current) ? current : (data[0]?._id ?? ''),
        )
        // Arriving from a specific resume skips straight to the posting.
        if (searchParams.get('resume') && data.some((r) => r._id === searchParams.get('resume'))) {
          setStep(1)
        }
      })
      .catch((err) => active && setLoadError(getApiErrorMessage(err, 'Could not load your resumes')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [searchParams])

  // Walk the progress copy while the request is in flight.
  useEffect(() => {
    if (!submitting) {
      setProgressIndex(0)
      return
    }
    const timer = setInterval(
      () => setProgressIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)),
      2600,
    )
    return () => clearInterval(timer)
  }, [submitting])

  const trimmedLength = jobDescription.trim().length

  const handleSubmit = async () => {
    setError('')
    if (trimmedLength < MIN_JOB_DESCRIPTION_LENGTH) {
      setError(
        `That's a bit short to tailor against — please paste at least ${MIN_JOB_DESCRIPTION_LENGTH} characters of the posting.`,
      )
      return
    }
    if (trimmedLength > MAX_JOB_DESCRIPTION_LENGTH) {
      setError(
        `That job description is too long (${trimmedLength.toLocaleString()} of ${MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters). Paste just the role, responsibilities and requirements.`,
      )
      return
    }
    const selected = resumes.find((r) => r._id === selectedId)
    if (!selected) {
      setError('That resume is no longer available. Please pick another one.')
      setStep(0)
      return
    }

    setStep(2)
    setSubmitting(true)
    try {
      const proposal = await aiApi.customize(selectedId, selected, jobDescription.trim())
      navigate(`/resume/${selectedId}`, { state: { jobCustomization: proposal } })
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Sorry, we could not tailor your resume. Please try again.'),
      )
      setSubmitting(false)
      setStep(1)
    }
  }

  if (loading) return <LoadingState label="Loading your resumes…" fullscreen />

  return (
    <PageShell
      width="default"
      back={back}
      title="Customize for a job"
      description="ResumeAI rewrites what you already have to match the role. It never invents experience."
    >
      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : resumes.length === 0 ? (
        <div>
          <EmptyState
            title="No resumes to tailor yet"
            description="Create a resume first, then come back and tailor it to any job posting."
            action={
              <Button size="lg" onClick={() => navigate('/resume/new')}>
                Create a resume
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Stepper variant="compact" steps={STEPS} current={step} />

          <div className="mt-5">
            {/* ── Step 1: choose a resume ── */}
            {step === 0 && (
              <Panel>
                <PanelHeader
                  title="Which resume do you want to tailor?"
                  description="Its content is the only thing the tailoring can draw on."
                />
                <div className="space-y-2">
                  {resumes.map((resume) => {
                    const selected = resume._id === selectedId
                    return (
                      <label
                        key={resume._id}
                        className={
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ' +
                          (selected
                            ? 'border-brand-400 bg-brand-50'
                            : 'border-slate-200 bg-white hover:border-brand-200')
                        }
                      >
                        <input
                          type="radio"
                          name="resume"
                          value={resume._id}
                          checked={selected}
                          onChange={() => setSelectedId(resume._id)}
                          className="h-4 w-4 shrink-0 accent-brand-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {resume.title}
                          </span>
                          <span className="block text-xs text-ink-subtle">
                            Updated {formatUpdated(resume.updatedAt)} ·{' '}
                            <span>{getTemplate(resume.template).name}</span>
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>

                <div className="mt-5 flex gap-2">
                  <Button onClick={() => setStep(1)} disabled={!selectedId}>
                    Continue
                  </Button>
                  <Button variant="ghost" onClick={() => navigate(back.to)}>
                    Cancel
                  </Button>
                </div>
              </Panel>
            )}

            {/* ── Step 2: the posting ── */}
            {step === 1 && (
              <Panel>
                <label htmlFor="job-description" className="text-sm font-semibold text-ink">
                  Paste the job description
                </label>
                <p id="job-description-hint" className="mt-1 text-xs text-ink-muted">
                  Paste the job description and ResumeAI will identify relevant skills, keywords,
                  and requirements.
                </p>
                <textarea
                  id="job-description"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={14}
                  autoFocus
                  aria-describedby="job-description-hint"
                  className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-ink-subtle">
                    Include the role, responsibilities and requirements for the best result.
                  </p>
                  {trimmedLength > 0 && (
                    <p
                      className={
                        'text-xs tabular-nums ' +
                        (trimmedLength > MAX_JOB_DESCRIPTION_LENGTH
                          ? 'font-medium text-red-600'
                          : 'text-ink-subtle')
                      }
                    >
                      {trimmedLength.toLocaleString()} characters
                    </p>
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {error}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button onClick={handleSubmit} disabled={trimmedLength === 0}>
                    <SparkleIcon width={16} height={16} />
                    Customize resume
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    Back
                  </Button>
                </div>
              </Panel>
            )}

            {/* ── Step 3: the AI run ── */}
            {step === 2 && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-16 text-center"
              >
                <Spinner className="h-8 w-8" />
                <p className="text-sm font-medium text-ink">{PROGRESS_MESSAGES[progressIndex]}</p>
                <p className="max-w-sm text-xs text-ink-subtle">
                  You'll review every proposed change before anything is applied.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </PageShell>
  )
}
