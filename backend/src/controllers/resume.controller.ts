import type { Request, Response } from 'express'
import {
  listResumes,
  createResume,
  getResume,
  updateResume,
  deleteResume,
} from '../services/resume.service.js'
import { extractDocumentText } from '../services/extraction.service.js'
import { parseResumeText } from '../services/ai.service.js'
import { ApiError } from '../utils/ApiError.js'


/** Turn an uploaded file name into a readable resume title. */
function fallbackTitle(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return base ? base.slice(0, 80) : 'Imported Resume'
}

/** GET /api/resumes  (protected) */
export async function list(req: Request, res: Response): Promise<void> {
  const resumes = await listResumes(req.userId!)
  res.json({ resumes })
}

/** POST /api/resumes  (protected) */
export async function create(req: Request, res: Response): Promise<void> {
  const resume = await createResume(req.userId!, req.body ?? {})
  res.status(201).json({ resume })
}

/** GET /api/resumes/:id  (protected) */
export async function getOne(req: Request, res: Response): Promise<void> {
  const resume = await getResume(req.userId!, req.params.id)
  res.json({ resume })
}

/** PUT /api/resumes/:id  (protected) */
export async function update(req: Request, res: Response): Promise<void> {
  const resume = await updateResume(req.userId!, req.params.id, req.body ?? {})
  res.json({ resume })
}

/** DELETE /api/resumes/:id  (protected) */
export async function remove(req: Request, res: Response): Promise<void> {
  await deleteResume(req.userId!, req.params.id)
  res.status(204).send()
}

/**
 * POST /api/resumes/import  (protected)
 *
 * Body: multipart/form-data with a single `file` field (PDF or DOCX).
 *
 * Turns an existing resume document into a real, editable resume:
 *  1. Multer holds the upload in memory (size/count limits enforced there).
 *  2. The extraction service validates the format and pulls out plain text.
 *  3. The AI service parses that text into the app's own resume shape,
 *     re-validating every value against the document so nothing is invented.
 *  4. The resume is created for the authenticated user — `req.userId` comes
 *     from the verified JWT, never from the request body, so an import can only
 *     ever belong to the uploader.
 *
 * The uploaded file is never written to disk and is discarded when the request
 * ends; only the structured resume is stored. File contents are never logged.
 */
export async function importFromFile(req: Request, res: Response): Promise<void> {
  const file = req.file
  if (!file) {
    throw ApiError.badRequest('Please choose a PDF or DOCX file to upload.')
  }

  const text = await extractDocumentText({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
  })

  const parsed = await parseResumeText({ text })

  // Borrow a dashboard label from the document: its printed professional title,
  // else the most recent job title, else the file's own name.
  const title =
    parsed.resume.title || parsed.resume.experience?.[0]?.role || fallbackTitle(file.originalname)

  const resume = await createResume(req.userId!, {
    ...parsed.resume,
    title,
    template: 'classic',
  })

  res.status(201).json({
    resume,
    imported: {
      fileName: file.originalname,
      missingFields: parsed.missingFields,
    },
  })
}
