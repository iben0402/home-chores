import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { TextField } from '../../components/TextField'
import { sendReset } from '../../data/auth'
import { AuthLayout } from './AuthLayout'
import { BackBar, FooterLink, FormError } from './parts'
import { useSubmit } from './useSubmit'

export function ForgotPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { busy, errors, setErrors, run } = useSubmit()

  async function send() {
    if (!email.trim()) return setErrors({ email: 'Enter your email.' })
    // Same message whether or not the account exists, so this can't be used to probe emails.
    if (await run('form', () => sendReset(email).catch((e) => (e?.code === 'auth/user-not-found' ? undefined : Promise.reject(e))))) {
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
            <Button variant="secondary" size="lg" block onClick={() => navigate('/login')}>
              Back to log in
            </Button>
            <Button variant="ghost" size="lg" block loading={busy === 'form'} onClick={() => void send()}>
              Send it again
            </Button>
          </div>
        </div>
      ) : (
        <form aria-label="Reset your password" noValidate onSubmit={onSubmit} className="flex flex-1 flex-col px-4 pb-4">
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
            <FooterLink text="Remembered it?" to="/login" label="Log in" />
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
