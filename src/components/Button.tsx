import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'take'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'border-transparent bg-primary text-on-primary enabled:hover:bg-primary-hover enabled:active:bg-primary-pressed',
  secondary: 'bg-surface text-fg border-border-strong enabled:hover:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-primary enabled:hover:bg-surface-hover',
  destructive: 'border-transparent bg-danger text-on-danger enabled:hover:bg-danger-hover',
  take: 'border-transparent bg-primary-soft text-primary enabled:hover:bg-primary enabled:hover:text-on-primary',
}

const sizes: Record<Size, string> = {
  // sm is visually 36px; the ::after extends the hit area to 44px.
  sm: 'relative min-h-9 px-3 text-[14px] after:absolute after:inset-x-0 after:-inset-y-1',
  md: 'min-h-(--size-touch) px-4 text-[16px]',
  lg: 'min-h-[52px] px-5 text-[17px]',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  block?: boolean
  loading?: boolean
  icon?: IconName
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  icon,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border leading-5 font-semibold whitespace-nowrap',
        'transition-[background-color,border-color,transform] duration-(--duration-fast) ease-standard enabled:active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-sunken disabled:text-fg-disabled aria-busy:cursor-progress',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="loader-circle" className="animate-spin" />
      ) : (
        icon && <Icon name={icon} />
      )}
      {children}
    </button>
  )
}
