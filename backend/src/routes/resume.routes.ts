import { Router } from 'express'
import {
  list,
  create,
  getOne,
  update,
  remove,
  importFromFile,
} from '../controllers/resume.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import { uploadResumeFile } from '../middleware/upload.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// All resume routes require authentication.
router.use(requireAuth)

router.get('/', asyncHandler(list))
router.post('/', asyncHandler(create))

// Import an existing resume document (PDF/DOCX). Declared before the '/:id'
// routes so 'import' is never mistaken for a resume id.
router.post('/import', uploadResumeFile, asyncHandler(importFromFile))

router.get('/:id', asyncHandler(getOne))
router.put('/:id', asyncHandler(update))
router.delete('/:id', asyncHandler(remove))

export default router
