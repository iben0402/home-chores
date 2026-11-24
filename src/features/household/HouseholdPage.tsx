import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/BottomSheet'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { InviteCard } from '../../components/InviteCard'
import { MemberRow } from '../../components/MemberRow'
import { SheetAction } from '../../components/SheetAction'
import { Snackbar } from '../../components/Snackbar'
import { TextField } from '../../components/TextField'
import { regenerateInviteCode, removeMember, renameHousehold, setAdmin, watchInviteCode, type Member } from '../../data/households'
import { db } from '../../lib/firebase'
import { firstName } from '../../lib/names'
import { FormError } from '../auth/parts'
import { useAuth } from '../auth/useAuth'
import { useMembers } from '../chores/useHouseholdData'
import { useRooms } from '../rooms/useRooms'
import { useHousehold } from '../shell/useHousehold'
import { useIsAdmin } from '../shell/useIsAdmin'

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const joinedLabel = (d?: Date) => (d ? `Joined ${MONTH[d.getMonth()]} ${d.getFullYear()}` : undefined)

type Open =
  | { kind: 'member'; member: Member }
  | { kind: 'remove'; member: Member }
  | { kind: 'rename' }
  | { kind: 'newCode' }
  | { kind: 'leave' }
  | null

/** The Household tab: you, the people and their roles, the invite, admin links, leave. */
export function HouseholdPage() {
  const household = useHousehold()
  const isAdmin = useIsAdmin()
  const { user } = useAuth()
  const navigate = useNavigate()
  const members = useMembers(household.id)
  const rooms = useRooms(household.id)
  const [code, setCode] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [snack, setSnack] = useState<string | null>(null)

  useEffect(() => watchInviteCode(db, household.id, setCode, () => setCode(null)), [household.id])
  useEffect(() => {
    if (!snack) return
    const id = window.setTimeout(() => setSnack(null), 5000)
    return () => window.clearTimeout(id)
  }, [snack])

  if (!user) return null
  const people = [...members.values()].sort((a, b) => Number(b.uid === user.uid) - Number(a.uid === user.uid))
  const admins = household.adminUids
  const soleAdmin = isAdmin && admins.filter((uid) => members.has(uid)).length <= 1
  const me = members.get(user.uid)
  const link = code ? `${window.location.origin}/join/${code}` : ''

  async function act(action: () => Promise<unknown>, done?: string) {
    setBusy(true)
    try {
      await action()
      setOpen(null)
      if (done) setSnack(done)
    } catch {
      setOpen(null)
      setSnack('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!code) return
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${household.name} on Chours`, url: link })
        return
      } catch {
        // Cancelled: fall through to copying.
      }
    }
    await navigator.clipboard?.writeText(link).catch(() => {})
    setSnack('Link copied')
  }

  return (
    <div className="pb-10">
      <div className="flex h-(--size-header) items-center gap-1 pr-2 pl-4">
        <h1 className="m-0 flex-1 text-title">Household</h1>
        {isAdmin && <IconButton icon="pencil" label="Rename household" onClick={() => setOpen({ kind: 'rename' })} />}
      </div>
      <p className="m-0 px-4 pb-2 text-[15px] leading-[22px] text-fg-muted">
        {household.name} · {people.length} {people.length === 1 ? 'person' : 'people'}
        {rooms ? ` · ${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}` : ''}
      </p>

      <Link to="/account" className="flex min-h-[72px] items-center gap-3 border-y border-border bg-surface py-2 pr-2 pl-4 text-fg no-underline hover:bg-surface-hover">
        <Avatar name={user.displayName ?? ''} color={me?.color ?? 1} size="lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[16px] leading-[22px] font-semibold">Your account</span>
          <span className="truncate text-[13px] leading-[18px] text-fg-muted">
            {user.displayName} · {user.email}
          </span>
        </span>
        <Icon name="chevron-right" className="w-11 text-fg-muted" />
      </Link>

      <h2 className="m-0 px-4 pt-5 pb-2 text-overline text-fg-muted uppercase">
        People <span className="font-medium tracking-normal">· {people.length}</span>
      </h2>
      <div role="list" aria-label="People" className="[&>*+*]:border-t [&>*+*]:border-border">
        {people.map((m) => (
          <MemberRow
            key={m.uid}
            name={m.displayName}
            color={m.color}
            you={m.uid === user.uid}
            admin={admins.includes(m.uid)}
            sub={joinedLabel(m.joinedAt)}
            onMenu={isAdmin && m.uid !== user.uid ? () => setOpen({ kind: 'member', member: m }) : undefined}
          />
        ))}
      </div>

      {code && (
        <section aria-labelledby="invite-title" className="mx-4 mt-5 flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 pt-5 pb-4 shadow-sm">
          <h2 id="invite-title" className="m-0 text-heading">
            Invite someone
          </h2>
          <InviteCard
            code={code}
            copied={copied}
            hint="They can open the link, or enter the code after signing up."
            copyLabel="Copy code"
            shareLabel="Share link"
            onCopy={() => {
              void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => {})
            }}
            onShare={() => void share()}
            onNewCode={isAdmin ? () => setOpen({ kind: 'newCode' }) : undefined}
          />
        </section>
      )}

      {isAdmin && (
        <>
          <h2 className="m-0 px-4 pt-5 pb-2 text-overline text-fg-muted uppercase">Admin</h2>
          <div className="border-y border-border bg-surface">
            <Link to={`/h/${household.id}/rooms/manage`} className="flex min-h-14 items-center gap-4 px-5 text-body-medium text-fg no-underline hover:bg-surface-hover">
              <Icon name="door-open" size={22} className="text-fg-muted" />
              <span className="flex-1">Rooms</span>
              {rooms && <span className="text-[14px] text-fg-muted">{rooms.length}</span>}
            </Link>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 px-4 pt-4">
        <button
          type="button"
          disabled={soleAdmin}
          aria-describedby={soleAdmin ? 'leave-why' : undefined}
          onClick={() => setOpen({ kind: 'leave' })}
          className="inline-flex min-h-(--size-touch) cursor-pointer items-center gap-2 self-start rounded-md px-3 font-semibold text-danger hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:bg-transparent"
        >
          <Icon name="log-out" />
          Leave household
        </button>
        {soleAdmin && (
          <div id="leave-why" className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3 text-[15px] leading-[22px]">
            <Icon name="shield" className="mt-px shrink-0 text-primary" />
            <span>
              <strong className="font-semibold">You’re the only admin.</strong>
              <span className="mt-0.5 block text-[13px] leading-[18px] text-fg-muted">Make someone else an admin first, then you can leave.</span>
            </span>
          </div>
        )}
      </div>

      {open?.kind === 'member' && (
        <BottomSheet
          title={open.member.displayName}
          subtitle={`${admins.includes(open.member.uid) ? 'Admin' : 'Member'}${open.member.joinedAt ? ` · ${joinedLabel(open.member.joinedAt)!.toLowerCase()}` : ''}`}
          onClose={() => setOpen(null)}
        >
          {admins.includes(open.member.uid) ? (
            <SheetAction icon="shield" label="Remove admin role" onClick={() => void act(() => setAdmin(db, household.id, open.member.uid, false), `${firstName(open.member.displayName)} is no longer an admin`)} />
          ) : (
            <SheetAction icon="shield" label="Make admin" onClick={() => void act(() => setAdmin(db, household.id, open.member.uid, true), `${firstName(open.member.displayName)} is now an admin`)} />
          )}
          <div role="separator" className="mx-5 my-1 h-px bg-border" />
          <SheetAction icon="user-round-minus" label="Remove from household" danger onClick={() => setOpen({ kind: 'remove', member: open.member })} />
        </BottomSheet>
      )}

      {open?.kind === 'remove' && (
        <ConfirmDialog
          title={`Remove ${firstName(open.member.displayName)} from the household?`}
          body={`${firstName(open.member.displayName)}’s open chores become unassigned. Their history stays.`}
          confirmLabel="Remove"
          confirmIcon="user-round-minus"
          loading={busy}
          onCancel={() => setOpen(null)}
          onConfirm={() => void act(() => removeMember(db, household.id, open.member.uid, user.uid), `${firstName(open.member.displayName)} was removed`)}
        />
      )}

      {open?.kind === 'rename' && (
        <RenameSheet name={household.name} onSave={(name) => act(() => renameHousehold(db, household.id, name))} onClose={() => setOpen(null)} />
      )}

      {open?.kind === 'newCode' && (
        <ConfirmDialog
          title="Get a new invite code?"
          body="The old code and link stop working. Anyone who hasn’t joined yet will need the new one."
          confirmLabel="Get new code"
          confirmIcon="repeat-2"
          loading={busy}
          onCancel={() => setOpen(null)}
          onConfirm={() => void act(() => regenerateInviteCode(db, household.id, user.uid), 'New code ready')}
        />
      )}

      {open?.kind === 'leave' && (
        <ConfirmDialog
          title={`Leave ${household.name}?`}
          body="Your open chores become unassigned. Your history stays. To come back, you’ll need a new invite."
          confirmLabel="Leave"
          confirmIcon="log-out"
          loading={busy}
          onCancel={() => setOpen(null)}
          onConfirm={() =>
            void act(async () => {
              await removeMember(db, household.id, user.uid, user.uid)
              navigate('/', { replace: true, state: { notMemberOf: household.id } })
            })
          }
        />
      )}

      {snack && <Snackbar message={snack} />}
    </div>
  )
}

function RenameSheet({ name, onSave, onClose }: { name: string; onSave: (name: string) => Promise<unknown>; onClose: () => void }) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return setError('Give your household a name.')
    setBusy(true)
    await onSave(value.trim())
  }
  return (
    <BottomSheet title="Rename household" onClose={onClose}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4 px-5">
        <TextField label="Household name" maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} hint="Everyone in the household sees this." error={error} />
        <FormError message={undefined} />
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Save
        </Button>
      </form>
    </BottomSheet>
  )
}
