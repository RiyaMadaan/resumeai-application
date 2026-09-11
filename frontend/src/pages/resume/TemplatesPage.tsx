import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { TemplateGallery } from '@/components/resume/TemplateGallery'
import { PageHeader } from '@/components/layout/ToolPage'
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
      <PageHeader
        title="Templates"
        description={`${TEMPLATES.length} designs, all using your own content. Pick one to start with — you can change it at any time while editing.`}
        actions={
          <Button onClick={() => navigate('/resume/new')}>Continue with {spec.name}</Button>
        }
      />

      <TemplateGallery selectedId={selected} onSelect={handleSelect} className="mt-8" />
    </Container>
  )
}
