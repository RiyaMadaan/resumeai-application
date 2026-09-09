import { Router } from 'express'
import authRoutes from './auth.routes.js'
import resumeRoutes from './resume.routes.js'
import aiRoutes from './ai.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/resumes', resumeRoutes)
router.use('/ai', aiRoutes)

export default router
