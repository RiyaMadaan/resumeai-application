import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { ApiError } from '../utils/ApiError.js'

/**
 * Document extraction service — turns an uploaded PDF or DOCX into plain text.
 *
 * The uploaded file only ever exists in memory: it is parsed, its text is
 * handed to the AI layer, and the buffer is discarded when the request ends.
 * Nothing is written to disk and the original document is never persisted —
 * only the structured resume the user reviews and saves.
 *
 * File *contents* are never logged; only sizes, types and failure reasons are.
 */

/** Maximum upload size we accept (mirrored in the frontend for early feedback). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB

/** The two document formats we can read. */
export type SupportedUploadType = 'pdf' | 'docx'

const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** MIME types browsers actually send for the formats we support. */
const MIME_TO_TYPE: Record<string, SupportedUploadType> = {
  [PDF_MIME]: 'pdf',
  'application/x-pdf': 'pdf',
  [DOCX_MIME]: 'docx',
}

/**
 * Below this, we assume nothing meaningful came out — typically a scanned or
 * image-only PDF, which has no text layer to extract.
 */
const MIN_EXTRACTED_LENGTH = 120

/**
 * Upper bound on the text we forward to the AI. Long enough for a very detailed
 * multi-page CV, short enough to keep the prompt (and cost) bounded.
 */
const MAX_EXTRACTED_LENGTH = 60_000

/** The magic bytes each format starts with — a cheap check that the file is what it claims. */
const PDF_SIGNATURE = '%PDF-'
const ZIP_SIGNATURE = [0x50, 0x4b] // DOCX is a ZIP container ("PK")

/**
 * Decide which format an upload is, from its MIME type and filename.
 *
 * Browsers are inconsistent about MIME types for DOCX (some send
 * `application/octet-stream`), so the extension is a valid fallback — but an
 * unrecognised file is rejected rather than guessed at.
 */
export function detectUploadType(mimetype: string, filename: string): SupportedUploadType {
  const mime = (mimetype ?? '').split(';')[0].trim().toLowerCase()
  const byMime = MIME_TO_TYPE[mime]
  if (byMime) return byMime

  const name = (filename ?? '').toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'

  // Legacy Word documents are a completely different (binary) format — say so
  // explicitly rather than letting the user retry the same file.
  if (name.endsWith('.doc')) {
    throw ApiError.badRequest(
      'Older .doc files aren\'t supported. Please save your resume as a PDF or .docx and upload it again.',
    )
  }

  throw ApiError.badRequest('Please upload your resume as a PDF or DOCX file.')
}

/** Reject a file whose contents don't match the format it claims to be. */
function assertSignature(buffer: Buffer, type: SupportedUploadType): void {
  if (type === 'pdf') {
    if (buffer.subarray(0, 5).toString('latin1') !== PDF_SIGNATURE) {
      throw ApiError.badRequest("That file doesn't look like a valid PDF. Please try another file.")
    }
    return
  }
  if (buffer[0] !== ZIP_SIGNATURE[0] || buffer[1] !== ZIP_SIGNATURE[1]) {
    throw ApiError.badRequest("That file doesn't look like a valid DOCX. Please try another file.")
  }
}

/**
 * Tidy up extracted text: normalize line endings, strip the runs of blank lines
 * and stray whitespace that PDF extraction produces, and cap the length.
 */
function normalizeExtractedText(raw: string): string {
  const cleaned = raw
    .replace(/\r\n?/g, '\n')
    // Zero-width and non-breaking characters leak out of both formats.
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned.length > MAX_EXTRACTED_LENGTH
    ? `${cleaned.slice(0, MAX_EXTRACTED_LENGTH)}\n[truncated]`
    : cleaned
}

/** Extract the text layer of a PDF. */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return result.text ?? ''
  } catch (err) {
    console.error('[extraction] Failed to read PDF:', err instanceof Error ? err.message : err)
    throw ApiError.badRequest(
      "We couldn't read that PDF. If it's password-protected or a scan, try exporting a text-based PDF or uploading a DOCX.",
    )
  } finally {
    // Always release the pdf.js document, even when parsing threw.
    await parser.destroy().catch(() => undefined)
  }
}

/** Extract the text of a DOCX document. */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value ?? ''
  } catch (err) {
    console.error('[extraction] Failed to read DOCX:', err instanceof Error ? err.message : err)
    throw ApiError.badRequest(
      "We couldn't read that DOCX file. Please make sure it isn't corrupted, or try uploading a PDF.",
    )
  }
}

export interface UploadedDocument {
  buffer: Buffer
  mimetype: string
  originalname: string
}

/**
 * Extract plain text from an uploaded resume document.
 *
 * Throws a user-friendly 400 for anything the user can act on (wrong format,
 * empty file, a scan with no text layer) — never a stack trace or library error.
 */
export async function extractDocumentText(file: UploadedDocument): Promise<string> {
  if (!file.buffer || file.buffer.length === 0) {
    throw ApiError.badRequest('That file appears to be empty. Please choose another file.')
  }
  if (file.buffer.length > MAX_UPLOAD_BYTES) {
    throw ApiError.badRequest(
      `That file is too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).`,
    )
  }

  const type = detectUploadType(file.mimetype, file.originalname)
  assertSignature(file.buffer, type)

  const raw = type === 'pdf' ? await extractPdfText(file.buffer) : await extractDocxText(file.buffer)
  const text = normalizeExtractedText(raw)

  if (text.length < MIN_EXTRACTED_LENGTH) {
    console.warn(`[extraction] Extracted only ${text.length} characters from a ${type} upload.`)
    throw ApiError.badRequest(
      "We couldn't find any readable text in that file. If it's a scanned image, please upload a text-based PDF or DOCX instead.",
    )
  }

  return text
}
