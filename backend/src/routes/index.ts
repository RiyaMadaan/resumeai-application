import { Router } from 'express'
import authRoutes from './auth.routes.js'
import resumeRoutes from './resume.routes.js'
import aiRoutes from './ai.routes.js'
import coverLetterRoutes from './coverLetter.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/resumes', resumeRoutes)
router.use('/ai', aiRoutes)
router.use('/cover-letters', coverLetterRoutes)

export default router
