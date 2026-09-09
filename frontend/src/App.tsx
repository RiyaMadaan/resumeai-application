import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { AppLayout } from '@/pages/app/AppLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AccountPage } from '@/pages/account/AccountPage'
import { CreateResumeChoicePage } from '@/pages/resume/CreateResumeChoicePage'
import { NewResumePage } from '@/pages/resume/NewResumePage'
import { TemplatesPage } from '@/pages/resume/TemplatesPage'
import { UploadResumePage } from '@/pages/resume/UploadResumePage'
import { AiInterviewPage } from '@/pages/resume/AiInterviewPage'
import { ResumeEditorPage } from '@/pages/resume/ResumeEditorPage'
import { CustomizeForJobPage } from '@/pages/resume/CustomizeForJobPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

/**
 * App — the route table for the ResumeAI application.
 *
 *   /                      → the dashboard (or /login when signed out)
 *   /login, /register      public
 *   /dashboard             user's resumes              (protected)
 *   /account               profile details             (protected)
 *   /templates             browse resume templates     (protected)
 *   /resume/new            create: scratch / AI / upload (protected)
 *   /resume/new/scratch    describe your career        (protected)
 *   /resume/new/upload     import an existing PDF/DOCX (protected)
 *   /resume/new/interview  build a resume by conversation (protected)
 *   /customize             job description → tailored resume (protected)
 *   /resume/:id            resume editor               (protected)
 *
 * The public marketing website is a separate deployment; its CTAs link here.
 * Protected routes render inside AppLayout (AppNavbar + content).
 */
function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Authenticated application */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/resume/new" element={<CreateResumeChoicePage />} />
          <Route path="/resume/new/scratch" element={<NewResumePage />} />
          <Route path="/resume/new/upload" element={<UploadResumePage />} />
          <Route path="/resume/new/interview" element={<AiInterviewPage />} />
          <Route path="/customize" element={<CustomizeForJobPage />} />
          <Route path="/resume/:id" element={<ResumeEditorPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
