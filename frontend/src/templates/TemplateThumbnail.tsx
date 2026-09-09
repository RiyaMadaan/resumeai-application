import { useEffect, useRef, useState } from 'react'
import type { Resume, ResumeInput } from '@/types/resume'
import type { TemplateSpec } from './types'
import { PAGE_HEIGHT, PAGE_WIDTH, TemplateRenderer } from './TemplateRenderer'
import { SAMPLE_RESUME } from './sampleResume'

/**
 * TemplateThumbnail — a miniature of a real resume in one template.
 *
 * It renders the same `TemplateRenderer` the editor and PDF use, scaled down
 * and cropped to A4 proportions, so a gallery card is a true preview rather
 * than an illustration of one.
 *
 * Rendering sixty of these at once would be wasteful, so each card mounts its
 * resume only once it is near the viewport, and stays mounted afterwards to
 * keep scrolling back smooth. Off-screen cards are a cheap placeholder.
 */
export function TemplateThumbnail({
  spec,
  resume = SAMPLE_RESUME,
  className,
}: {
  spec: TemplateSpec
  /** Defaults to the sample resume; pass real data for a live preview. */
  resume?: Resume | ResumeInput
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // No IntersectionObserver (very old browsers, jsdom) — just render.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      // Start rendering a screen early so cards are ready by the time they land.
      { rootMargin: '400px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const scale = width ? width / PAGE_WIDTH : 0

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}`,
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {visible && scale > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            // The miniature is decorative: the card's own text names the
            // template, so its content shouldn't be read out or focusable.
            pointerEvents: 'none',
          }}
        >
          <TemplateRenderer resume={resume} spec={spec} />
        </div>
      )}
    </div>
  )
}
