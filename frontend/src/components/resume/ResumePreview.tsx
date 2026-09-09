import { cn } from '@/lib/cn'
import { getTemplate } from '@/templates/catalog'
import { ScaledResume } from '@/templates/ScaledResume'
import type { Resume, ResumeInput, TemplateId } from '@/types/resume'

/**
 * ResumePreview — renders a structured resume in its chosen template.
 *
 * The design itself lives in the template catalog and is drawn by the shared
 * `TemplateRenderer`; this component's job is only to resolve which template to
 * use and scale the page to the space available. Because the gallery
 * thumbnails and the PDF read the same spec, the preview can't drift away from
 * what the user actually downloads.
 *
 * Purely presentational, so it works for both saved resumes and in-progress
 * edits. Empty sections are omitted by the renderer.
 */
export function ResumePreview({
  resume,
  template,
  className,
}: {
  resume: Resume | ResumeInput
  /** Overrides the template stored on the resume — used for live previews. */
  template?: TemplateId
  className?: string
}) {
  const spec = getTemplate(template ?? resume.template)

  return (
    <div className={cn('w-full bg-white shadow-sm ring-1 ring-slate-200', className)}>
      <ScaledResume resume={resume} spec={spec} />
    </div>
  )
}
