import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { CodeInput } from '../../components/CodeInput'
import { findInvite } from '../../data/households'
import { CODE_LENGTH } from '../../lib/inviteCode'
import { db } from '../../lib/firebase'
import { AuthLayout } from '../auth/AuthLayout'
import { BackBar, FormError } from '../auth/parts'
import { useSubmit } from '../auth/useSubmit'
import { inviteError } from './inviteMessages'

/** 5b · Join with a code. Also shown for a bad invite link, with the code and error prefilled. */
export function JoinCodePage({ initialCode = '', initialError }: { initialCode?: string; initialError?: string }) {
  const navigate = useNavigate()
  const [code, setCode] = useState(initialCode)
  const [codeError, setCodeError] = useState(initialError)
  const { busy, errors, run } = useSubmit()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || code.length !== CODE_LENGTH) return
    void run('form', async () => {
      const lookup = await findInvite(db, code)
      const error = inviteError(lookup)
      setCodeError(error)
      if (!error) navigate(`/join/${code}`)
    })
  }

  return (
    <AuthLayout>
      <BackBar fallback="/start" />
      <form aria-label="Join with a code" noValidate onSubmit={onSubmit} className="flex flex-1 flex-col px-4 pb-4">
        <h1 className="m-0 text-title">Join with a code</h1>
        <p className="mt-1 mb-0 text-body text-fg-muted">Ask someone in the household for their 8-character code. It’s on their Household screen.</p>
        <div className="flex-1" />
        <div className="flex flex-col gap-5">
          <CodeInput
            value={code}
            onChange={(next) => {
              setCode(next)
              setCodeError(undefined)
            }}
            error={codeError}
          />
          <FormError message={errors.form} />
          <Button type="submit" variant="primary" size="lg" block disabled={code.length !== CODE_LENGTH} loading={busy === 'form'}>
            {busy === 'form' ? 'Checking…' : 'Join'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
