import { pdf } from '@react-pdf/renderer'
import { ResumePdfDocument } from '@/components/resume/ResumePdfDocument'
import type { Resume, ResumeInput, TemplateVariant } from '@/types/resume'

/**
 * Build a safe, readable PDF filename from the resume title.
 * e.g. "Frontend Developer" → "frontend-developer-resume.pdf".
 */
export function buildResumeFilename(title?: string): string {
  const base = (title ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens

  if (!base) return 'resume.pdf'
  // Avoid an awkward "…-resume-resume.pdf" if the title already ends in "resume".
  const stem = base.endsWith('resume') ? base : `${base}-resume`
  return `${stem}.pdf`
}

/**
 * Generate a PDF Blob for a resume in the given template. Separated from the
 * download step so it can be reused (e.g. preview) or tested independently.
 */
export async function generateResumePdfBlob(
  resume: Resume | ResumeInput,
  template?: TemplateVariant,
): Promise<Blob> {
  return pdf(<ResumePdfDocument resume={resume} template={template} />).toBlob()
}

/**
 * Generate the resume PDF and trigger a browser download using the resume
 * title as the filename. Throws on failure so the caller can surface an error.
 */
export async function downloadResumePdf(
  resume: Resume | ResumeInput,
  template?: TemplateVariant,
): Promise<void> {
  const blob = await generateResumePdfBlob(resume, template)
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = buildResumeFilename(resume.title)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
