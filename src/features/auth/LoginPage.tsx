import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { AppMark } from '../../components/AppMark'
import { Button } from '../../components/Button'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { OrDivider } from '../../components/OrDivider'
import { PasswordField } from '../../components/PasswordField'
import { TextField } from '../../components/TextField'
import { signIn, signInWithGoogle } from '../../data/auth'
import { AuthLayout } from './AuthLayout'
import { ChorePreview } from './ChorePreview'
import { FooterLink, FormError, InlineLink } from './parts'
import { useSubmit } from './useSubmit'

export function LoginPage() {
  const [params] = useSearchParams()
  const query = params.toString() ? `?${params}` : ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, errors, setErrors, run } = useSubmit()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const missing = {
      email: email.trim() ? undefined : 'Enter your email.',
      password: password ? undefined : 'Enter your password.',
    }
    if (missing.email || missing.password) return setErrors(missing)
    void run('form', () => signIn(email, password))
  }

  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col justify-center gap-4 px-4 pt-6 pb-5">
        <AppMark />
        <p className="m-0 max-w-80 text-[18px] leading-[26px] text-fg-muted">One shared list for the chores at home.</p>
        <ChorePreview />
      </div>
      <form aria-label="Log in" noValidate onSubmit={onSubmit} className="flex shrink-0 flex-col gap-3 px-4 pb-4">
        <GoogleSignInButton loading={busy === 'google'} onClick={() => void run('google', signInWithGoogle)} />
        <FormError message={errors.form} />
        <OrDivider />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          labelAction={<InlineLink to={`/forgot${query}`}>Forgot password?</InlineLink>}
        />
        <Button type="submit" variant="secondary" size="lg" block loading={busy === 'form'} className="mt-1">
          {busy === 'form' ? 'Logging in…' : 'Log in'}
        </Button>
        <FooterLink text="New here?" to={`/signup${query}`} label="Create an account" />
      </form>
    </AuthLayout>
  )
}
