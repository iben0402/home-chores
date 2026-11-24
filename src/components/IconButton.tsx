import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }

/** 44px round button holding only an icon: back, close, more… */
export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        'relative inline-flex size-(--size-touch) cursor-pointer items-center justify-center rounded-full text-fg',
        'transition-colors duration-(--duration-fast) enabled:hover:bg-surface-hover enabled:active:bg-surface-sunken disabled:cursor-not-allowed disabled:text-fg-disabled',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}
