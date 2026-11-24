import {
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  ClockAlert,
  Eye,
  EyeOff,
  Hand,
  House,
  LoaderCircle,
  Mail,
  SkipForward,
  Sun,
  UserRound,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

// Lucide icons in use, by the names the design system uses. Add here as screens need more.
const icons = {
  calendar: Calendar,
  'calendar-days': CalendarDays,
  check: Check,
  'chevron-left': ChevronLeft,
  'circle-alert': CircleAlert,
  'clock-alert': ClockAlert,
  eye: Eye,
  'eye-off': EyeOff,
  hand: Hand,
  house: House,
  'loader-circle': LoaderCircle,
  mail: Mail,
  'skip-forward': SkipForward,
  sun: Sun,
  'user-round': UserRound,
  'wifi-off': WifiOff,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof icons

type IconProps = {
  name: IconName
  size?: number
  className?: string
  /** Only when the icon is the sole label; otherwise it is hidden from screen readers. */
  label?: string
}

export function Icon({ name, size = 20, className, label }: IconProps) {
  const Component = icons[name]
  return label ? (
    <Component size={size} strokeWidth={2} className={className} role="img" aria-label={label} />
  ) : (
    <Component size={size} strokeWidth={2} className={className} aria-hidden="true" />
  )
}
