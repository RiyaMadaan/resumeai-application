import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRawReturnTo, useReturnTo, withReturnTo } from '@/lib/returnTo'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ToolPage, Panel, PanelHeader } from '@/components/layout/ToolPage'
import { SparkleIcon } from '@/components/ui/icons'
import { resumesApi } from '@/api/resumes.api'
import { coverLettersApi } from '@/api/coverLetters.api'
import { getApiErrorMessage } from '@/api/client'
import type { Resume } from '@/types/resume'

/** Matches the server's minimum, so the user is told before a round trip. */
const MIN_JOB_DESCRIPTION_LENGTH = 40

/**
 * NewCoverLetterPage — the inputs a cover letter is written from.
 *
 * Everything the AI is allowed to use comes from this screen: one of the
 * user's own resumes for the facts, and the job description for the target.
 * The record is created before the AI runs, so a failed generation never
 * costs the user their pasted job description.
 */
export function NewCoverLetterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const back = useReturnTo({ to: '/cover-letters', label: 'Back to cover letters' })
  // Passed to the letter we create, so its own Back leads to the same place.
  const origin = useRawReturnTo()

  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [resumeId, setResumeId] = useState(params.get('resume') ?? '')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    resumesApi
      .list()
      .then((list) => {
        if (!active) return
        setResumes(list)
        // Default to the most recently updated resume when none was passed in.
        setResumeId((current) => current || list[0]?._id || '')
      })
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load your resumes')))
    return () => {
      active = false
    }
  }, [])

  const trimmedJd = jobDescription.trim()
  const canGenerate =
    !!resumeId && trimmedJd.length >= MIN_JOB_DESCRIPTION_LENGTH && !generating

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError('')
    try {
      // Create first so the inputs are persisted even if the AI call fails.
      const letter = await coverLettersApi.create({
        resumeId,
        company: company.trim(),
        jobTitle: jobTitle.trim(),
        jobDescription: trimmedJd,
        title: [jobTitle.trim(), company.trim()].filter(Boolean).join(' at '),
      })
      try {
        await coverLettersApi.generate(letter._id, {})
        navigate(withReturnTo(`/cover-letters/${letter._id}`, origin))
      } catch (genErr) {
        // The record exists with the user's inputs — send them to it so they
        // can retry without re-entering anything.
        navigate(withReturnTo(`/cover-letters/${letter._id}`, origin), {
          state: { generationError: getApiErrorMessage(genErr, 'Could not write your cover letter') },
        })
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start your cover letter'))
      setGenerating(false)
    }
  }

  if (resumes === null && !error) return <LoadingState label="Loading your resumes…" fullscreen />

  return (
    <ToolPage
      back={back}
      title="Cover letter"
      description="Create a professional cover letter tailored to your resume. We only use experience you actually have."
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {resumes && resumes.length === 0 ? (
        <div>
          <EmptyState
            title="You'll need a resume first"
            description="A cover letter is written from your resume, so create one and come back."
            action={<Button onClick={() => navigate('/resume/new')}>Create a resume</Button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resume */}
          <Panel>
            <PanelHeader
              title="Which resume?"
              description="Its content is the only thing the letter can draw on."
            />
            <div className="space-y-2">
              {(resumes ?? []).map((resume) => (
                <label
                  key={resume._id}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ' +
                    (resumeId === resume._id
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-200')
                  }
                >
                  <input
                    type="radio"
                    name="resume"
                    value={resume._id}
                    checked={resumeId === resume._id}
                    onChange={() => setResumeId(resume._id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {resume.title}
                    </span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {resume.personalInfo?.fullName || 'No name yet'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Panel>

          {/* Target */}
          <Panel className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Northwind Technologies"
              hint="Optional — mentioned naturally if given."
            />
            <Input
              label="Job title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Senior Product Engineer"
              hint="Optional."
            />
          </Panel>

          {/* Job description */}
          <Panel>
            <Textarea
              label="Job description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              placeholder="Paste the full job description here…"
              hint={
                trimmedJd.length > 0 && trimmedJd.length < MIN_JOB_DESCRIPTION_LENGTH
                  ? `A little more, please — at least ${MIN_JOB_DESCRIPTION_LENGTH} characters.`
                  : 'The more complete this is, the better the letter matches.'
              }
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={handleGenerate} disabled={!canGenerate} aria-busy={generating}>
                <SparkleIcon width={16} height={16} />
                {generating ? 'Writing your letter…' : 'Generate cover letter'}
              </Button>
              <Button variant="ghost" onClick={() => navigate(back.to)}>
                Cancel
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </ToolPage>
  )
}
