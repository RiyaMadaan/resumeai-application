import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Stepper } from '@/components/ui/Stepper'
import { LoadingState } from '@/components/ui/LoadingState'
import { ResumePreview } from '@/components/resume/ResumePreview'
import { TemplateGallery } from '@/components/resume/TemplateGallery'
import {
  ResumeSectionsEditor,
  type ResumeSectionId,
  type ResumeSections,
} from '@/components/resume/ResumeSectionsEditor'
import { SkillsInput } from '@/components/resume/SkillsInput'
import { resumesApi } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import { getTemplate } from '@/templates/catalog'
import { getPreferredTemplate } from '@/lib/preferredTemplate'
import { emptyPersonalInfo } from '@/types/resume'

/** How long after the last change before progress is saved. */
const AUTOSAVE_DELAY_MS = 1200

/**
 * The steps, derived from the resume schema this app already has.
 *
 * There is deliberately no "Languages" or "Additional information" step: the
 * resume model has no field for either, and inventing one would mean data the
 * templates, PDF export, ATS check and job customization all know nothing
 * about. Everything here maps onto a field that already round-trips through
 * the whole app.
 */
type StepId =
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'template'
  | 'review'

interface StepDef {
  id: StepId
  label: string
  title: string
  description: string
  /** The section of the shared sections editor this step renders, if any. */
  section?: ResumeSectionId
}

const STEPS: StepDef[] = [
  {
    id: 'personal',
    label: 'Personal',
    title: 'Personal details',
    description: 'How employers reach you. Only your name really matters here.',
    section: 'personal',
  },
  {
    id: 'summary',
    label: 'Summary',
    title: 'Professional summary',
    description: 'Two or three sentences on who you are and what you do.',
  },
  {
    id: 'experience',
    label: 'Experience',
    title: 'Work experience',
    description: 'Your roles, most recent first. Add a few bullet points for each.',
    section: 'experience',
  },
  {
    id: 'education',
    label: 'Education',
    title: 'Education',
    description: 'Degrees, diplomas and qualifications.',
    section: 'education',
  },
  {
    id: 'skills',
    label: 'Skills',
    title: 'Skills',
    description: 'The tools and abilities you want to be found for.',
  },
  {
    id: 'projects',
    label: 'Projects',
    title: 'Projects',
    description: 'Optional — work worth showing that sits outside a job.',
    section: 'projects',
  },
  {
    id: 'certifications',
    label: 'Certificates',
    title: 'Certifications',
    description: 'Optional — one per line.',
    section: 'certifications',
  },
  {
    id: 'template',
    label: 'Design',
    title: 'Choose a template',
    description: 'Your content stays exactly as it is — only the design changes.',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Review and finish',
    description: 'Everything looks right? Open the full editor to keep refining.',
  },
]

const emptySections: ResumeSections = {
  personalInfo: emptyPersonalInfo,
  experience: [],
  education: [],
  projects: [],
  certifications: [],
}

/** Drop the blank lines the multi-line fields collect while you type. */
function tidySections(sections: ResumeSections): ResumeSections {
  return {
    ...sections,
    experience: sections.experience.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((b) => b.trim()).filter(Boolean),
    })),
    certifications: sections.certifications.map((c) => c.trim()).filter(Boolean),
  }
}

/**
 * BuilderPage — the step-by-step resume builder.
 *
 * The difference from a conventional builder is that the preview is never
 * deferred to the end: it sits beside the form from the first keystroke and
 * updates as you type, in the template you have chosen.
 *
 * It writes to exactly the same resume records as the AI flows — same schema,
 * same preview component, same templates — so a resume started here can be
 * continued in the AI editor, tailored to a job, or ATS-checked without
 * conversion. The resume is created once, on the first autosave, and updated
 * from then on, so moving between steps never produces duplicates.
 */
export function BuilderPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [resumeId, setResumeId] = useState(routeId ?? '')
  const [loading, setLoading] = useState(!!routeId)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const [title, setTitle] = useState('Untitled Resume')
  const [summary, setSummary] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [sections, setSections] = useState<ResumeSections>(emptySections)
  const [template, setTemplate] = useState(getPreferredTemplate)

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')

  /** Skips the autosave that loading an existing resume would otherwise cause. */
  const hydrated = useRef(!routeId)
  /** Guards against two in-flight creates racing into duplicate resumes. */
  const creating = useRef(false)
  /**
   * Ids whose content is already in local state.
   *
   * Creating the resume puts its id in the URL, which would otherwise trip the
   * loader below and overwrite what the user is typing with the copy the
   * server just received. Recording the id first makes that a no-op.
   */
  const loadedId = useRef<string | null>(null)

  /* ── Load an in-progress resume ─────────────────────────────────────────── */
  useEffect(() => {
    if (!routeId || loadedId.current === routeId) return
    loadedId.current = routeId
    let active = true
    resumesApi
      .get(routeId)
      .then((data) => {
        if (!active) return
        setTitle(data.title)
        setSummary(data.summary)
        setSkills(data.skills ?? [])
        setTemplate(data.template)
        setSections({
          personalInfo: { ...emptyPersonalInfo, ...data.personalInfo },
          experience: data.experience ?? [],
          education: data.education ?? [],
          projects: data.projects ?? [],
          certifications: data.certifications ?? [],
        })
      })
      .catch((err) => active && setError(getApiErrorMessage(err, 'Could not load this resume')))
      .finally(() => {
        if (!active) return
        setLoading(false)
        hydrated.current = true
      })
    return () => {
      active = false
    }
  }, [routeId])

  /** A live view of the resume, exactly as the preview and PDF will see it. */
  const draft = useMemo(
    () => ({
      title,
      summary,
      skills,
      template,
      ...sections,
    }),
    [title, summary, skills, template, sections],
  )

  /** True once there is anything worth persisting — avoids empty resumes. */
  const hasContent = useMemo(() => {
    const p = sections.personalInfo
    return Boolean(
      p.fullName.trim() ||
        p.email.trim() ||
        p.phone.trim() ||
        summary.trim() ||
        skills.length > 0 ||
        sections.experience.length > 0 ||
        sections.education.length > 0 ||
        sections.projects.length > 0 ||
        sections.certifications.some((c) => c.trim()),
    )
  }, [sections, summary, skills])

  const persist = useCallback(async () => {
    if (!hasContent || creating.current) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: title.trim() || 'Untitled Resume',
        summary,
        skills,
        template,
        ...tidySections(sections),
      }
      if (resumeId) {
        await resumesApi.update(resumeId, payload)
      } else {
        creating.current = true
        try {
          const created = await resumesApi.create(payload)
          // Claim the id before it reaches the URL, so the loader skips it.
          loadedId.current = created._id
          setResumeId(created._id)
          // Put the id in the URL so a refresh reopens the same resume rather
          // than starting a second one.
          navigate(`/resume/builder/${created._id}`, { replace: true })
        } finally {
          creating.current = false
        }
      }
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your progress'))
    } finally {
      setSaving(false)
    }
  }, [hasContent, title, summary, skills, template, sections, resumeId, navigate])

  /** Debounced autosave — one request per pause, not one per keystroke. */
  useEffect(() => {
    if (loading || !hydrated.current || !hasContent) return
    const timer = setTimeout(persist, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [persist, loading, hasContent])

  const updateSections = (patch: Partial<ResumeSections>) =>
    setSections((current) => ({ ...current, ...patch }))

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, index))
    setStep(next)
    setFurthest((f) => Math.max(f, next))
    setMobileTab('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFinish = async () => {
    await persist()
    if (resumeId) navigate(`/resume/${resumeId}`)
  }

  if (loading) return <LoadingState label="Loading your resume…" fullscreen />

  const current = STEPS[step]

  /* ── The current step's form ────────────────────────────────────────────── */
  let stepBody: React.ReactNode
  if (current.section) {
    stepBody = (
      <ResumeSectionsEditor
        value={sections}
        onChange={updateSections}
        only={[current.section]}
        alwaysOpen
      />
    )
  } else if (current.id === 'summary') {
    stepBody = (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <Input
          label="Resume name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          hint="Only you see this — it isn't printed on the resume."
        />
        <Textarea
          label="Professional summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={7}
          placeholder="Senior product engineer with eight years building customer-facing web applications…"
          hint="Optional, but it's the first thing most people read."
        />
      </div>
    )
  } else if (current.id === 'skills') {
    stepBody = (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <SkillsInput value={skills} onChange={setSkills} />
      </div>
    )
  } else if (current.id === 'template') {
    stepBody = (
      <TemplateGallery selectedId={template} onSelect={setTemplate} previewResume={draft} />
    )
  } else {
    // Review
    const rows: { label: string; value: string }[] = [
      { label: 'Name', value: sections.personalInfo.fullName || 'Not set' },
      { label: 'Contact', value: [sections.personalInfo.email, sections.personalInfo.phone].filter(Boolean).join(' · ') || 'Not set' },
      { label: 'Summary', value: summary.trim() ? `${summary.trim().split(/\s+/).length} words` : 'Not written' },
      { label: 'Experience', value: `${sections.experience.length} ${sections.experience.length === 1 ? 'position' : 'positions'}` },
      { label: 'Education', value: `${sections.education.length} ${sections.education.length === 1 ? 'entry' : 'entries'}` },
      { label: 'Skills', value: `${skills.length} listed` },
      { label: 'Projects', value: `${sections.projects.length} listed` },
      { label: 'Certifications', value: `${sections.certifications.filter(Boolean).length} listed` },
      { label: 'Template', value: getTemplate(template).name },
    ]
    stepBody = (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-1">
        <dl>
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-6 border-b border-slate-100 py-3 last:border-0"
            >
              <dt className="text-sm text-ink-muted">{row.label}</dt>
              <dd className="truncate text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  const editor = (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{current.title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{current.description}</p>
      </div>

      {stepBody}

      {/* Navigation */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={step === 0}>
          ← Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {step < STEPS.length - 1 && (
            <Button variant="ghost" onClick={() => goTo(STEPS.length - 1)}>
              Skip to review
            </Button>
          )}
          {step === STEPS.length - 1 ? (
            <Button onClick={handleFinish} disabled={!resumeId && !hasContent}>
              Open full editor →
            </Button>
          ) : (
            <Button onClick={() => goTo(step + 1)}>Continue →</Button>
          )}
        </div>
      </div>
    </div>
  )

  /* ── The always-visible preview ─────────────────────────────────────────── */
  const preview = (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Live preview</h2>
        <span className="text-xs text-ink-subtle">{getTemplate(template).name}</span>
      </div>
      <div className="flex-1 overflow-auto rounded-xl bg-slate-100/80 p-4 sm:p-6">
        <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
          <div className="shadow-card">
            <ResumePreview resume={draft} template={template} />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Container className="py-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="self-start text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
        >
          ← Save and exit
        </button>
        <span className="text-xs text-ink-subtle" role="status">
          {saving
            ? 'Saving…'
            : savedAt
              ? `Progress saved at ${savedAt}`
              : 'Your progress saves automatically'}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Progress — completed steps are clickable. */}
      <div className="mt-5 overflow-x-auto pb-1">
        <Stepper
          steps={STEPS.map((s) => s.label)}
          current={step}
          maxReached={furthest}
          onSelect={goTo}
          className="min-w-[640px]"
        />
      </div>

      {/* Mobile: the preview is a tab away rather than squeezed alongside. */}
      <div className="mt-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 lg:hidden">
        {(['edit', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            aria-pressed={mobileTab === tab}
            className={
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
              (mobileTab === tab ? 'bg-brand-50 text-brand-700' : 'text-ink-muted')
            }
          >
            {tab === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div
        className={
          'mt-5 grid gap-6 lg:items-start ' +
          // The template step needs the full width for its gallery.
          (current.id === 'template'
            ? 'lg:grid-cols-1'
            : 'lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]')
        }
      >
        <div className={mobileTab === 'edit' ? '' : 'hidden lg:block'}>{editor}</div>
        {current.id !== 'template' && (
          <div className={mobileTab === 'preview' ? '' : 'hidden lg:block'}>
            <div className="lg:sticky lg:top-24">{preview}</div>
          </div>
        )}
      </div>
    </Container>
  )
}
