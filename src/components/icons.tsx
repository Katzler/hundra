// Små ikoner i SF Symbols-anda. Ritade med currentColor så att de följer texten.

type P = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const PlusIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const MinusIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
  </svg>
)

export const ChevronLeft = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const ChevronRight = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export const SearchIcon = ({ size = 17, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.4}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L20 20" />
  </svg>
)

export const XIcon = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.8}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const StarIcon = ({ size = 14, className, filled }: P & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.8}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </svg>
)

export const RingTabIcon = ({ size = 26, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}>
    <path d="M12 3.5a8.5 8.5 0 1 1-8.1 6" />
  </svg>
)

export const ChartTabIcon = ({ size = 26, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}>
    <path d="M5 20v-6M10 20V9M15 20v-8M20 20V5" />
  </svg>
)

export const PersonTabIcon = ({ size = 26, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.2}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
  </svg>
)

export const ArrowDown = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)

export const ArrowUp = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)

export const EqualIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}>
    <path d="M5 9h14M5 15h14" />
  </svg>
)

export const CheckIcon = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const CalendarIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.2}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </svg>
)

export const ScaleIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.2}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M9 9.5a4 4 0 0 1 6 0M12 12l1.6-2.4" />
  </svg>
)
