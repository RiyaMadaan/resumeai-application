import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TemplateGallery } from '@/components/resume/TemplateGallery'
import { PageShell } from '@/components/layout/PageShell'
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

  // A gallery earns the full content width; a reading column would shrink the
  // thumbnails that are the point of the page.
  return (
      <PageShell
        title="Templates"
        description={`${TEMPLATES.length} designs, all using your own content. Pick one to start with — you can change it at any time while editing.`}
        actions={
          <Button onClick={() => navigate('/resume/new')}>Continue with {spec.name}</Button>
        }
        width="wide"
      >

      <TemplateGallery selectedId={selected} onSelect={handleSelect} className="mt-8" />
    </PageShell>
  )
}
