import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Collapsible } from '@/components/ui/Collapsible'
import { ResumePreview } from '@/components/resume/ResumePreview'
import { AiToolsPanel } from '@/components/resume/AiToolsPanel'
import {
  JobCustomizeReview,
  type CustomizeSelection,
} from '@/components/resume/JobCustomizeReview'
import { AtsScoreModal } from '@/components/resume/AtsScoreModal'
import { ResumeSectionsEditor, type ResumeSections } from '@/components/resume/ResumeSectionsEditor'
import { TemplateGallery } from '@/components/resume/TemplateGallery'
import { Modal } from '@/components/ui/Modal'
import { getTemplate } from '@/templates/catalog'
import { TemplateThumbnail } from '@/templates/TemplateThumbnail'
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
  const [skillsText, setSkillsText] = useState('')
  const [template, setTemplate] = useState<TemplateVariant>('classic')
  const [sections, setSections] = useState<ResumeSections>(emptySections)

  const [customization, setCustomization] = useState<AiCustomizeResult | null>(null)
  const [customizedFor, setCustomizedFor] = useState('')
  const [imported, setImported] = useState<ImportSummary | null>(null)
  // A note from the create-from-scratch extraction, if we arrived that way.
  const [generated, setGenerated] = useState<{ failed: boolean; message?: string } | null>(null)
  const [atsOpen, setAtsOpen] = useState(false)

  // View state — on narrow screens the two panes become tabs.
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')
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
        setSkillsText(data.skills.join(', '))
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
      skills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      template,
    }
  }, [resume, title, summary, skillsText, sections, template])

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
  const handleApplyAi = ({ summary: newSummary, skills }: { summary: string; skills: string[] }) => {
    setSummary(newSummary)
    setSkillsText(skills.join(', '))
  }

  /**
   * Apply the parts of a tailoring proposal the user accepted. Local state
   * only, so the live preview updates but nothing is persisted until Save.
   */
  const handleApplyCustomization = (selection: CustomizeSelection) => {
    if (selection.summary !== undefined) setSummary(selection.summary)
    if (selection.skills) setSkillsText(selection.skills.join(', '))
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

  /* ── The preview pane: a real page on a canvas ── */
  const preview = (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Preview</h2>
        <Button
          size="sm"
          onClick={handleExportPdf}
          disabled={exporting || !previewResume}
          aria-busy={exporting}
        >
          {exporting ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
      </div>

      <div className="flex-1 overflow-auto rounded-xl bg-slate-100/80 p-4 sm:p-6">
        <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
          {previewResume && (
            <div className="shadow-card">
              <ResumePreview resume={previewResume} template={template} />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  /* ── The editing pane ── */
  const editor = (
    <div className="space-y-3">
      {/* Template — a miniature of the current design, and a way to change it */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3.5">
          <div className="w-16 flex-shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200">
            <TemplateThumbnail spec={activeTemplate} resume={previewResume ?? undefined} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">Template</h2>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {activeTemplate.name}
              <span className="text-ink-subtle"> · {activeTemplate.category}</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2.5"
              onClick={() => setTemplateOpen(true)}
            >
              Change template
            </Button>
          </div>
        </div>
      </div>

      {/* Headline fields */}
      <Collapsible title="Resume name & summary" summary={title} defaultOpen>
        <div className="space-y-3">
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
            rows={5}
          />
          <Input
            label="Skills"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            hint="Separate skills with commas."
            placeholder="React, TypeScript, Node.js"
          />
        </div>
      </Collapsible>

      {/* Every other section */}
      <ResumeSectionsEditor value={sections} onChange={updateSections} />

      {/* AI */}
      {previewResume && id && (
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
      )}
    </div>
  )

  return (
    <Container className="py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="self-start text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
        >
          ← Back to dashboard
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {savedAt && (
            <span className="text-xs text-ink-subtle" role="status">
              Saved at {savedAt}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAtsOpen(true)}
            /* Already open means a check is running or shown — no second trigger. */
            disabled={atsOpen}
          >
            {atsOpen ? 'Checking…' : 'Check ATS score'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} aria-busy={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
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

      {/* Mobile pane switch */}
      <div className="mt-5 flex rounded-lg border border-slate-200 bg-white p-0.5 lg:hidden">
        {(['edit', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            aria-pressed={mobileTab === tab}
            className={
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ' +
              (mobileTab === tab ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:text-ink')
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <div className={mobileTab === 'edit' ? '' : 'hidden lg:block'}>{editor}</div>
        <div className={mobileTab === 'preview' ? '' : 'hidden lg:block'}>
          <div className="lg:sticky lg:top-24">{preview}</div>
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
