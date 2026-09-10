import { pdf } from '@react-pdf/renderer'
import {
  CoverLetterPdfDocument,
  type CoverLetterPdfProps,
} from '@/components/coverLetter/CoverLetterPdfDocument'

/**
 * Build a safe, readable filename from the letter's target.
 * e.g. company "Northwind" → "northwind-cover-letter.pdf".
 */
export function buildCoverLetterFilename(parts: { company?: string; title?: string }): string {
  const base = (parts.company || parts.title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!base) return 'cover-letter.pdf'
  const stem = base.endsWith('cover-letter') ? base : `${base}-cover-letter`
  return `${stem}.pdf`
}

/**
 * Generate the cover letter PDF and trigger a browser download. Throws on
 * failure so the caller can surface an error, matching the resume export.
 */
export async function downloadCoverLetterPdf(
  props: CoverLetterPdfProps & { title?: string },
): Promise<void> {
  const blob = await pdf(
    <CoverLetterPdfDocument
      body={props.body}
      company={props.company}
      jobTitle={props.jobTitle}
      personalInfo={props.personalInfo}
    />,
  ).toBlob()

  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = buildCoverLetterFilename({ company: props.company, title: props.title })
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
