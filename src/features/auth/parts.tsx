import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'

const linkClass = 'inline-flex min-h-(--size-touch) items-center px-1 font-semibold text-primary no-underline hover:underline'

/** "New here? Create an account" style footer line. */
export function FooterLink({ text, to, label }: { text: string; to: string; label: string }) {
  return (
    <p className="m-0 flex items-center justify-center gap-1 text-[15px] leading-[22px] text-fg-muted">
      {text}
      <Link to={to} className={linkClass}>
        {label}
      </Link>
    </p>
  )
}

/** Small inline link with a 44px hit area that doesn't push the layout (e.g. "Forgot password?"). */
export function InlineLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-my-3 inline-flex min-h-(--size-touch) items-center px-0.5 text-[14px] leading-5 font-semibold text-primary no-underline hover:underline">
      {children}
    </Link>
  )
}

/** Form-level error (e.g. Google sign-in didn't finish). */
export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="m-0 flex items-start gap-1.5 text-[13px] leading-[18px] text-danger">
      <Icon name="circle-alert" size={16} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  )
}

export function BackBar({ fallback = '/login' }: { fallback?: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex h-(--size-header) shrink-0 items-center px-2">
      <IconButton
        icon="chevron-left"
        label="Back"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(fallback))}
      />
    </div>
  )
}
