import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { safeNext } from '../../app/safeNext'
import { Button } from '../../components/Button'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { OrDivider } from '../../components/OrDivider'
import { PasswordField } from '../../components/PasswordField'
import { TextField } from '../../components/TextField'
import { signInWithGoogle, signUp } from '../../data/auth'
import { AuthLayout } from './AuthLayout'
import { BackBar, FooterLink, FormError } from './parts'
import { useAuth } from './useAuth'
import { useSubmit } from './useSubmit'

const EMAIL_IN_USE = 'There’s already an account with this email.'

export function SignUpPage() {
  const [params] = useSearchParams()
  const query = params.toString() ? `?${params}` : ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, errors, setErrors, run, formRef } = useSubmit()
  const { user, loading } = useAuth()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy === 'form') return
    const invalid = {
      name: name.trim() ? undefined : 'Add your name so your household knows who’s who.',
      email: email.trim() ? undefined : 'Enter your email.',
      password: password.length >= 6 ? undefined : 'Use at least 6 characters.',
    }
    if (invalid.name || invalid.email || invalid.password) return setErrors(invalid)
    void run('form', () => signUp({ name, email, password }))
  }

  if (loading) return null
  // Wait for our own sign-up to finish (name saved) before moving on.
  if (user && !busy) return <Navigate to={safeNext(params.get('next'))} replace />

  return (
    <AuthLayout>
      <BackBar />
      <div className="flex flex-col gap-1 px-4">
        <h1 className="m-0 text-title">Create your account</h1>
        <p className="m-0 text-body text-fg-muted">You’ll set up or join a household next.</p>
      </div>
      <div className="min-h-4 flex-1" />
      <form aria-label="Create account" ref={formRef} noValidate onSubmit={onSubmit} className="flex shrink-0 flex-col gap-3 px-4 pb-4">
        <GoogleSignInButton loading={busy === 'google'} disabled={busy === 'form'} onClick={() => void run('google', signInWithGoogle)} />
        <FormError message={errors.form} />
        <OrDivider />
        <TextField
          label="Your name"
          autoComplete="name"
          placeholder="e.g. Anna Nowak"
          hint="This is what people in your household see."
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <div className="flex flex-col">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          {errors.email === EMAIL_IN_USE && (
            <Link
              to={`/login${query}`}
              className="-mb-3 ml-[22px] inline-flex min-h-(--size-touch) items-center self-start text-[14px] leading-5 font-semibold text-primary no-underline hover:underline"
            >
              Log in instead
            </Link>
          )}
        </div>
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 6 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" variant="secondary" size="lg" block loading={busy === 'form'} className="mt-1">
          {busy === 'form' ? 'Creating account…' : 'Create account'}
        </Button>
        <FooterLink text="Already have an account?" to={`/login${query}`} label="Log in" />
      </form>
    </AuthLayout>
  )
}
