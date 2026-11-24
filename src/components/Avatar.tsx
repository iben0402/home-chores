import { cx } from './cx'

export type MemberColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

// Static class strings so Tailwind can see them.
const colors: Record<MemberColor, string> = {
  1: 'bg-member-1 text-member-1-ink',
  2: 'bg-member-2 text-member-2-ink',
  3: 'bg-member-3 text-member-3-ink',
  4: 'bg-member-4 text-member-4-ink',
  5: 'bg-member-5 text-member-5-ink',
  6: 'bg-member-6 text-member-6-ink',
  7: 'bg-member-7 text-member-7-ink',
  8: 'bg-member-8 text-member-8-ink',
  9: 'bg-member-9 text-member-9-ink',
  10: 'bg-member-10 text-member-10-ink',
}

const sizes = {
  xs: 'size-(--size-avatar-xs) text-[9px]',
  sm: 'size-(--size-avatar-sm) text-[11px]',
  md: 'size-(--size-avatar-md) text-[13px]',
  lg: 'size-(--size-avatar-lg) text-[15px]',
} as const

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

/** Member avatar: always initials (never colour alone); screen readers get the name. */
export function Avatar({ name, color, size = 'md' }: { name: string; color: MemberColor; size?: keyof typeof sizes }) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full leading-none font-bold tracking-[0.02em] select-none',
        colors[color],
        sizes[size],
      )}
    >
      {initials(name)}
    </span>
  )
}
