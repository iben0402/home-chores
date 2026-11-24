import {
  Bath,
  BedDouble,
  CookingPot,
  EllipsisVertical,
  GripVertical,
  Pencil,
  Shirt,
  Sofa,
  Sprout,
  Trash,
  Trash2,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  DoorOpen,
  CircleAlert,
  ClockAlert,
  Eye,
  EyeOff,
  Hand,
  History,
  House,
  Info,
  ListTodo,
  LogOut,
  Plus,
  Share2,
  Shield,
  LoaderCircle,
  Mail,
  SkipForward,
  Sun,
  UserRound,
  UserRoundPlus,
  UsersRound,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'

// Lucide icons in use, by the names the design system uses. Add here as screens need more.
const icons = {
  'bath': Bath,
  'bed-double': BedDouble,
  'cooking-pot': CookingPot,
  'ellipsis-vertical': EllipsisVertical,
  'grip-vertical': GripVertical,
  'pencil': Pencil,
  'shirt': Shirt,
  'sofa': Sofa,
  'sprout': Sprout,
  'trash': Trash,
  'trash-2': Trash2,
  bell: Bell,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  copy: Copy,
  'door-open': DoorOpen,
  'circle-alert': CircleAlert,
  'clock-alert': ClockAlert,
  eye: Eye,
  'eye-off': EyeOff,
  hand: Hand,
  history: History,
  house: House,
  info: Info,
  'list-todo': ListTodo,
  'log-out': LogOut,
  plus: Plus,
  'share-2': Share2,
  shield: Shield,
  'loader-circle': LoaderCircle,
  mail: Mail,
  'skip-forward': SkipForward,
  sun: Sun,
  'user-round': UserRound,
  'user-round-plus': UserRoundPlus,
  'users-round': UsersRound,
  'wifi-off': WifiOff,
  x: X,
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
