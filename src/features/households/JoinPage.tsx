import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { AppMark } from '../../components/AppMark'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'
import { Icon } from '../../components/Icon'
import { InfoNote } from '../../components/InfoNote'
import { OrDivider } from '../../components/OrDivider'
import { signInWithGoogle } from '../../data/auth'
import { findInvite, getHouseholdPreview, isMember, joinHousehold, type InviteLookup, type MemberPreview } from '../../data/households'
import { normalizeCode } from '../../lib/inviteCode'
import { firstName } from '../../lib/names'
import { db } from '../../lib/firebase'
import { AuthLayout } from '../auth/AuthLayout'
import { BackBar, FooterLink, FormError } from '../auth/parts'
import { useAuth } from '../auth/useAuth'
import { useSubmit } from '../auth/useSubmit'
import { inviteError } from './inviteMessages'
import { JoinCodePage } from './JoinCodePage'

type Loaded =
  | { kind: 'loading' }
  | { kind: 'invalid'; lookup: InviteLookup }
  | { kind: 'signed-out'; householdName: string }
  | { kind: 'member'; hid: string }
  | { kind: 'confirm'; hid: string; name: string; members: MemberPreview[] }
  | { kind: 'error' }

/** /join/:code — 5a when signed out, otherwise 5c (or straight in if already a member). */
export function JoinPage() {
  const params = useParams()
  const code = normalizeCode(params.code ?? '')
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<Loaded>({ kind: 'loading' })

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    ;(async () => {
      const lookup = await findInvite(db, code)
      if (lookup.status !== 'ok') return { kind: 'invalid', lookup } as const
      if (!user) return { kind: 'signed-out', householdName: lookup.householdName } as const
      if (await isMember(db, lookup.householdId, user.uid)) return { kind: 'member', hid: lookup.householdId } as const
      const preview = await getHouseholdPreview(db, lookup.householdId)
      return { kind: 'confirm', hid: lookup.householdId, ...preview } as const
    })()
      .then((next) => !cancelled && setState(next))
      .catch(() => !cancelled && setState({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [code, user, authLoading])

  if (state.kind === 'loading') return null
  if (state.kind === 'member') return <Navigate to={`/h/${state.hid}`} replace />
  if (state.kind === 'invalid') {
    return user ? <JoinCodePage initialCode={code} initialError={inviteError(state.lookup)} /> : <InvalidSignedOut message={inviteError(state.lookup)!} code={code} />
  }
  if (state.kind === 'signed-out') return <InvitedSignedOut householdName={state.householdName} code={code} />
  if (state.kind === 'error') return <JoinCodePage initialCode={code} />
  return <JoinConfirm code={code} hid={state.hid} name={state.name} members={state.members} />
}

function nextQuery(code: string) {
  return `?next=${encodeURIComponent(`/join/${code}`)}`
}

function CompactHeader() {
  return (
    <div className="flex h-(--size-header) shrink-0 items-center px-4">
      <AppMark compact />
    </div>
  )
}

/** 5a · Invited, signed out. After logging in or signing up, they come back here and see 5c. */
function InvitedSignedOut({ householdName, code }: { householdName: string; code: string }) {
  const { busy, errors, run } = useSubmit()
  const next = nextQuery(code)
  return (
    <AuthLayout>
      <CompactHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <span aria-hidden="true" className="mb-2 grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon name="door-open" size={28} />
        </span>
        <p className="m-0 text-body text-fg-muted">You’ve been invited to join</p>
        <h1 className="m-0 text-display">{householdName}</h1>
        <p className="mt-2 mb-0 max-w-[300px] text-body text-fg-muted">Log in or create an account, and you’ll join straight after.</p>
      </div>
      <section aria-label="Log in to join" className="flex shrink-0 flex-col gap-3 px-4 pb-4">
        <GoogleSignInButton loading={busy === 'google'} onClick={() => void run('google', signInWithGoogle)} />
        <FormError message={errors.form} />
        <OrDivider />
        <Link
          to={`/login${next}`}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-[17px] leading-5 font-semibold text-fg no-underline hover:bg-surface-hover"
        >
          Log in with email
        </Link>
        <FooterLink text="New here?" to={`/signup${next}`} label="Create an account" />
      </section>
    </AuthLayout>
  )
}

function InvalidSignedOut({ message, code }: { message: string; code: string }) {
  return (
    <AuthLayout>
      <CompactHeader />
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span aria-hidden="true" className="mb-2 grid size-16 place-items-center rounded-full bg-surface-sunken text-fg-muted">
          <Icon name="circle-alert" size={28} />
        </span>
        <h1 className="m-0 text-title">This invite doesn’t work</h1>
        <p className="m-0 max-w-[300px] text-body text-fg-muted">{message}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-4">
        <FooterLink text="Have an account?" to={`/login${nextQuery(code)}`} label="Log in" />
      </div>
    </AuthLayout>
  )
}

function adminSentence(members: MemberPreview[]): string {
  const names = members.filter((m) => m.admin).map((m) => firstName(m.displayName))
  if (names.length === 0) return 'As a member you can take, assign and tick off chores.'
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `As a member you can take, assign and tick off chores. ${who} ${names.length === 1 ? 'looks' : 'look'} after the household settings.`
}

/** 5c · Confirm and join. */
function JoinConfirm({ code, hid, name, members }: { code: string; hid: string; name: string; members: MemberPreview[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { busy, errors, run } = useSubmit()
  const count = members.length

  return (
    <AuthLayout>
      <BackBar fallback="/" />
      <div className="flex flex-1 flex-col px-4 pb-4">
        <h1 className="m-0 text-title">Join {name}?</h1>
        <p className="mt-1 mb-0 text-body text-fg-muted">
          {count === 1 ? '1 person is in this household.' : `${count} people are in this household.`}
        </p>
        <ul aria-label="Members" className="mt-5 mb-0 list-none rounded-lg border border-border bg-surface px-0 py-1 shadow-sm">
          {members.map((member, i) => (
            <li key={member.uid} className={`flex min-h-14 items-center gap-3 px-4 py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
              <Avatar name={member.displayName} color={member.color} size="lg" />
              <span className="flex-1 text-body-medium">{firstName(member.displayName)}</span>
              {member.admin && (
                <span className="inline-flex items-center gap-1 text-caption text-fg-muted">
                  <Icon name="shield" size={16} />
                  Admin
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="flex-1" />
        <div className="flex flex-col gap-4 pt-4">
          <InfoNote>{adminSentence(members)}</InfoNote>
          <FormError message={errors.form} />
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              block
              loading={busy === 'form'}
              onClick={() => {
                if (!user) return
                void run('form', () => joinHousehold(db, { uid: user.uid, displayName: user.displayName ?? '' }, code, hid)).then(
                  (ok) => ok && navigate(`/h/${hid}`, { replace: true }),
                )
              }}
            >
              {busy === 'form' ? 'Joining…' : 'Join household'}
            </Button>
            <Button variant="ghost" size="lg" block disabled={busy === 'form'} onClick={() => navigate('/')}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
