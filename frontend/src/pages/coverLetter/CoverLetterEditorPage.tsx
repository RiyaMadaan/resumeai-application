import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useReturnTo } from '@/lib/returnTo'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Collapsible } from '@/components/ui/Collapsible'
import { coverLettersApi } from '@/api/coverLetters.api'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import type { CoverLetter, CoverLetterRefinement } from '@/types/coverLetter'
import type { Resume } from '@/types/resume'

/** How long to wait after typing stops before saving. */
const AUTOSAVE_DELAY_MS = 1200

/** The AI refinements offered above the editor. */
const REFINEMENTS: { key: CoverLetterRefinement; label: string; busy: string }[] = [
  { key: 'improve', label: 'Improve', busy: 'Improving…' },
  { key: 'concise', label: 'Make concise', busy: 'Shortening…' },
  { key: 'professional', label: 'More professional', busy: 'Adjusting tone…' },
]

/** Split the body into paragraphs, exactly as the PDF does. */
function paragraphsOf(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * CoverLetterEditorPage — edit, refine, preview and export one letter.
 *
 * The text is the user's: typing never triggers a regeneration, and the AI
 * actions are all explicit. Edits autosave on a debounce so a letter is never
 * lost, while generation and refinement stay deliberate, one-click operations.
 */
export function CoverLetterEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // A letter written from a resume leads back to that resume; one opened from
  // the list leads back to the list.
  const back = useReturnTo({ to: '/cover-letters', label: 'Back to cover letters' })

  const [letter, setLetter] = useState<CoverLetter | null>(null)
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Editable fields.
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState<'generate' | CoverLetterRefinement | null>(null)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  // Skips the autosave that would otherwise fire from simply loading the letter.
  const hydrated = useRef(false)

  useEffect(() => {
    if (!id) return
    let active = true
    coverLettersApi
      .get(id)
      .then(async (data) => {
        if (!active) return
        setLetter(data)
        setBody(data.body)
        setTitle(data.title)
        setCompany(data.company)
        setJobTitle(data.jobTitle)
        setJobDescription(data.jobDescription)
        // The resume supplies the sender details on the PDF. A deleted resume
        // is not an error — the letter still reads and exports fine without it.
        if (data.resumeId) {
          try {
            const linked = await resumesApi.get(data.resumeId)
            if (active) setResume(linked)
          } catch {
            /* The letter stands on its own. */
          }
        }
      })
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load this cover letter')))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  /** A generation failure handed over from the setup page. */
  useEffect(() => {
    const state = location.state as { generationError?: string } | null
    if (!state?.generationError) return
    setError(state.generationError)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const persist = useCallback(async () => {
    if (!id) return
    setSaving(true)
    try {
      await coverLettersApi.update(id, { body, title, company, jobTitle, jobDescription })
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your changes'))
    } finally {
      setSaving(false)
    }
  }, [id, body, title, company, jobTitle, jobDescription])

  /**
   * Autosave. Debounced so a burst of typing is one request, not one per
   * keystroke — and deliberately not a regeneration: editing the text never
   * calls the AI.
   */
  useEffect(() => {
    if (loading || !letter) return
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    const timer = setTimeout(persist, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [persist, loading, letter])

  const handleGenerate = async () => {
    if (!id || working) return
    setWorking('generate')
    setError('')
    try {
      const updated = await coverLettersApi.generate(id, {
        company,
        jobTitle,
        jobDescription,
        resumeId: letter?.resumeId,
      })
      setLetter(updated)
      setBody(updated.body)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not write your cover letter'))
    } finally {
      setWorking(null)
    }
  }

  const handleRefine = async (refinement: CoverLetterRefinement) => {
    if (!id || working || !body.trim()) return
    setWorking(refinement)
    setError('')
    try {
      // Send the text on screen, which may include unsaved hand edits.
      const updated = await coverLettersApi.refine(id, refinement, body)
      setLetter(updated)
      setBody(updated.body)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update your cover letter'))
    } finally {
      setWorking(null)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Your browser blocked copying. Select the text and copy it manually.')
    }
  }

  const handleDownload = async () => {
    if (exporting || !body.trim()) return
    setExporting(true)
    setError('')
    try {
      // Lazy-loaded so the PDF library is only fetched on first export.
      const { downloadCoverLetterPdf } = await import('@/lib/downloadCoverLetterPdf')
      await downloadCoverLetterPdf({
        body,
        company,
        jobTitle,
        title,
        personalInfo: resume?.personalInfo,
      })
    } catch {
      setError('Sorry, we could not generate your PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const paragraphs = useMemo(() => paragraphsOf(body), [body])
  const wordCount = useMemo(
    () => body.trim().split(/\s+/).filter(Boolean).length,
    [body],
  )

  if (loading) return <LoadingState label="Loading your cover letter…" fullscreen />

  if (error && !letter) {
    return (
      <Container className="py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
        <Button variant="secondary" className="mt-6" onClick={() => navigate(back.to)}>
          ← {back.label}
        </Button>
      </Container>
    )
  }

  const busy = working !== null

  /* ── The editing pane ── */
  const editor = (
    <div className="space-y-3">
      <Collapsible
        title="What this letter targets"
        summary={[jobTitle, company].filter(Boolean).join(' at ') || 'Not set'}
      >
        <div className="space-y-3">
          <Input
            label="Letter name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            hint="Only you see this."
          />
          <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <Input label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          <Textarea
            label="Job description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={7}
            hint="Editing this changes what a regenerate writes against."
          />
        </div>
      </Collapsible>

      {/* AI actions — every one of them explicit. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">AI actions</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Each one rewrites the letter using only your resume. Your edits are never overwritten
          automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleGenerate} disabled={busy} aria-busy={working === 'generate'}>
            {working === 'generate'
              ? 'Writing…'
              : letter?.generatedAt
                ? 'Regenerate'
                : 'Generate'}
          </Button>
          {REFINEMENTS.map((action) => (
            <Button
              key={action.key}
              size="sm"
              variant="secondary"
              onClick={() => handleRefine(action.key)}
              disabled={busy || !body.trim()}
              aria-busy={working === action.key}
            >
              {working === action.key ? action.busy : action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* The letter itself */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Your letter</h2>
          <span className="text-xs text-ink-subtle">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </div>
        <Textarea
          label=""
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={18}
          className="mt-2 font-normal"
          placeholder="Your cover letter will appear here once generated — or write it yourself."
          hint="Separate paragraphs with a blank line. Edits save automatically."
        />
      </div>
    </div>
  )

  /* ── The preview pane: the letter as it will be exported ── */
  const preview = (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Preview</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!body.trim()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={exporting || !body.trim()} aria-busy={exporting}>
            {exporting ? 'Preparing PDF…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl bg-slate-100/80 p-4 sm:p-6">
        <article className="mx-auto w-full max-w-[720px] bg-white p-8 text-ink shadow-sm ring-1 ring-slate-200 sm:p-10">
          {(resume?.personalInfo?.fullName || resume?.personalInfo?.email) && (
            <header className="mb-6 border-b border-slate-200 pb-4">
              {resume?.personalInfo?.fullName && (
                <p className="text-lg font-bold tracking-tight">{resume.personalInfo.fullName}</p>
              )}
              <p className="mt-1 text-sm text-ink-muted">
                {[resume?.personalInfo?.email, resume?.personalInfo?.phone, resume?.personalInfo?.location]
                  .filter(Boolean)
                  .join('  ·  ')}
              </p>
            </header>
          )}

          {company && <p className="text-sm font-semibold">{company}</p>}
          {jobTitle && <p className="mt-0.5 text-sm text-ink-muted">Re: {jobTitle}</p>}

          <p className="mt-5 text-sm">Dear Hiring Manager,</p>

          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, i) => (
              <p key={i} className="mt-3.5 text-sm leading-relaxed text-ink-muted">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="mt-3.5 text-sm italic text-ink-subtle">
              Nothing written yet. Use Generate to draft it from your resume.
            </p>
          )}

          <p className="mt-6 text-sm">Sincerely,</p>
          {resume?.personalInfo?.fullName && (
            <p className="mt-3 text-sm font-semibold">{resume.personalInfo.fullName}</p>
          )}
        </article>
      </div>
    </div>
  )

  return (
    <Container className="py-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate(back.to)}
          className="self-start text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
        >
          ← {back.label}
        </button>
        <span className="text-xs text-ink-subtle" role="status">
          {saving ? 'Saving…' : savedAt ? `Saved at ${savedAt}` : ''}
        </span>
      </div>

      {error && letter && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Mobile: the two panes become tabs. */}
      <div className="mt-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 lg:hidden">
        {(['edit', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            aria-pressed={mobileTab === tab}
            className={
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ' +
              (mobileTab === tab ? 'bg-brand-50 text-brand-700' : 'text-ink-muted')
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start">
        <div className={mobileTab === 'edit' ? '' : 'hidden lg:block'}>{editor}</div>
        <div className={mobileTab === 'preview' ? '' : 'hidden lg:block'}>
          <div className="lg:sticky lg:top-24">{preview}</div>
        </div>
      </div>
    </Container>
  )
}
