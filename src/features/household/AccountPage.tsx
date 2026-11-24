import { useState, type FormEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { TopBar } from '../../components/TopBar'
import { signOut, updateDisplayName } from '../../data/auth'
import { updateMyName } from '../../data/households'
import { auth, db } from '../../lib/firebase'
import { AuthLayout } from '../auth/AuthLayout'
import { FormError } from '../auth/parts'
import { useAuth } from '../auth/useAuth'
import { useMyHouseholds } from '../households/useMyHouseholds'

/** Your account: the name housemates see (in every household), your email, log out. */
export function AccountPage() {
  const { user } = useAuth()
  const { households } = useMyHouseholds()
  const [name, setName] = useState(user?.displayName ?? '')
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<false | 'save' | 'logout'>(false)
  if (!user) return null
  const changed = name.trim() !== (user.displayName ?? '').trim()
  const google = auth.currentUser?.providerData.some((p) => p.providerId === 'google.com') ?? false

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Add your name so your household knows who’s who.')
    setBusy('save')
    setError(undefined)
    try {
      await updateDisplayName(name.trim())
      await updateMyName(db, user!.uid, name.trim(), households.map((h) => h.id))
      setSaved(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <TopBar title="Your account" back="/" />
      <form noValidate onSubmit={save} aria-label="Your account" className="flex flex-col gap-4 px-4 pt-2">
        <div className="flex items-center gap-3">
          <Avatar name={name || user.displayName || ''} color={1} size="lg" />
          <span className="flex flex-col">
            <span className="text-[18px] leading-6 font-semibold">{name || user.displayName}</span>
            <span className="text-[13px] leading-[18px] text-fg-muted">Your colour and initials come from your name.</span>
          </span>
        </div>
        <TextField
          label="Your name"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          hint="This is what people in your household see."
          error={error}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] leading-5 font-semibold">Email</span>
          <div className="flex min-h-12 items-center rounded-md bg-surface-sunken px-3">{user.email}</div>
          <p className="m-0 text-[13px] leading-[18px] text-fg-muted">
            {google ? 'Signed in with Google. Change your email in your Google account.' : 'You sign in with this email.'}
          </p>
        </div>
        <FormError message={undefined} />
        <Button type="submit" variant="primary" size="lg" block disabled={!changed || busy !== false} loading={busy === 'save'}>
          {saved && !changed ? 'Saved' : 'Save name'}
        </Button>
      </form>
      <div className="flex-1" />
      <div className="flex flex-col gap-2 px-4 pt-8 pb-6">
        {households.length > 1 && <p className="m-0 text-center text-[13px] leading-[18px] text-fg-muted">You’re in {households.length} households. Your name is the same in each.</p>}
        <Button
          variant="secondary"
          size="lg"
          block
          icon="log-out"
          loading={busy === 'logout'}
          onClick={() => {
            setBusy('logout')
            signOut().catch(() => setBusy(false))
          }}
        >
          Log out
        </Button>
      </div>
    </AuthLayout>
  )
}
