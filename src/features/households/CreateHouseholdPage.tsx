import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { InfoNote } from '../../components/InfoNote'
import { TextField } from '../../components/TextField'
import { createHousehold } from '../../data/households'
import { db } from '../../lib/firebase'
import { AuthLayout } from '../auth/AuthLayout'
import { BackBar, FormError } from '../auth/parts'
import { useAuth } from '../auth/useAuth'
import { useSubmit } from '../auth/useSubmit'

/** 4 · Create a household. */
export function CreateHouseholdPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const { busy, errors, setErrors, run, formRef } = useSubmit()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || !user) return
    if (!name.trim()) return setErrors({ name: 'Give your household a name.' })
    let hid = ''
    void run('form', async () => {
      hid = await createHousehold(db, { uid: user.uid, displayName: user.displayName ?? '' }, name)
    }).then((ok) => ok && navigate(`/h/${hid}`))
  }

  return (
    <AuthLayout>
      <BackBar fallback="/start" />
      <form ref={formRef} aria-label="Create a household" noValidate onSubmit={onSubmit} className="flex flex-1 flex-col px-4 pb-4">
        <h1 className="m-0 text-title">Name your household</h1>
        <p className="mt-1 mb-0 text-body text-fg-muted">Use something everyone will recognise.</p>
        <div className="flex-1" />
        <div className="flex flex-col gap-4">
          <TextField
            label="Household name"
            placeholder="e.g. Flat on Main St or The Nowaks"
            hint="Everyone in the household sees this. You can change it later."
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <InfoNote>
            We’ll add a <strong>General</strong> room to start with. You can invite people on the next screen.
          </InfoNote>
          <FormError message={errors.form} />
          <Button type="submit" variant="primary" size="lg" block loading={busy === 'form'}>
            {busy === 'form' ? 'Creating household…' : 'Create household'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
