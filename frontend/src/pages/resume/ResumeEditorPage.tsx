import { useEffect, useMemo, useState } from 'react'
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
import { Modal } from '@/components/ui/Modal'
import { getTemplate } from '@/templates/catalog'
import { isManualResume } from '@/lib/resumeRoutes'
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
}

const EDITOR_SECTIONS: EditorSectionDef[] = [
  {
    id: 'personal',
    label: 'Personal',
    title: 'Personal details',
    description: 'Your name and how employers reach you.',
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
    description: 'Your roles, most recent first.',
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
    description: 'Work worth showing that sits outside a job.',
    section: 'projects',
  },
  {
    id: 'certifications',
    label: 'Certificates',
    title: 'Certifications',
    description: 'One per line.',
    section: 'certifications',
  },
  {
    id: 'design',
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

  const handleSave = async () => {
    if (!id || !previewResume) return
    setSaving(true)
    setError('')
    try {
      const tidy = tidySections(sections)
      const updated = await resumesApi.update(id, {
        title: previewResume.title,
        summary: previewResume.summary,
        skills: previewResume.skills,
        template: previewResume.template,
        ...tidy,
      })
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

  /** Which sections have something in them — drives the sidebar's ticks. */
  const completion: Record<EditorSectionId, boolean> = {
    personal: Boolean(sections.personalInfo.fullName.trim() || sections.personalInfo.email.trim()),
    summary: Boolean(summary.trim()),
    experience: sections.experience.length > 0,
    education: sections.education.length > 0,
    skills: skills.length > 0,
    projects: sections.projects.length > 0,
    certifications: sections.certifications.some((c) => c.trim()),
    // A template is always set, so this is informational rather than a to-do.
    design: true,
  }

  const current =
    EDITOR_SECTIONS.find((entry) => entry.id === section) ?? EDITOR_SECTIONS[0]

  /* ── Left column: compact section navigation ── */
  const sectionNav = (
    <nav aria-label="Resume sections" className="lg:sticky lg:top-32">
      {/* Horizontally scrollable chips on small screens, a list on desktop. */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {EDITOR_SECTIONS.map((entry) => {
          const active = entry.id === section
          const done = completion[entry.id]
          return (
            <li key={entry.id} className="flex-shrink-0 lg:flex-shrink">
              <button
                type="button"
                onClick={() => setSection(entry.id)}
                aria-current={active ? 'true' : undefined}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                  (active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-muted hover:bg-slate-100 hover:text-ink')
                }
              >
                <span
                  aria-hidden
                  className={
                    'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' +
                    (done
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-300 text-transparent')
                  }
                >
                  ✓
                </span>
                <span className="truncate">{entry.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
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
      />
    )
  } else if (current.id === 'summary') {
    sectionForm = (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
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
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <SkillsInput value={skills} onChange={setSkills} />
      </div>
    )
  } else {
    // Design: the same gallery the toolbar opens, shown in place.
    sectionForm = (
      <TemplateGallery
        selectedId={template}
        onSelect={setTemplate}
        previewResume={previewResume ?? undefined}
      />
    )
  }

  const sectionEditor = (
    <div>
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-tight text-ink">{current.title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{current.description}</p>
      </div>
      {sectionForm}
    </div>
  )

  /* ── Right column: the resume itself, the focus of the page ── */
  const preview = (
    <div className="lg:sticky lg:top-32">
      <div className="flex items-center justify-between gap-3 pb-2">
        <h2 className="text-sm font-semibold text-ink">Preview</h2>
        <span className="truncate text-xs text-ink-subtle">{activeTemplate.name}</span>
      </div>
      {/* The paper sits on a tinted canvas so an sparse resume still reads as
          a sheet of paper rather than a blank panel. */}
      <div className="overflow-auto rounded-xl bg-slate-100/80 p-4 sm:p-6 lg:max-h-[calc(100vh-11rem)]">
        <div className="mx-auto w-full" style={{ maxWidth: 780 }}>
          {previewResume && (
            <div className="shadow-card">
              <ResumePreview resume={previewResume} template={template} />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Container className="py-6 sm:py-8">
      {/* Toolbar — every editor action lives here and nowhere else. */}
      <div className="sticky top-16 z-30 -mx-5 mb-5 border-b border-slate-200 bg-white/95 px-5 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Left: leaving the editor */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="whitespace-nowrap text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
            >
              ← Dashboard
            </button>
            {/* Resumes built with the step flow can return to it: the full
                editor is a deliberate detour, not a one-way door. Both read
                and write the same record, so nothing is lost either way. */}
            {isManualResume(resume) && id && (
              <button
                onClick={() => navigate(`/resume/builder/${id}`)}
                className="hidden whitespace-nowrap text-sm font-medium text-brand-700 transition-colors hover:text-brand-800 sm:block"
              >
                Step-by-step
              </button>
            )}
          </div>

          {/* Centre: the resume's name, edited in place */}
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <label htmlFor="resume-title" className="sr-only">
              Resume name
            </label>
            <input
              id="resume-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Resume"
              className="w-full truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-ink transition-colors hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:text-center"
            />
          </div>

          {/* Right: the actions */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {savedAt && (
              <span className="hidden text-xs text-ink-subtle xl:inline" role="status">
                Saved {savedAt}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={() => setTemplateOpen(true)}>
              <span className="hidden sm:inline">Template: </span>
              {activeTemplate.name}
              <span aria-hidden className="text-ink-subtle">
                ▾
              </span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAtsOpen(true)}
              /* Already open means a check is running or shown — no second trigger. */
              disabled={atsOpen}
            >
              {atsOpen ? 'Checking…' : 'ATS score'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAiOpen(true)} disabled={!id}>
              <span aria-hidden>✨</span> AI tools
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting || !previewResume}
              aria-busy={exporting}
            >
              {exporting ? 'Preparing…' : 'Download PDF'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} aria-busy={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {error && resume && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Just built from a description — prompt a review, never block editing. */}
      {generated && (
        <div
          role="status"
          className={
            'mt-4 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ' +
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
          className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-3"
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
          className="mt-4 rounded-xl border border-brand-200 bg-brand-gradient-soft px-4 py-2.5 text-sm"
        >
          <span className="text-ink">
            Tailored for <span className="font-semibold">{customizedFor}</span>.
          </span>{' '}
          <span className="text-ink-muted">Save changes to keep it.</span>
        </div>
      )}

      {/* Three columns on desktop; stacked in the same order on smaller
          screens, so the preview always follows the form being edited.
          Design swaps the weighting — the gallery needs the room a form
          doesn't — while keeping the preview live beside it, which is the
          whole point of choosing a template here. */}
      <div
        className={
          'grid gap-6 lg:items-start lg:gap-8 ' +
          (section === 'design'
            ? 'lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,22rem)]'
            : 'lg:grid-cols-[11rem_minmax(0,25rem)_minmax(0,1fr)]')
        }
      >
        {sectionNav}
        {sectionEditor}
        {preview}
      </div>

      {/* ATS report — read-only */}
      {id && (
        <AtsScoreModal
          open={atsOpen}
          onClose={() => setAtsOpen(false)}
          resumeId={id}
          resumeTitle={title}
          resume={previewResume ?? undefined}
        />
      )}

      {/* Template gallery. Changing the template only swaps the design — every
          field stays exactly as it was, and nothing persists until Save. */}
      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Choose a template"
        className="max-w-6xl max-h-[88vh] overflow-y-auto"
      >
        <TemplateGallery
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
            onTailor={() => navigate(`/customize?resume=${id}`)}
            onInterview={() => navigate(`/resume/new/interview?resume=${id}`)}
            onCoverLetter={() => navigate(`/cover-letters/new?resume=${id}`)}
            hasInterview={
              resume?.creationMethod === 'ai-interview' ||
              (resume?.aiInterview?.messages?.length ?? 0) > 0
            }
          />
        </Modal>
      )}

      {/* Review a tailoring proposal before it touches the editor */}
      {previewResume && (
        <JobCustomizeReview
          proposal={customization}
          resume={previewResume}
          onApply={handleApplyCustomization}
          onCancel={() => setCustomization(null)}
        />
      )}
    </Container>
  )
}
