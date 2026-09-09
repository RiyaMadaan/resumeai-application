import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

/** One label/value pair in the account summary. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}

/**
 * AccountPage — the details behind the navbar's account menu.
 *
 * Deliberately small: it shows what the app actually knows about the signed-in
 * user and offers the one action available here. Nothing is invented to fill
 * the page out.
 */
export function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Container className="max-w-2xl py-10 sm:py-14">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
      >
        ← Back to dashboard
      </button>

      <h1 className="text-2xl font-bold tracking-tight text-ink">Profile</h1>
      <p className="mt-1 text-ink-muted">Your ResumeAI account details.</p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-1">
        <dl>
          <Field label="Name" value={user?.name ?? '—'} />
          <Field label="Email" value={user?.email ?? '—'} />
        </dl>
      </div>

      <div className="mt-6">
        <Button variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </Container>
  )
}
