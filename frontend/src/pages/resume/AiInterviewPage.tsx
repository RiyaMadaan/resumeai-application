import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ToolPage } from '@/components/layout/ToolPage'
import { useReturnTo } from '@/lib/returnTo'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingState, Spinner } from '@/components/ui/LoadingState'
import { ResumePreview } from '@/components/resume/ResumePreview'
import { aiApi, type AiInterviewResult, type InterviewMessage } from '@/api/ai.api'
import { getPreferredTemplate } from '@/lib/preferredTemplate'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import type { Resume, ResumeInput } from '@/types/resume'

/** The interviewer's opening line — sent before the AI is involved at all. */
const RESUME_OPENING_QUESTION =
  "Let's start with your current or most recent role. What do you do, where do you work, and what kind of work do you handle?"

const INTRO =
  "Hi! I'll help you build your resume by asking you a few questions. Answer naturally — " +
  "you don't need to write professional resume content. I'll organize everything into the right sections."

/** Where an in-progress interview is kept so a refresh doesn't lose it. */
const STORAGE_KEY = 'resumeai_interview'

interface StoredInterview {
  messages: InterviewMessage[]
  draft: ResumeInput | null
  covered: string[]
  missing: string[]
  readyToGenerate: boolean
}

function loadStored(): StoredInterview | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredInterview
    return Array.isArray(parsed.messages) && parsed.messages.length > 0 ? parsed : null
  } catch {
    return null
  }
}

/** One chat bubble. */
function Bubble({ message }: { message: InterviewMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          'max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ' +
          (isUser
            ? 'bg-brand-600 text-white'
            : 'border border-slate-200 bg-white text-ink')
        }
      >
        {message.content}
      </div>
    </div>
  )
}

/** Section chips: what's been gathered so far. */
function Progress({ covered, missing }: { covered: string[]; missing: string[] }) {
  if (covered.length === 0 && missing.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-subtle">
        Building your resume · {covered.length} {covered.length === 1 ? 'section' : 'sections'}
      </span>
      {covered.map((section) => (
        <span
          key={section}
          className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          {section} ✓
        </span>
      ))}
      {missing.map((section) => (
        <span
          key={section}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-ink-subtle"
        >
          {section}
        </span>
      ))}
    </div>
  )
}

/**
 * AiInterviewPage — build a resume by answering questions instead of filling a
 * form.
 *
 * The conversation and the structured draft live here and are sent back to the
 * server each turn, matching how the rest of the AI features work: the server
 * holds no interview state, so there is nothing to own and nothing to leak. The
 * draft doubles as the memory that stops the interviewer repeating itself.
 *
 * Nothing is saved until the user reviews the result and applies it, at which
 * point the normal create-resume endpoint does the work and the normal editor
 * takes over.
 */
export function AiInterviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  /** When present, the interview continues this resume instead of creating one. */
  const resumeId = searchParams.get('resume') ?? ''
  // Opened from a resume, Back belongs to that resume.
  const back = useReturnTo({
    to: resumeId ? `/resume/${resumeId}` : '/resume/new',
    label: resumeId ? 'Back to resume' : 'Back',
  })

  const [loadingResume, setLoadingResume] = useState(Boolean(resumeId))
  const [stage, setStage] = useState<'chat' | 'review'>('chat')
  const [messages, setMessages] = useState<InterviewMessage[]>([
    { role: 'assistant', content: RESUME_OPENING_QUESTION },
  ])
  const [draft, setDraft] = useState<ResumeInput | null>(null)
  const [covered, setCovered] = useState<string[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [readyToGenerate, setReadyToGenerate] = useState(false)
  const [answer, setAnswer] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [restored, setRestored] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** The answer that failed, so "Try again" doesn't need it retyped. */
  const lastAnswerRef = useRef('')

  /**
   * Where the conversation comes from when the page opens.
   *
   * Continuing an existing resume reads the transcript and content the server
   * has stored, which is what makes the interview survive a logout or a new
   * device. A brand-new interview has no resume yet, so it falls back to the
   * browser-local copy that guards against an accidental refresh.
   */
  useEffect(() => {
    if (!resumeId) {
      const stored = loadStored()
      if (!stored) return
      setMessages(stored.messages)
      setDraft(stored.draft)
      setCovered(stored.covered ?? [])
      setMissing(stored.missing ?? [])
      setReadyToGenerate(Boolean(stored.readyToGenerate))
      setRestored(true)
      return
    }

    let active = true
    resumesApi
      .get(resumeId)
      .then((resume) => {
        if (!active) return
        setTitle(resume.title)
        // The saved resume IS the draft — the interviewer reads it to know
        // what has already been covered.
        setDraft({
          personalInfo: resume.personalInfo,
          summary: resume.summary,
          experience: resume.experience,
          education: resume.education,
          skills: resume.skills,
          projects: resume.projects,
          certifications: resume.certifications,
        })
        const saved = resume.aiInterview?.messages ?? []
        if (saved.length > 0) {
          setMessages(saved)
          setRestored(true)
        } else {
          setMessages([{ role: 'assistant', content: RESUME_OPENING_QUESTION }])
        }
      })
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load this resume')))
      .finally(() => active && setLoadingResume(false))
    return () => {
      active = false
    }
  }, [resumeId])

  // Keep the browser copy in step — but only while there is no resume to
  // attach the conversation to, since the server is the better home for it.
  useEffect(() => {
    if (resumeId) return
    if (messages.length <= 1 && !draft) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages, draft, covered, missing, readyToGenerate }),
      )
    } catch {
      // A full or unavailable store only costs the refresh-safety net.
    }
  }, [resumeId, messages, draft, covered, missing, readyToGenerate])

  // Follow the conversation as it grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const send = useCallback(
    async (text: string, history: InterviewMessage[]) => {
      setThinking(true)
      setError('')
      try {
        const result: AiInterviewResult = await aiApi.interview(
          history,
          draft ?? undefined,
          resumeId || undefined,
        )
        setMessages([...history, { role: 'assistant', content: result.message }])
        setDraft(result.draft)
        setCovered(result.covered)
        setMissing(result.missing)
        setReadyToGenerate(result.readyToGenerate)
        lastAnswerRef.current = ''
      } catch (err) {
        // Keep the conversation intact — only the failed turn is retried.
        lastAnswerRef.current = text
        setError(
          getApiErrorMessage(
            err,
            'Something went wrong while generating the next response. Please try again.',
          ),
        )
      } finally {
        setThinking(false)
      }
    },
    [draft, resumeId],
  )

  const handleSend = () => {
    const text = answer.trim()
    if (!text || thinking) return
    const history: InterviewMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setAnswer('')
    void send(text, history)
  }

  const handleRetry = () => {
    // The user's answer is already the last message; just re-run the turn.
    void send(lastAnswerRef.current, messages)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /** Turn the draft into a real resume and hand over to the editor. */
  const applyToResume = async () => {
    if (!draft || creating) return
    setCreating(true)
    setError('')
    try {
      const resume = resumeId
        ? // Continuing: update the resume in place so the id never changes.
          await resumesApi.update(resumeId, {
            title: title.trim() || undefined,
            ...draft,
          })
        : // New: record that this resume came from an interview, and keep the
          // transcript with it so it can be continued later.
          await resumesApi.create({
            title: title.trim() || draft.experience?.[0]?.role || 'Untitled Resume',
            template: getPreferredTemplate(),
            ...draft,
            creationMethod: 'ai-interview',
            aiInterview: { status: 'in-progress', messages },
          })
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Not being able to clear the draft is harmless.
      }
      navigate(`/resume/${resume._id}`, {
        state: {
          generated: {
            failed: false,
            message: resumeId
              ? 'Your answers have been added. Review the sections, then save.'
              : 'Built from your interview. Review the sections, then save.',
          },
        },
      })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create your resume'))
      setCreating(false)
    }
  }

  /** Leaving: back to the resume when continuing, else to the create screen. */
  const discard = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do — the interview is being abandoned anyway.
    }
    navigate(resumeId ? `/resume/${resumeId}` : '/resume/new')
  }

  if (loadingResume) return <LoadingState label="Loading your resume…" fullscreen />

  /* ── Review ── */
  if (stage === 'review' && draft) {
    return (
      <Container className="max-w-3xl py-8 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Your resume is ready</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Everything here came from your answers. You can edit all of it after applying.
        </p>

        {missing.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">A few sections are still empty:</p>
            <p className="mt-1">{missing.join(' · ')}</p>
            <p className="mt-1.5 text-amber-900/80">
              You can go back and add them, or apply now and fill them in the editor.
            </p>
          </div>
        )}

        <div className="mt-6">
          <Input
            label="Resume name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={draft.experience?.[0]?.role || 'e.g. Frontend Developer — 2026'}
            hint="Only you see this. You can rename it anytime."
          />
        </div>

        <div className="mt-6 rounded-xl bg-slate-100/80 p-4 sm:p-6">
          <div className="shadow-card">
            <ResumePreview resume={draft} template="classic" />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={applyToResume} disabled={creating} aria-busy={creating}>
            {creating ? 'Saving…' : resumeId ? 'Apply to this resume' : 'Apply to resume'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setStage('chat')}
            disabled={creating}
          >
            Back to interview
          </Button>
        </div>
      </Container>
    )
  }

  /* ── Chat ── */
  return (
    <ToolPage
      back={back}
      title={resumeId ? 'Continue resume interview' : 'Resume interview'}
      description="Practice real interview questions and answer in your own words — I'll turn it into a resume."
      aside={
        <Button variant="ghost" size="sm" onClick={discard} disabled={thinking || creating}>
          Cancel
        </Button>
      }
    >
      {restored && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-ink-muted"
        >
          {resumeId
            ? 'Picked up where you left off — I already have what is on your resume.'
            : 'Picked up where you left off.'}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        {/* Intro */}
        <div className="border-b border-slate-100 bg-brand-gradient-soft px-4 py-3">
          <p className="text-sm leading-relaxed text-ink-muted">{INTRO}</p>
        </div>

        {/* Transcript */}
        <div className="max-h-[52vh] min-h-[18rem] space-y-3 overflow-y-auto bg-slate-50/60 p-4">
          {messages.map((message, i) => (
            <Bubble key={i} message={message} />
          ))}

          {thinking && (
            <div className="flex justify-start" role="status" aria-live="polite">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-ink-muted">Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <p>{error}</p>
              <Button size="sm" variant="secondary" className="mt-2" onClick={handleRetry}>
                Try again
              </Button>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-slate-100 p-3">
          <label htmlFor="interview-answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="interview-answer"
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type your answer…"
            disabled={thinking}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-subtle">Enter to send · Shift + Enter for a new line</span>
            <Button size="sm" onClick={handleSend} disabled={thinking || !answer.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Progress covered={covered} missing={missing} />
      </div>

      {/* Once there is enough, offer the way out — without ending the chat. */}
      {readyToGenerate && draft && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-3">
          <p className="text-sm text-ink">
            <span aria-hidden className="mr-1.5 text-brand-500">
              ✦
            </span>
            I have enough to build your resume
            {covered.length > 0 ? `: ${covered.join(', ')}.` : '.'}
          </p>
          {missing.length > 0 && (
            <p className="mt-1 text-xs text-ink-muted">
              Still empty: {missing.join(', ')}. Keep going to fill them in, or generate now.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setStage('review')}>
              Generate resume
            </Button>
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.focus()}>
              Continue interview
            </Button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}

/** The preview accepts either shape; the draft is resume content, not a saved resume. */
export type InterviewDraft = ResumeInput | Resume
