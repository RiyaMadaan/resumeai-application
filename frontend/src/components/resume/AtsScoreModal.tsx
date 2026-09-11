import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Collapsible } from '@/components/ui/Collapsible'
import { Spinner } from '@/components/ui/LoadingState'
import { aiApi, type AtsScoreResult } from '@/api/ai.api'
import { getApiErrorMessage } from '@/api/client'
import type { AtsCategoryScores, Resume, ResumeInput } from '@/types/resume'

interface AtsScoreModalProps {
  open: boolean
  onClose: () => void
  /** The resume to analyse. Ownership is re-checked server-side. */
  resumeId: string
  /** Shown in the header so the user knows which resume this is. */
  resumeTitle?: string
  /**
   * The caller's current (possibly unsaved) editor content. Omit on the
   * dashboard to analyse the saved version.
   */
  resume?: Resume | ResumeInput
  /**
   * Called after a successful analysis. The server also stores it on the
   * resume, so a caller holding a resume list can patch it in place instead of
   * refetching.
   */
  onAnalyzed?: (result: AtsScoreResult) => void
}

/** The category rows, in the order they're displayed. */
const CATEGORY_LABELS: { key: keyof AtsCategoryScores; label: string; hint: string }[] = [
  { key: 'content', label: 'Content', hint: 'Summary quality, clarity and relevance' },
  { key: 'keywords', label: 'Keywords', hint: 'Coverage of role-relevant terminology' },
  { key: 'formatting', label: 'Formatting', hint: 'How cleanly an ATS can parse it' },
  { key: 'experience', label: 'Experience', hint: 'Action verbs, scope and measurable results' },
  { key: 'skills', label: 'Skills', hint: 'Quality and relevance of what you listed' },
  { key: 'completeness', label: 'Completeness', hint: 'How much of a full resume is filled in' },
]

/** Colour a score by band — green is earned, not given. */
function scoreTone(score: number): { text: string; bar: string; ring: string } {
  if (score >= 78) return { text: 'text-emerald-700', bar: 'bg-emerald-500', ring: '#059669' }
  if (score >= 62) return { text: 'text-brand-700', bar: 'bg-brand-500', ring: '#6366f1' }
  if (score >= 45) return { text: 'text-amber-700', bar: 'bg-amber-500', ring: '#d97706' }
  return { text: 'text-red-700', bar: 'bg-red-500', ring: '#dc2626' }
}

/** A circular score gauge drawn with a stroked SVG arc. */
function ScoreRing({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const tone = scoreTone(score)

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={tone.ring}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, score)) / 100)}
          style={{ transition: 'stroke-dashoffset 900ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-xs font-medium text-ink-subtle">out of 100</span>
      </div>
    </div>
  )
}

/** One category row with a labelled progress bar. */
function CategoryRow({ label, hint, score }: { label: string; hint: string; score: number }) {
  const tone = scoreTone(score)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>{score}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${score}%`, transition: 'width 700ms ease-out' }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p>
    </div>
  )
}

/** A titled list of feedback bullets. */
function FeedbackList({
  icon,
  title,
  items,
  markerClassName,
  defaultOpen,
}: {
  icon: string
  title: string
  items: string[]
  markerClassName: string
  defaultOpen?: boolean
}) {
  if (items.length === 0) return null
  return (
    <Collapsible
      title={`${icon}  ${title}`}
      summary={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      defaultOpen={defaultOpen}
    >
      <ul className={`list-disc space-y-1.5 pl-4 text-sm ${markerClassName}`}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Collapsible>
  )
}

/** A wrapped row of keyword chips. */
function KeywordChips({
  title,
  description,
  items,
  chipClassName,
}: {
  title: string
  description: string
  items: string[]
  chipClassName: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</p>
      <p className="mt-0.5 text-[11px] text-ink-subtle">{description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((keyword) => (
          <span
            key={keyword}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${chipClassName}`}
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Section wrapper with a small heading. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * AtsScoreModal — runs and displays an ATS readiness analysis.
 *
 * Self-contained: it owns the request, the loading state, errors and retries,
 * so the dashboard and the editor can both drop it in. It only ever reads the
 * resume — closing it leaves the resume exactly as it was.
 */
export function AtsScoreModal({
  open,
  onClose,
  resumeId,
  resumeTitle,
  resume,
  onAnalyzed,
}: AtsScoreModalProps) {
  const [result, setResult] = useState<AtsScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Callers pass an inline callback, which would be a new function on every
  // render. Holding it in a ref keeps `analyze` stable so the open-effect below
  // fires once instead of re-analyzing in a loop.
  const onAnalyzedRef = useRef(onAnalyzed)
  /**
   * The editor's current content, read at request time.
   *
   * The server prefers this body over the stored resume so the score reflects
   * unsaved edits. `analyze` deliberately doesn't depend on it — a fresh
   * object every keystroke would re-run the analysis — so without a ref it
   * would send whatever the resume was when the callback was created, which
   * defeats the point of sending it at all.
   */
  const resumeRef = useRef(resume)
  useEffect(() => {
    onAnalyzedRef.current = onAnalyzed
  }, [onAnalyzed])

  useEffect(() => {
    resumeRef.current = resume
  }, [resume])

  /**
   * Guards against a second analysis while one is already in flight.
   *
   * A ref rather than the `loading` state on purpose: state updates are
   * asynchronous, so two calls in the same tick would both see `loading` as
   * false and both fire. This closes every duplicate path at once — React
   * StrictMode double-invoking the open effect in development, an impatient
   * double-click, and "Check again" pressed while the first request is still
   * running.
   */
  const inFlightRef = useRef(false)

  const analyze = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setError('')
    try {
      const analysis = await aiApi.atsScore(resumeId, resumeRef.current)
      setResult(analysis)
      onAnalyzedRef.current?.(analysis)
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "We couldn't analyze your resume right now. Please try again in a moment.",
        ),
      )
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
    // `resume` is a fresh object on every editor keystroke; depending on it
    // would re-run the analysis constantly, so it is read from a ref above.
    // The id is what identifies the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId])

  // Analyse once when the modal opens, and reset when it closes so reopening
  // starts clean rather than showing a stale score.
  useEffect(() => {
    if (!open) {
      setResult(null)
      setError('')
      return
    }
    void analyze()
  }, [open, analyze])

  const tone = result ? scoreTone(result.score) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ATS Resume Score"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {(result || error) && (
            <Button onClick={() => void analyze()} disabled={loading}>
              {loading ? 'Analyzing…' : 'Check again'}
            </Button>
          )}
        </>
      }
    >
      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        {resumeTitle && (
          <p className="-mt-1 truncate text-sm text-ink-muted">
            {resumeTitle}
            {result?.targeted && ' · scored against your job description'}
          </p>
        )}

        {/* ── Loading ── */}
        {loading && !result && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Spinner className="h-8 w-8" />
            <p className="text-sm font-medium text-ink">Analyzing your resume…</p>
            <p className="text-xs text-ink-subtle">
              Checking structure, keywords and completeness. This takes a few seconds.
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* ── Result ── */}
        {result && !error && (
          <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <div className="space-y-6">
              {/* Headline score */}
              <div className="flex flex-col items-center gap-5 rounded-xl border border-brand-100 bg-brand-gradient-soft px-5 py-6 text-center sm:flex-row sm:text-left">
                <ScoreRing score={result.score} />
                <div className="min-w-0">
                  <p className={`text-lg font-bold ${tone?.text}`}>{result.grade}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{result.summary}</p>
                </div>
              </div>

              {/* Category breakdown */}
              <Block title="Score breakdown">
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {CATEGORY_LABELS.map(({ key, label, hint }) => (
                    <CategoryRow
                      key={key}
                      label={label}
                      hint={hint}
                      score={result.categories[key]}
                    />
                  ))}
                </div>
              </Block>

              {/* Missing sections */}
              {result.missingSections.length > 0 && (
                <Block title="Missing from your resume">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900">
                      These standard sections are empty. Filling them in is usually the fastest way
                      to raise your score.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {result.missingSections.map((section) => (
                        <span
                          key={section}
                          className="rounded-md bg-white px-2.5 py-1 text-xs font-medium capitalize text-amber-800 ring-1 ring-amber-200"
                        >
                          {section}
                        </span>
                      ))}
                    </div>
                  </div>
                </Block>
              )}

              <div className="space-y-2">
                <FeedbackList
                  icon="💡"
                  title="Recommendations"
                  items={result.recommendations}
                  markerClassName="text-ink-muted marker:text-brand-400"
                  defaultOpen
                />
                <FeedbackList
                  icon="⚠️"
                  title="Issues to improve"
                  items={result.issues}
                  markerClassName="text-ink-muted marker:text-amber-500"
                />
                <FeedbackList
                  icon="✅"
                  title="Strengths"
                  items={result.strengths}
                  markerClassName="text-ink-muted marker:text-emerald-500"
                />
              </div>

              {/* Keywords */}
              {(result.keywords.present.length > 0 || result.keywords.recommended.length > 0) && (
                <Block title="Keywords">
                  <div className="space-y-4">
                    <KeywordChips
                      title="Present"
                      description="Found in your resume — an ATS can match on these."
                      items={result.keywords.present}
                      chipClassName="bg-brand-50 text-brand-700 ring-1 ring-brand-100"
                    />
                    <KeywordChips
                      title="Recommended"
                      description="Relevant to your field and not in your resume yet. Only add what's genuinely true of you."
                      items={result.keywords.recommended}
                      chipClassName="bg-white text-ink-muted ring-1 ring-slate-200"
                    />
                  </div>
                </Block>
              )}

              <p className="text-[11px] text-ink-subtle">
                This is an evaluation only — your resume hasn't been changed.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
