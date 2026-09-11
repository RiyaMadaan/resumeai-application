import { useLayoutEffect, useRef, useState } from 'react'
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
 *
 * ── Why the measuring is guarded ──
 *
 * This component sets its own height from what it measures, which makes a
 * feedback loop easy to create by accident:
 *
 *     measure width → set scale → set height → element resizes
 *       → ResizeObserver fires → measure width → …
 *
 * A ResizeObserver reports *any* box change, including the height this
 * component just set, so every height change re-entered the callback. On its
 * own that settles, because setting an unchanged scale bails out of rendering.
 * It stops settling inside a scroll container: a taller page adds a scrollbar,
 * the scrollbar takes ~15px of width, the narrower width shrinks the scale,
 * the shorter page removes the scrollbar, and the width comes back — flicker,
 * forever, centred on the scrollbar.
 *
 * Two things are needed to stop that, and only together:
 *
 *  1. Callers that scroll must keep their width constant whether or not the
 *     bar is showing — `overflow-y: scroll` rather than `auto`. This is the
 *     one that actually breaks the cycle, because at the threshold the width
 *     genuinely alternates and no amount of guarding here can tell the
 *     difference between that and a real resize.
 *  2. This component ignores any callback where neither measurement changed,
 *     so the resize it causes by setting its own height doesn't re-enter the
 *     callback at all. That removes the redundant work on every edit, and
 *     leaves the observer idle once the page has settled.
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

  // One piece of state, so a measurement is a single commit rather than two.
  const [box, setBox] = useState({ scale: 0, height: 0 })

  // The last values actually observed, used to reject no-op callbacks.
  const measured = useRef({ width: -1, height: -1 })

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const measure = () => {
      const width = outer.clientWidth
      // `offsetHeight` is the laid-out height and ignores the transform, so
      // this is the page's natural height at 794px wide.
      const contentHeight = inner.offsetHeight

      // The resize this component itself caused: nothing to recompute.
      if (width === measured.current.width && contentHeight === measured.current.height) {
        return
      }
      measured.current = { width, height: contentHeight }

      // A width of 0 means we aren't laid out yet (a closed dialog, a hidden
      // tab). Wait for a real measurement rather than committing a 0 scale.
      if (width > 0) {
        setBox({ scale: width / PAGE_WIDTH, height: contentHeight })
      }
    }

    measure()

    // One observer for both boxes: the container's width sets the scale, the
    // page's own height sets how much room the scaled result needs. Watching
    // the content directly means edits and template changes are picked up
    // without re-subscribing on every render.
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: box.height * box.scale || undefined,
      }}
    >
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${box.scale})`,
          transformOrigin: 'top left',
          // Hidden until measured, so the un-scaled page never flashes at full
          // size on first paint.
          visibility: box.scale ? 'visible' : 'hidden',
        }}
      >
        <TemplateRenderer resume={resume} spec={spec} />
      </div>
    </div>
  )
}
