import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { TemplateGallery } from '@/components/resume/TemplateGallery'
import { TEMPLATES, getTemplate } from '@/templates/catalog'
import { getPreferredTemplate, setPreferredTemplate } from '@/lib/preferredTemplate'

/**
 * TemplatesPage — browse the full catalog before starting a resume.
 *
 * The choice made here is the starting template for the next resume created;
 * an existing resume's template is changed from its own editor, where the
 * preview can show real content.
 */
export function TemplatesPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(getPreferredTemplate)

  const spec = getTemplate(selected)

  const handleSelect = (id: string) => {
    setSelected(id)
    setPreferredTemplate(id)
  }

  return (
    <Container className="py-8 sm:py-12">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 text-sm font-medium text-ink-muted transition-colors hover:text-brand-700"
      >
        ← Back to dashboard
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Templates</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {TEMPLATES.length} designs, all using your own content. Pick one to start with — you can
            change it at any time while editing.
          </p>
        </div>
        <Button onClick={() => navigate('/resume/new')} className="flex-shrink-0">
          Continue with {spec.name}
        </Button>
      </div>

      <TemplateGallery selectedId={selected} onSelect={handleSelect} className="mt-8" />
    </Container>
  )
}
