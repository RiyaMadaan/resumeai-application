import type { Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { MAX_UPLOAD_BYTES } from '../services/extraction.service.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Upload middleware for resume imports.
 *
 * The file is held in memory only — never written to disk — because the
 * original document isn't stored: it is parsed within the request and then
 * discarded, and only the structured resume is persisted.
 *
 * Multer's own errors are translated into ApiErrors here so the client gets a
 * clean, friendly message (and the right status) instead of a 500.
 */

/** The form field the frontend uploads the document under. */
export const RESUME_FILE_FIELD = 'file'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    // Keep the multipart body itself small — this endpoint takes one file and
    // no text fields.
    fields: 2,
  },
})

const single = upload.single(RESUME_FILE_FIELD)

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

/** Turn a multer failure into a user-facing 400. */
function toUploadError(err: MulterError): ApiError {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return ApiError.badRequest(
        `That file is too large (max ${MAX_MB} MB). Please upload a smaller PDF or DOCX.`,
      )
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return ApiError.badRequest('Please upload a single resume file.')
    default:
      return ApiError.badRequest('We could not read that upload. Please try again.')
  }
}

/**
 * Accept a single uploaded resume document, exposing it on `req.file`.
 * Runs after `requireAuth`, so only an authenticated user can upload at all.
 */
export function uploadResumeFile(req: Request, res: Response, next: NextFunction): void {
  single(req, res, (err: unknown) => {
    if (!err) {
      next()
      return
    }
    if (err instanceof MulterError) {
      console.warn('[upload] Rejected an upload:', err.code)
      next(toUploadError(err))
      return
    }
    console.error('[upload] Unexpected upload error:', err)
    next(ApiError.badRequest('We could not read that upload. Please try again.'))
  })
}
