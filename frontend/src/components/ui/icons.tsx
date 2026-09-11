import type { SVGProps } from 'react'

/**
 * Icon set — small, consistent line icons drawn inline (no icon dependency).
 * All share a 24x24 viewBox and inherit `currentColor` so they can be tinted
 * with text color utilities.
 */

type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    </svg>
  )
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </svg>
  )
}

export function WandIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 4V2M15 10V8M12.5 6.5h-2M19.5 6.5h-2" />
      <path d="M3 21l12-12 2 2L5 23z" />
      <path d="M14 7l3 3" />
    </svg>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function LayoutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props} strokeWidth={2.25}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/* ── Resume section icons ──
   Used by the editor sidebar so each section is recognisable at a glance.
   Same 24x24 line style as the set above, so they sit together evenly. */

export function UserIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0114 0" />
    </svg>
  )
}

export function TextIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 11h16M4 16h10" />
    </svg>
  )
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V6a2 2 0 012-2h2a2 2 0 012 2v1.5" />
    </svg>
  )
}

export function GraduationIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5l9 4.5-9 4.5-9-4.5L12 5z" />
      <path d="M7 11.5V16c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5v-4.5" />
    </svg>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4l2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.5-4.6 2.5.9-5.3L4.5 9.6l5.2-.7L12 4z" />
    </svg>
  )
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

export function CertificateIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="9.5" r="4.5" />
      <path d="M9 13.5L8 20l4-2 4 2-1-6.5" />
    </svg>
  )
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  )
}

export function GaugeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 17a8 8 0 1115 0" />
      <path d="M12 17l3.5-4.5" />
    </svg>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  )
}
