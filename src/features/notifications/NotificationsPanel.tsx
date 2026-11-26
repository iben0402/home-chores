import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/BottomSheet'
import { Button } from '../../components/Button'
import { cx } from '../../components/cx'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import type { AppNotification } from '../../data/notifications'
import { todayISO } from '../../lib/schedule'
import { groupOf, opensChore, relativeTime, sentenceOf, type GroupLabel } from './notificationText'
import type { NotificationsState } from './useNotifications'

type Props = {
  state: NotificationsState
  /** Show each one's household (you're in more than one). */
  multiHousehold: boolean
  desktop: boolean
  bellRef: RefObject<HTMLButtonElement | null>
  onOpen: (n: AppNotification) => void
  onMarkAllRead: () => void
  onRetry: () => void
  onClose: () => void
  now?: Date
}

/** The bell's panel: a bottom sheet on phones, a 400px panel under the bell on desktop. */
export function NotificationsPanel({ desktop, bellRef, onClose, ...content }: Props) {
  if (!desktop) {
    return (
      <BottomSheet title="Notifications" onClose={onClose}>
        <PanelContent {...content} />
      </BottomSheet>
    )
  }
  return (
    <DesktopPanel bellRef={bellRef} onClose={onClose}>
      <PanelContent {...content} />
    </DesktopPanel>
  )
}

/** Non-modal panel under the bell: focus moves in, Escape or a click outside closes, focus goes back to the bell. */
function DesktopPanel({ bellRef, onClose, children }: { bellRef: RefObject<HTMLButtonElement | null>; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  // Right edge lined up with the bell's (16px from the window edge at most).
  const [right, setRight] = useState(16)
  useLayoutEffect(() => {
    const place = () => {
      const bell = bellRef.current?.getBoundingClientRect()
      if (bell) setRight(Math.max(16, window.innerWidth - bell.right))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [bellRef])
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    const bell = bellRef.current
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !bell?.contains(target)) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      bell?.focus()
    }
  }, [bellRef])

  return (
    <section
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ right }}
      className="fixed top-[calc(var(--size-header)-4px)] z-(--z-sheet) flex max-h-[calc(100dvh-var(--size-header)-24px)] w-[400px] flex-col overflow-hidden rounded-lg bg-surface-raised shadow-lg focus-visible:outline-none"
    >
      <div className="flex items-center justify-between pt-3 pr-2 pl-4">
        <h2 id={titleId} className="m-0 text-heading">
          Notifications
        </h2>
        <IconButton icon="x" label="Close notifications" onClick={onClose} />
      </div>
      <div className="min-h-0 overflow-auto">{children}</div>
    </section>
  )
}

type ContentProps = Pick<Props, 'state' | 'multiHousehold' | 'onOpen' | 'onMarkAllRead' | 'onRetry' | 'now'>

function PanelContent({ state, multiHousehold, onOpen, onMarkAllRead, onRetry, now: fixedNow }: ContentProps) {
  // Times are relative to when the panel opened.
  const [now] = useState(() => fixedNow ?? new Date())
  if (state.status === 'loading') return <LoadingRows />
  if (state.status === 'error') {
    return (
      <EmptyState icon="triangle-alert" title="Couldn’t load notifications" body="You may be offline. Your chores aren’t affected.">
        <Button icon="repeat-2" onClick={onRetry}>
          Try again
        </Button>
      </EmptyState>
    )
  }
  if (state.items.length === 0) return <EmptyState icon="bell" title="No notifications yet" body="When someone assigns you a chore, it shows up here." />

  const unread = state.items.filter((n) => !n.read).length
  const today = todayISO(now)
  const groups = (['Today', 'Yesterday', 'Earlier'] as GroupLabel[])
    .map((label) => ({ label, items: state.items.filter((n) => groupOf(n.createdAt ?? now, now) === label) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      <div className="flex min-h-(--size-touch) items-center justify-between pr-2 pl-5">
        <span aria-live="polite" className="text-[14px] leading-5 text-fg-muted">
          {unread ? `${unread} unread` : 'All read'}
        </span>
        {unread > 0 && (
          <Button variant="ghost" size="sm" icon="check-check" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.label} role="group" aria-label={g.label}>
          <div aria-hidden="true" className="px-4 pt-4 pb-1.5 text-[12px] leading-4 font-semibold tracking-[0.06em] text-fg-muted uppercase">
            {g.label}
          </div>
          <ul className="m-0 list-none border-t border-border p-0">
            {g.items.map((n) => (
              <li key={n.id} className="border-b border-border">
                <Row n={n} today={today} now={now} multiHousehold={multiHousehold} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="m-0 px-4 pt-3 pb-1 text-center text-[13px] leading-[18px] text-fg-muted">Showing the last 60 days.</p>
    </>
  )
}

function Row({ n, today, now, multiHousehold, onOpen }: { n: AppNotification; today: string; now: Date; multiHousehold: boolean; onOpen: (n: AppNotification) => void }) {
  const s = sentenceOf(n, today)
  const opens = opensChore(n)
  const unread = !n.read
  const meta = [relativeTime(n.createdAt ?? now, now), multiHousehold ? n.householdName : null, opens ? null : 'nothing to open'].filter(Boolean).join(' · ')
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cx('mt-[7px] size-2.5 shrink-0 rounded-full', unread ? 'bg-primary' : 'border border-border-strong bg-transparent')}
      />
      <span aria-hidden="true" className="flex">
        <Avatar name={n.fromName} color={n.fromColor} size="sm" />
      </span>
      <span className={cx('min-w-0 flex-1 text-[15px] leading-[22px]', unread ? 'text-fg' : 'text-fg-muted')}>
        {unread && <span className="sr-only">Unread. </span>}
        <b className="font-bold text-fg">{s.actor}</b>
        {s.mid}
        <b className="font-bold text-fg">{s.title}</b>
        {s.title2 && (
          <>
            {' to '}
            <b className="font-bold text-fg">{s.title2}</b>
          </>
        )}
        <Tail text={s.tail} />
        <span className="mt-0.5 block text-[13px] leading-[18px] text-fg-muted">{meta}</span>
      </span>
      {opens && (
        <span aria-hidden="true" className="flex shrink-0 self-center text-fg-muted">
          <Icon name="chevron-right" size={20} />
        </span>
      )}
    </>
  )
  const base = cx('flex min-h-16 w-full items-start gap-3 px-4 py-3 text-left', unread ? 'bg-primary-soft' : 'bg-transparent')
  // A read notification about a removed chore has nothing to do: plain text, not a button.
  if (!opens && !unread) return <div className={base}>{body}</div>
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cx(
        base,
        'cursor-pointer border-0 font-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
        unread ? 'hover:brightness-[0.98]' : 'hover:bg-surface-hover',
      )}
    >
      {body}
    </button>
  )
}

/** ": now Sat 12 Dec" / " · Thu 10 Dec": the date itself never breaks across lines. */
function Tail({ text }: { text: string }) {
  const m = text.match(/^(: now | · )(.+)$/)
  if (!m) return text
  return (
    <>
      {m[1]}
      <span className="whitespace-nowrap">{m[2]}</span>
    </>
  )
}

function LoadingRows() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading notifications" className="border-t border-border">
      {['82%', '64%', '74%', '58%'].map((w) => (
        <div key={w} className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-1 size-2.5 rounded-full bg-surface-sunken motion-safe:animate-pulse" />
          <span className="size-7 rounded-full bg-surface-sunken motion-safe:animate-pulse" />
          <span className="flex flex-1 flex-col gap-2 pt-0.5">
            <span className="h-3.5 rounded-sm bg-surface-sunken motion-safe:animate-pulse" style={{ width: w }} />
            <span className="h-3 w-[30%] rounded-sm bg-surface-sunken motion-safe:animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  )
}
