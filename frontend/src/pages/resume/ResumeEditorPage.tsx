import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { ResumePreview } from '@/components/resume/ResumePreview'
import { AiToolsPanel } from '@/components/resume/AiToolsPanel'
import {
  JobCustomizeReview,
  type CustomizeSelection,
} from '@/components/resume/JobCustomizeReview'
import { AtsScoreModal } from '@/components/resume/AtsScoreModal'
import {
  ResumeSectionsEditor,
  type ResumeSectionId,
  type ResumeSections,
} from '@/components/resume/ResumeSectionsEditor'
import { SkillsInput } from '@/components/resume/SkillsInput'
import { TemplateGallery } from '@/components/resume/TemplateGallery'
import { TemplateThumbnail } from '@/templates/TemplateThumbnail'
import { Modal } from '@/components/ui/Modal'
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu'
import {
  BriefcaseIcon,
  CertificateIcon,
  FolderIcon,
  GaugeIcon,
  GraduationIcon,
  LayoutIcon,
  MailIcon,
  SparkleIcon,
  StarIcon,
  TargetIcon,
  TextIcon,
  UserIcon,
  ChatIcon,
} from '@/components/ui/icons'
import { withReturnTo } from '@/lib/returnTo'
import { getTemplate } from '@/templates/catalog'
import { resumesApi, type ImportSummary } from '@/api/resumes.api'
import { getApiErrorMessage } from '@/api/client'
import type { AiCustomizeResult } from '@/api/ai.api'
import { emptyPersonalInfo, type Resume, type TemplateVariant } from '@/types/resume'

/** An empty, well-formed set of sections for a resume that hasn't loaded yet. */
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

/** How long after the last edit before the resume is saved. */
const AUTOSAVE_DELAY_MS = 1200

/**
 * The editor's sections, in the order the sidebar lists them.
 *
 * These mirror the step-by-step builder's steps (minus Review, which is a
 * builder concept), so moving between the two experiences feels like the same
 * resume seen two ways rather than two different products. `section` names the
 * part of the shared `ResumeSectionsEditor` to render, where there is one.
 */
type EditorSectionId =
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'design'

interface EditorSectionDef {
  id: EditorSectionId
  label: string
  title: string
  description: string
  section?: ResumeSectionId
  Icon: (props: { width?: number; height?: number }) => React.ReactElement
}

const EDITOR_SECTIONS: EditorSectionDef[] = [
  {
    id: 'personal',
    Icon: UserIcon,
    label: 'Personal',
    title: 'Personal details',
    description: 'Your name and how employers reach you.',
    section: 'personal',
  },
  {
    id: 'summary',
    Icon: TextIcon,
    label: 'Summary',
    title: 'Professional summary',
    description: 'Two or three sentences on who you are and what you do.',
  },
  {
    id: 'experience',
    Icon: BriefcaseIcon,
    label: 'Experience',
    title: 'Work experience',
    description: 'Your roles, most recent first.',
    section: 'experience',
  },
  {
    id: 'education',
    Icon: GraduationIcon,
    label: 'Education',
    title: 'Education',
    description: 'Degrees, diplomas and qualifications.',
    section: 'education',
  },
  {
    id: 'skills',
    Icon: StarIcon,
    label: 'Skills',
    title: 'Skills',
    description: 'The tools and abilities you want to be found for.',
  },
  {
    id: 'projects',
    Icon: FolderIcon,
    label: 'Projects',
    title: 'Projects',
    description: 'Work worth showing that sits outside a job.',
    section: 'projects',
  },
  {
    id: 'certifications',
    Icon: CertificateIcon,
    label: 'Certificates',
    title: 'Certifications',
    description: 'One per line.',
    section: 'certifications',
  },
  {
    id: 'design',
    Icon: LayoutIcon,
    label: 'Design',
    title: 'Template',
    description: 'Only the presentation changes — every field stays as it is.',
  },
]

/**
 * ResumeEditorPage — the live editor.
 *
 * Desktop keeps the two-pane shape: the form on the left, the resume itself on
 * the right, presented as a page on a canvas rather than as another dashboard
 * card. On narrow screens the two panes become tabs, since side-by-side editing
 * doesn't fit a phone.
 *
 * The editor is also where the AI hand-offs land — a tailoring proposal from
 * the customize flow, and the summary of what an upload could extract. Both
 * only touch local state; the user still saves explicitly.
 */
export function ResumeEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [exporting, setExporting] = useState(false)

  // Editable fields (kept local; committed on Save).
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [template, setTemplate] = useState<TemplateVariant>('classic')
  const [sections, setSections] = useState<ResumeSections>(emptySections)

  const [customization, setCustomization] = useState<AiCustomizeResult | null>(null)
  const [customizedFor, setCustomizedFor] = useState('')
  const [imported, setImported] = useState<ImportSummary | null>(null)
  // A note from the create-from-scratch extraction, if we arrived that way.
  const [generated, setGenerated] = useState<{ failed: boolean; message?: string } | null>(null)
  const [atsOpen, setAtsOpen] = useState(false)

  /** The section shown in the middle column — only one form renders at a time. */
  const [section, setSection] = useState<EditorSectionId>('personal')
  /** The AI tools drawer. Kept out of the form column so it adds no height. */
  const [aiOpen, setAiOpen] = useState(false)
  /** The preview at full size, for reading rather than editing. */
  const [previewOpen, setPreviewOpen] = useState(false)
  // The template gallery is a dialog so switching designs never loses your place.
  const [templateOpen, setTemplateOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    resumesApi
      .get(id)
      .then((data) => {
        if (!active) return
        setResume(data)
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
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  /**
   * Pick up whatever was handed over via router state, then clear it from
   * history so a refresh or Back doesn't replay it.
   */
  useEffect(() => {
    const state = location.state as {
      jobCustomization?: AiCustomizeResult
      imported?: ImportSummary
      generated?: { failed: boolean; message?: string }
    } | null
    if (!state?.jobCustomization && !state?.imported && !state?.generated) return
    if (state.jobCustomization) setCustomization(state.jobCustomization)
    if (state.imported) setImported(state.imported)
    if (state.generated) setGenerated(state.generated)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const updateSections = (patch: Partial<ResumeSections>) =>
    setSections((current) => ({ ...current, ...patch }))

  // A live view of the resume that reflects unsaved edits.
  const previewResume = useMemo<Resume | null>(() => {
    if (!resume) return null
    return {
      ...resume,
      ...sections,
      title,
      summary,
      skills,
      template,
    }
  }, [resume, title, summary, skills, sections, template])

  /** The spec behind the currently selected template id. */
  const activeTemplate = useMemo(() => getTemplate(template), [template])

  /** Exactly what a save writes — one definition, used to send and to compare. */
  const savePayload = useMemo(
    () => ({ title, summary, skills, template, ...tidySections(sections) }),
    [title, summary, skills, template, sections],
  )
  /**
   * A content fingerprint of that payload.
   *
   * Autosave has to key off what the resume *says*, not off object identity.
   * Saving replaces `resume` and `sections` with fresh objects from the
   * server, so an identity-keyed effect re-fires on its own result and
   * schedules another save — a silent write every debounce interval, forever.
   * Comparing content means a save that changed nothing cannot trigger
   * another one.
   */
  const savePayloadKey = useMemo(() => JSON.stringify(savePayload), [savePayload])
  /** The fingerprint last written to the server; null until the resume loads. */
  const lastSavedRef = useRef<string | null>(null)

  const handleExportPdf = async () => {
    if (!previewResume || exporting) return
    setExporting(true)
    setError('')
    try {
      // Lazy-loaded so the heavy PDF library is only fetched on first export.
      const { downloadResumePdf } = await import('@/lib/downloadResumePdf')
      await downloadResumePdf(previewResume, template)
    } catch {
      setError('Sorry, we could not generate your PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  /** Ask AI writes to the two fields it is allowed to touch. */
  const handleApplyAi = ({
    summary: newSummary,
    skills: newSkills,
  }: {
    summary: string
    skills: string[]
  }) => {
    setSummary(newSummary)
    setSkills(newSkills)
  }

  /**
   * Apply the parts of a tailoring proposal the user accepted. Local state
   * only, so the live preview updates but nothing is persisted until Save.
   */
  const handleApplyCustomization = (selection: CustomizeSelection) => {
    if (selection.summary !== undefined) setSummary(selection.summary)
    if (selection.skills) setSkills(selection.skills)
    if (selection.experience) updateSections({ experience: selection.experience })
    if (customization) setCustomizedFor(customization.targetRole)
    setCustomization(null)
  }

  /**
   * Debounced autosave.
   *
   * The builder already saves as you go, and an editor that needs a button
   * press to keep your work is the odd one out — so edits here persist the
   * same way. `handleSave` is still the single write path; this only decides
   * when to call it, and a manual "Save now" remains in the overflow menu for
   * anyone who wants to force it.
   */
  useEffect(() => {
    if (loading || !resume) return
    // The first pass after loading records what came from the server; that is
    // the baseline, not an edit.
    if (lastSavedRef.current === null) {
      lastSavedRef.current = savePayloadKey
      return
    }
    if (savePayloadKey === lastSavedRef.current) return

    const timer = setTimeout(() => void handleSave(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
    // handleSave closes over the current payload; the fingerprint is what
    // decides whether it should run at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savePayloadKey, loading, resume])

  const handleSave = async () => {
    if (!id || !previewResume) return
    setSaving(true)
    setError('')
    // Captured before the request so a keystroke mid-flight isn't marked saved.
    const sentKey = savePayloadKey
    try {
      const updated = await resumesApi.update(id, savePayload)
      lastSavedRef.current = sentKey
      setResume(updated)
      setSections({
        personalInfo: { ...emptyPersonalInfo, ...updated.personalInfo },
        experience: updated.experience ?? [],
        education: updated.education ?? [],
        projects: updated.projects ?? [],
        certifications: updated.certifications ?? [],
      })
      setSavedAt(new Date().toLocaleTimeString())
      setCustomizedFor('')
      setImported(null)
      setGenerated(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your changes'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading your resume…" fullscreen />

  if (error && !resume) {
    return (
      <Container className="py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/dashboard')}>
          ← Back to dashboard
        </Button>
      </Container>
    )
  }

  const current =
    EDITOR_SECTIONS.find((entry) => entry.id === section) ?? EDITOR_SECTIONS[0]

  /** The last ATS score, straight off the resume — nothing is recomputed. */
  const atsScore = typeof resume?.atsAnalysis?.score === 'number' ? resume.atsAnalysis.score : null
  const atsTone =
    atsScore === null
      ? 'text-ink-muted'
      : atsScore >= 78
        ? 'text-emerald-700'
        : atsScore >= 62
          ? 'text-brand-700'
          : atsScore >= 45
            ? 'text-amber-700'
            : 'text-red-700'

  /**
   * The AI tools, as sidebar entries.
   *
   * Two of them are panels that open over the editor; three are their own
   * pages. The pages are told where they were opened from, so their Back
   * returns here rather than to a global list — and because that travels in
   * the URL, it survives a refresh.
   */
  const here = `/resume/${id}`
  const aiTools: {
    id: string
    label: string
    run: () => void
    Icon: (props: { width?: number; height?: number }) => React.ReactElement
    /** True while this tool's panel is open over the editor. */
    active?: boolean
  }[] = [
    {
      id: 'improve',
      label: 'Improve with AI',
      Icon: SparkleIcon,
      run: () => setAiOpen(true),
      active: aiOpen,
    },
    {
      id: 'customize',
      label: 'Customize for a job',
      Icon: TargetIcon,
      run: () => navigate(withReturnTo(`/customize?resume=${id}`, here)),
    },
    {
      id: 'ats',
      label: 'ATS checker',
      Icon: GaugeIcon,
      run: () => setAtsOpen(true),
      active: atsOpen,
    },
    {
      id: 'interview',
      label:
        resume?.creationMethod === 'ai-interview' ||
        (resume?.aiInterview?.messages?.length ?? 0) > 0
          ? 'Continue interview'
          : 'Resume interview',
      Icon: ChatIcon,
      run: () => navigate(withReturnTo(`/resume/new/interview?resume=${id}`, here)),
    },
    {
      id: 'cover',
      label: 'Cover letter',
      Icon: MailIcon,
      run: () => navigate(withReturnTo(`/cover-letters/new?resume=${id}`, here)),
    },
  ]

  /* ── Left column: section navigation ──
     Grouped and deliberately plain. Numbered circles and completion ticks
     belong to the creation wizard, where there is a sequence to finish; here
     the user is editing a document that already exists, and marking sections
     "incomplete" would invent a task they never asked for. */
  const navGroup = (label: string, entries: EditorSectionDef[]) => (
    <div>
      <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
      <ul className="space-y-px">
        {entries.map((entry) => {
          const active = entry.id === section
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setSection(entry.id)}
                aria-current={active ? 'true' : undefined}
                className={
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                  (active
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'font-medium text-ink-muted hover:bg-slate-100 hover:text-ink')
                }
              >
                <entry.Icon width={16} height={16} />
                <span className="truncate">{entry.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )

  const sectionNav = (
    <nav aria-label="Resume sections">
      {/* A horizontal strip on small screens; the grouped list on desktop. */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {EDITOR_SECTIONS.map((entry) => (
          <li key={entry.id} className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setSection(entry.id)}
              aria-current={entry.id === section ? 'true' : undefined}
              className={
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                (entry.id === section
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-ink-muted hover:bg-slate-200')
              }
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Small screens: the same tools, as a second chip row. */}
      <ul className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {aiTools.map((tool) => (
          <li key={tool.id} className="flex-shrink-0">
            <button
              type="button"
              onClick={tool.run}
              disabled={!id}
              className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
            >
              {tool.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden space-y-4 lg:block">
        {navGroup('Content', EDITOR_SECTIONS.filter((e) => e.id !== 'design'))}
        {navGroup('Design', EDITOR_SECTIONS.filter((e) => e.id === 'design'))}

        {/* AI tools. Set apart rather than styled louder — they act on the
            resume rather than being part of it, so they read as a different
            kind of thing without competing with the content sections. */}
        <div className="mt-1 rounded-xl bg-slate-50 p-2 pt-1.5 ring-1 ring-slate-100">
          <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            <SparkleIcon width={12} height={12} className="text-brand-500" />
            AI tools
          </p>
          <ul className="space-y-px">
            {aiTools.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={tool.run}
                  disabled={!id}
                  aria-current={tool.active ? 'true' : undefined}
                  className={
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 ' +
                    (tool.active
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'text-ink-muted hover:bg-slate-100 hover:text-ink')
                  }
                >
                  <tool.Icon width={16} height={16} />
                  <span className="truncate">{tool.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  )

  /* ── Middle column: only the active section's form ── */
  let sectionForm: React.ReactNode
  if (current.section) {
    sectionForm = (
      <ResumeSectionsEditor
        value={sections}
        onChange={updateSections}
        only={[current.section]}
        alwaysOpen
        flat
      />
    )
  } else if (current.id === 'summary') {
    sectionForm = (
      <div>
        <Textarea
          label="Professional summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={8}
          placeholder="Senior product engineer with eight years building customer-facing web applications…"
          hint="The first thing most people read."
        />
      </div>
    )
  } else if (current.id === 'skills') {
    sectionForm = (
      <div>
        <SkillsInput value={skills} onChange={setSkills} />
      </div>
    )
  } else {
    // Design. The gallery needs room that a 32rem column doesn't have, so this
    // shows what is in use and opens the full-width dialog to change it —
    // rather than cramming sixty thumbnails into the form column.
    sectionForm = (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <div className="w-24 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200">
            <TemplateThumbnail spec={activeTemplate} resume={previewResume ?? undefined} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{activeTemplate.name}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">{activeTemplate.category}</p>
            {activeTemplate.useCase && (
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{activeTemplate.useCase}</p>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setTemplateOpen(true)}
            >
              Browse all templates
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const sectionEditor = (
    <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{current.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{current.description}</p>
      </header>
      {sectionForm}
    </div>
  )

  /* ── Right column: the resume itself, the focus of the page ── */
  const previewPaper = previewResume && (
    <div className="shadow-card">
      <ResumePreview resume={previewResume} template={template} />
    </div>
  )

  const preview = (
    <div className="flex flex-col lg:h-full lg:min-h-0">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Live preview
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs text-ink-muted">{activeTemplate.name}</span>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="Expand the preview"
            title="Expand"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-white hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* The paper sits on the workspace tint so a sparse resume still reads as
          a sheet of paper rather than a blank panel. A permanent scrollbar, not
          `auto`: a bar that came and went would change the width and rescale
          the page on every toggle. */}
      <div className="px-5 py-6 [scrollbar-gutter:stable] lg:min-h-0 lg:flex-1 lg:overflow-y-scroll lg:px-8 lg:py-8">
        <div className="mx-auto w-full" style={{ maxWidth: 860 }}>
          {previewPaper}
        </div>
      </div>
    </div>
  )

  return (
    /* A workspace, not a document page: full width, exactly the height left
       under the navbar, and each pane scrolls on its own. The editor used to
       sit in the app's 1200px Container, which on a wide screen left a third
       of the window empty and squeezed the preview — the thing the page is
       actually for — into whatever was left. Below `lg` this all collapses
       back to ordinary page flow. */
    <div className="flex flex-col lg:h-screen lg:overflow-hidden">
      {/* Header — one quiet row. The AI tools moved into the sidebar, where
          they sit beside the sections they act on rather than in a dropdown
          floating over the middle of the page. */}
      <div className="z-30 flex-shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
          >
            ← Resumes
          </button>

          <span aria-hidden className="hidden h-4 w-px flex-shrink-0 bg-slate-200 sm:block" />

          {/* The resume's name, edited in place. */}
          <div className="min-w-0 flex-1">
            <label htmlFor="resume-title" className="sr-only">
              Resume name
            </label>
            <input
              id="resume-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Resume"
              className="w-full max-w-xs truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-ink transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <span className="hidden flex-shrink-0 text-xs text-ink-subtle sm:inline" role="status">
            {saving ? 'Saving…' : savedAt ? `Autosaved ✓` : ''}
          </span>

          {/* The template in use, and a one-click way to change it. The Design
              section shows the same gallery; this is the shortcut from
              anywhere in the editor. */}
          <button
            type="button"
            onClick={() => setTemplateOpen(true)}
            className="hidden max-w-[11rem] flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:inline-flex"
          >
            <LayoutIcon width={15} height={15} />
            <span className="truncate">{activeTemplate.name}</span>
          </button>

          {/* The last ATS score, if one has been run. A readout first and a
              way back into the report second — it never starts an analysis by
              itself; the modal does that, once per open. */}
          <button
            type="button"
            onClick={() => setAtsOpen(true)}
            disabled={!id || atsOpen}
            title={atsScore === null ? 'Check your ATS score' : 'View the ATS report'}
            className="hidden flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 md:inline-flex"
          >
            <GaugeIcon width={15} height={15} className={atsScore === null ? 'text-ink-subtle' : atsTone} />
            <span className={atsScore === null ? 'text-ink-muted' : atsTone}>
              {atsScore === null ? 'ATS' : `ATS ${atsScore}`}
            </span>
          </button>

          <Button
            size="sm"
            className="flex-shrink-0"
            onClick={handleExportPdf}
            disabled={exporting || !previewResume}
            aria-busy={exporting}
          >
            {exporting ? 'Preparing…' : 'Download'}
            <span className="hidden sm:inline"> PDF</span>
          </Button>

          {/* Overflow — the things you need occasionally. */}
          <Menu
            label="More actions"
            className="relative z-40 flex-shrink-0"
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
              <>
                <MenuItem
                  onSelect={() => {
                    close()
                    setTemplateOpen(true)
                  }}
                >
                  Change template
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close()
                    setPreviewOpen(true)
                  }}
                >
                  Expand preview
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onSelect={() => {
                    close()
                    void handleSave()
                  }}
                >
                  {saving ? 'Saving…' : 'Save now'}
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {/* Notices. Outside the panes so they never scroll away, and out of
          the grid so they cannot squeeze the preview. */}
      <div className="flex-shrink-0 space-y-3 px-4 pt-4 empty:hidden sm:px-6">
      {error && resume && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Just built from a description — prompt a review, never block editing. */}
      {generated && (
        <div
          role="status"
          className={
            'flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ' +
            (generated.failed
              ? 'border border-amber-200 bg-amber-50'
              : 'border border-brand-200 bg-brand-gradient-soft')
          }
        >
          <p className={generated.failed ? 'text-amber-900' : 'text-ink'}>
            {!generated.failed && (
              <span aria-hidden className="mr-1.5 text-brand-500">
                ✦
              </span>
            )}
            {generated.message ??
              'We sorted your description into sections. Review them, then save.'}
          </p>
          <button
            type="button"
            onClick={() => setGenerated(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-white/70 hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Imported from a PDF/DOCX — a prompt to review, never a blocker. */}
      {imported && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-3"
        >
          <div className="text-sm">
            <p className="text-ink">
              <span aria-hidden className="mr-1.5 text-brand-500">
                ✦
              </span>
              Your resume has been imported. Review the extracted information before continuing.
            </p>
            {imported.missingFields.length > 0 && (
              <p className="mt-1 text-ink-muted">
                Couldn't extract:{' '}
                <span className="font-medium text-ink">{imported.missingFields.join(', ')}</span>.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setImported(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-white/70 hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Applied-but-unsaved tailoring */}
      {customizedFor && (
        <div
          role="status"
          className="rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-2.5 text-sm"
        >
          <span className="text-ink">
            Tailored for <span className="font-semibold">{customizedFor}</span>.
          </span>{' '}
          <span className="text-ink-muted">Your changes save automatically.</span>
        </div>
      )}

      </div>

      {/* Sidebar · editor · preview. The preview takes every pixel the other
          two don't need, so it grows with the window instead of staying a
          fixed-width card. */}
      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[14rem_minmax(24rem,34rem)_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="border-b border-slate-200 bg-white px-3 py-3 lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-5">
          {sectionNav}
        </aside>

        <div className="bg-white lg:h-full lg:overflow-y-auto lg:border-r lg:border-slate-200">
          {sectionEditor}
        </div>

        {/* The workspace the paper sits on. */}
        <div className="bg-slate-100/70 lg:h-full lg:min-h-0 lg:overflow-hidden">
          {preview}
        </div>
      </div>

      {/* ATS report — read-only */}
      {id && (
        <AtsScoreModal
          open={atsOpen}
          onClose={() => setAtsOpen(false)}
          resumeId={id}
          resumeTitle={title}
          resume={previewResume ?? undefined}
          // The analysis the modal already ran; stored so the header can show
          // it. Never triggers a request of its own.
          onAnalyzed={(result) =>
            setResume((current) => (current ? { ...current, atsAnalysis: result } : current))
          }
        />
      )}

      {/* Template gallery. Changing the template only swaps the design — every
          field stays exactly as it was, and nothing persists until Save. */}
      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Choose a template"
        className="max-h-[88vh] w-[90vw] max-w-[1400px] overflow-y-auto"
      >
        <p className="text-sm text-ink-muted">
          Choose a design — your resume content stays the same.
        </p>
        <TemplateGallery
          className="mt-4"
          stickyControls
          selectedId={template}
          onSelect={(id) => {
            setTemplate(id)
            setTemplateOpen(false)
          }}
          previewResume={previewResume ?? undefined}
        />
      </Modal>

      {/* AI tools. A drawer rather than another panel in the form column: the
          tools are the same ones as before, they just no longer add vertical
          weight to the page. The proposal dialog AiToolsPanel opens sits on
          top of this one, and Escape closes them one layer at a time. */}
      {previewResume && id && (
        <Modal
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          title="AI tools"
          variant="drawer"
          className="max-w-lg"
        >
          <AiToolsPanel
            resumeId={id}
            resume={previewResume}
            onApply={handleApplyAi}
            onTailor={() => navigate(withReturnTo(`/customize?resume=${id}`, here))}
            onInterview={() => navigate(withReturnTo(`/resume/new/interview?resume=${id}`, here))}
            onCoverLetter={() => navigate(withReturnTo(`/cover-letters/new?resume=${id}`, here))}
            hasInterview={
              resume?.creationMethod === 'ai-interview' ||
              (resume?.aiInterview?.messages?.length ?? 0) > 0
            }
          />
        </Modal>
      )}

      {/* The resume at full size — for reading it, not editing it.

          The dialog's height is fixed rather than derived from the resume, so
          it cannot grow and shrink as the page is measured, and there is
          exactly one scrolling element inside it.

          That element uses `overflow-y: scroll`, not `auto`, deliberately. The
          flicker came from the scrollbar *toggling*: it appears, takes ~15px
          of width, the narrower width rescales the page, the shorter page no
          longer overflows, the bar goes away, and round it goes. A permanent
          scrollbar cannot toggle, so the width is constant — which is what
          actually breaks the loop. `scrollbar-gutter` expresses the same
          intent but is too recent in Safari to rely on alone. */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={title || 'Resume preview'}
        className="w-[min(94vw,900px)] max-w-none"
      >
        <div className="h-[calc(100vh-11rem)] max-h-[76vh] overflow-y-scroll rounded-lg bg-slate-100 p-4 [scrollbar-gutter:stable]">
          <div className="mx-auto w-full" style={{ maxWidth: 820 }}>
            {previewPaper}
          </div>
        </div>
      </Modal>

      {/* Review a tailoring proposal before it touches the editor */}
      {previewResume && (
        <JobCustomizeReview
          proposal={customization}
          resume={previewResume}
          onApply={handleApplyCustomization}
          onCancel={() => setCustomization(null)}
        />
      )}
    </div>
  )
}
