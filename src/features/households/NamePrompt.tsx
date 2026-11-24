import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { updateDisplayName } from '../../data/auth'
import { AuthLayout } from '../auth/AuthLayout'
import { FormError } from '../auth/parts'
import { useSubmit } from '../auth/useSubmit'

/** Shown before Get started when the account has no name, so member docs never get an empty one. */
export function NamePrompt() {
  const [name, setName] = useState('')
  const { busy, errors, setErrors, run, formRef } = useSubmit()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!name.trim()) return setErrors({ name: 'Add your name so your household knows who’s who.' })
    void run('form', () => updateDisplayName(name))
  }

  return (
    <AuthLayout>
      <form ref={formRef} aria-label="Add your name" noValidate onSubmit={onSubmit} className="flex flex-1 flex-col px-4 pt-14 pb-4">
        <h1 className="m-0 text-title">What should we call you?</h1>
        <p className="mt-1 mb-0 text-body text-fg-muted">People in your household will see this name.</p>
        <div className="flex-1" />
        <div className="flex flex-col gap-4">
          <TextField
            label="Your name"
            autoComplete="name"
            placeholder="e.g. Anna Nowak"
            hint="This is what people in your household see."
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <FormError message={errors.form} />
          <Button type="submit" variant="primary" size="lg" block loading={busy === 'form'}>
            Continue
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
