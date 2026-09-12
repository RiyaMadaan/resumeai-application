import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageShell } from '@/components/layout/PageShell'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/LoadingState'
import { aiApi } from '@/api/ai.api'
import { getPreferredTemplate } from '@/lib/preferredTemplate'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import type { ResumeInput } from '@/types/resume'

const STORY_PLACEHOLDER =
  "I'm a frontend developer at SimpleDMCA since July 2025. Before that I was at Decabits " +
  'Software as a React.js developer. I know React, TypeScript and Node.js, and I built a ' +
  'healthcare app using React Native.'

/** Mirrors the server's bounds so the user hears about it before a round trip. */
const MIN_STORY_LENGTH = 20
const MAX_STORY_LENGTH = 5000

/** What the AI is doing, so a multi-second wait isn't a frozen screen. */
const PROGRESS_MESSAGES = [
  'Analyzing your information…',
  'Extracting experience, skills and other details…',
  'Writing your professional summary…',
]

/**
 * NewResumePage — the from-scratch entry point.
 *
 * The user writes about their career in plain language; the AI sorts it into
 * the right resume sections rather than dropping the whole paragraph into the
 * summary. If extraction fails, their words are kept as the summary and they
 * carry on editing by hand — the input is never lost.
 */
export function NewResumePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)

  const trimmedLength = story.trim().length

  // Walk the progress copy while the request is in flight.
  useEffect(() => {
    if (!submitting) {
      setProgressIndex(0)
      return
    }
    const timer = setInterval(
      () => setProgressIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)),
      2800,
    )
    return () => clearInterval(timer)
  }, [submitting])

  /** Create the resume and open the editor on it. */
  const createAndOpen = async (content: ResumeInput, extractionFailed: boolean) => {
    const resume = await resumesApi.create({
      title: title.trim() || 'Untitled Resume',
      // Whatever was picked in the template gallery, if anything.
      template: getPreferredTemplate(),
      ...content,
    })
    navigate(`/resume/${resume._id}`, {
      state: extractionFailed
        ? {
            generated: {
              failed: true,
              message:
                "We couldn't sort your description into sections just now, so we've kept your own words in the summary. You can edit everything below.",
            },
          }
        : { generated: { failed: false } },
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmed = story.trim()
    if (trimmed.length < MIN_STORY_LENGTH) {
      setError(
        `Tell us a little more — at least ${MIN_STORY_LENGTH} characters about your experience.`,
      )
      return
    }
    if (trimmed.length > MAX_STORY_LENGTH) {
      setError(
        `That's too long (${trimmedLength.toLocaleString()} of ${MAX_STORY_LENGTH.toLocaleString()} characters). Try summarising it.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const { resume } = await aiApi.generate(trimmed)
      await createAndOpen(resume, false)
    } catch (err) {
      // Extraction failed — keep what they wrote rather than losing it, and let
      // them continue in the editor.
      try {
        await createAndOpen({ summary: trimmed }, true)
      } catch (createErr) {
        setError(getApiErrorMessage(createErr, getApiErrorMessage(err, 'Could not create your resume')))
        setSubmitting(false)
      }
    }
  }

  return (
    <PageShell
      back={{ to: '/resume/new', label: 'Back' }}
      title="Tell us about your career"
      description="Write it however you like. We'll sort it into the right sections — and never add anything you didn't say."
    >

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Input
          label="Resume name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Frontend Developer — 2026"
          hint="Only you see this. You can rename it anytime."
          disabled={submitting}
        />

        <div>
          <label htmlFor="story" className="mb-1.5 block text-sm font-medium text-ink">
            Your experience
          </label>
          <textarea
            id="story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={STORY_PLACEHOLDER}
            rows={9}
            disabled={submitting}
            aria-describedby="story-hint"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p id="story-hint" className="text-xs text-ink-subtle">
              Mention where you've worked, what you know, and anything you've built or studied.
            </p>
            {trimmedLength > 0 && (
              <p
                className={
                  'text-xs tabular-nums ' +
                  (trimmedLength > MAX_STORY_LENGTH
                    ? 'font-medium text-red-600'
                    : 'text-ink-subtle')
                }
              >
                {trimmedLength.toLocaleString()} characters
              </p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {submitting && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-3"
          >
            <Spinner className="h-5 w-5" />
            <p className="text-sm font-medium text-ink">{PROGRESS_MESSAGES[progressIndex]}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Creating your resume…' : 'Create resume'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => navigate('/dashboard')}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </PageShell>
  )
}
