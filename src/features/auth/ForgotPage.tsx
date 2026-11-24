import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { TextField } from '../../components/TextField'
import { sendReset } from '../../data/auth'
import { AuthLayout } from './AuthLayout'
import { BackBar, FooterLink, FormError } from './parts'
import { useSubmit } from './useSubmit'

export function ForgotPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loginPath = `/login${params.toString() ? `?${params}` : ''}`
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [resent, setResent] = useState(false)
  const { busy, errors, setErrors, run, formRef } = useSubmit()

  async function send() {
    if (!email.trim()) return setErrors({ email: 'Enter your email.' })
    // Same message whether or not the account exists, so this can't be used to probe emails.
    setResent(false)
    if (await run('form', () => sendReset(email).catch((e) => (e?.code === 'auth/user-not-found' ? undefined : Promise.reject(e))))) {
      if (sent) setResent(true)
      setSent(true)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!busy) void send()
  }

  return (
    <AuthLayout>
      <BackBar />
      {sent ? (
        <div className="flex flex-1 flex-col px-4 pb-4">
          <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <span aria-hidden="true" className="mb-2 grid size-16 place-items-center rounded-full bg-surface-sunken text-fg-muted">
              <Icon name="mail" size={28} />
            </span>
            <h1 className="m-0 text-title">Check your email</h1>
            <p className="m-0 max-w-[300px] text-body text-fg-muted">If there’s an account for that email, we’ve sent a reset link.</p>
            <p className="m-0 max-w-[300px] text-[14px] leading-5 text-fg-muted">It can take a minute. Check your spam folder too.</p>
          </div>
          <div className="flex flex-col gap-2">
            <FormError message={errors.form ?? errors.email} />
            {resent && (
              <p role="status" className="m-0 text-center text-[14px] leading-5 text-fg-muted">
                Sent again.
              </p>
            )}
            <Button variant="secondary" size="lg" block onClick={() => navigate(loginPath)}>
              Back to log in
            </Button>
            <Button variant="ghost" size="lg" block loading={busy === 'form'} onClick={() => void send()}>
              Send it again
            </Button>
          </div>
        </div>
      ) : (
        <form ref={formRef} aria-label="Reset your password" noValidate onSubmit={onSubmit} className="flex flex-1 flex-col px-4 pb-4">
          <h1 className="m-0 text-title">Reset your password</h1>
          <p className="mt-1 mb-0 text-body text-fg-muted">Enter the email you signed up with. We’ll send you a link to set a new password.</p>
          <div className="flex-1" />
          <div className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <FormError message={errors.form ?? errors.password} />
            <Button type="submit" variant="primary" size="lg" block loading={busy === 'form'}>
              Send reset link
            </Button>
            <FooterLink text="Remembered it?" to={loginPath} label="Log in" />
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
