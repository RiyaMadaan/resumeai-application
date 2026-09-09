import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Resume, ResumeInput } from '@/types/resume'
import type { TemplateSpec } from './types'
import { PAGE_WIDTH, TemplateRenderer } from './TemplateRenderer'

/**
 * ScaledResume — fits the fixed-width resume page into whatever width it is
 * given.
 *
 * `TemplateRenderer` draws at a constant 794px so a design is identical
 * everywhere; this wrapper measures its container and applies a CSS transform
 * so the same markup fits a phone, an editor pane or a gallery card without any
 * template needing responsive rules of its own.
 */
export function ScaledResume({
  resume,
  spec,
  className,
}: {
  resume: Resume | ResumeInput
  spec: TemplateSpec
  className?: string
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [height, setHeight] = useState(0)

  // Track the available width and the rendered height separately: the width
  // decides the scale, the height decides how much room the scaled page needs.
  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const measure = () => {
      const width = outer.clientWidth
      if (width > 0) setScale(width / PAGE_WIDTH)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const measure = () => setHeight(inner.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [resume, spec])

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: height * scale || undefined }}
    >
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Hidden until measured, so the un-scaled page never flashes at full size.
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        <TemplateRenderer resume={resume} spec={spec} />
      </div>
    </div>
  )
}
