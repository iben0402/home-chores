import { Avatar, type MemberColor } from './Avatar'
import { Button } from './Button'
import { cx } from './cx'
import { DueBadge, type DueStatus } from './DueBadge'
import { Icon } from './Icon'

export type ChoreRowData = {
  title: string
  room?: string
  due: { status: DueStatus; label: string }
  kind?: 'oneoff' | 'interval' | 'calendar'
  /** First name of who raised a one-off ("from Tom"). */
  from?: string
  assignee?: { name: string; color: MemberColor; you?: boolean } | null
  done?: boolean
}

type ChoreRowProps = {
  chore: ChoreRowData
  onToggle?: (checked: boolean) => void
  onTake?: () => void
  /** Tap the row: the actions sheet. */
  onOpen?: () => void
  /** Tap the assignee: reassign. */
  onAssignee?: () => void
  className?: string
  /** Example rows (e.g. the Welcome preview): not focusable, so they never look like real controls. */
  decorative?: boolean
  /** Ticked off: hold, then fade and collapse (spec motion). */
  leaving?: boolean
}

/** One chore: what (title), where/when (room + due badge), whose (avatar or Take it). */
export function ChoreRow({ chore, onToggle, onTake, onOpen, onAssignee, className, decorative, leaving }: ChoreRowProps) {
  const done = !!chore.done
  return (
    <div
      role="listitem"
      className={cx(
        'relative flex min-h-(--size-row) items-start gap-3 bg-surface px-4 py-3',
        leaving && 'overflow-hidden motion-safe:animate-[row-out_var(--duration-slow)_var(--ease-standard)_var(--duration-hold)_forwards] motion-reduce:animate-[fade-in_120ms_linear_300ms_reverse_forwards]',
        className,
      )}
    >
      {onOpen && (
        <button
          type="button"
          aria-label={`${chore.title}. More actions`}
          onClick={onOpen}
          className="absolute inset-0 cursor-pointer hover:bg-surface-hover active:bg-surface-sunken focus-visible:-outline-offset-[3px]"
        />
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark done: ${chore.title}`}
        tabIndex={decorative ? -1 : undefined}
        onClick={() => {
          if (!done) navigator.vibrate?.(10)
          onToggle?.(!done)
        }}
        className="group relative z-[1] -m-2.5 -mt-2 inline-flex size-(--size-touch) shrink-0 cursor-pointer items-center justify-center rounded-full"
      >
        <span
          className={cx(
            'size-(--size-checkbox) rounded-sm border-2 bg-surface transition-[transform,border-color] duration-(--duration-instant) group-active:scale-[0.92]',
            done ? 'border-success' : 'border-border-strong group-hover:border-primary',
          )}
        />
        {done && (
          <span className="absolute grid size-(--size-checkbox) animate-check-pop place-items-center rounded-sm bg-success text-on-success">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" strokeDasharray="24" className="animate-check-draw" />
            </svg>
          </span>
        )}
      </button>
      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1.5 pt-px">
        <span className={cx('line-clamp-2 text-body-medium transition-colors duration-(--duration-base) [overflow-wrap:anywhere]', done ? 'text-fg-muted' : 'text-fg')}>
          {chore.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-fg-muted">
          {chore.room && <span>{chore.room}</span>}
          <DueBadge status={chore.due.status} label={chore.due.label} />
          {chore.kind && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Icon name={chore.kind === 'oneoff' ? 'circle-dot' : 'repeat-2'} size={14} />
              {chore.kind === 'oneoff' ? 'One-off' : <span className="sr-only">Repeats</span>}
            </span>
          )}
          {chore.from && <span>from {chore.from}</span>}
        </span>
      </div>
      <div className="relative z-[1] flex shrink-0 items-center self-center">
        {chore.assignee ? (
          onAssignee ? (
            <button
              type="button"
              aria-label={`Assigned to ${chore.assignee.you ? 'you' : chore.assignee.name}. Change`}
              onClick={onAssignee}
              className="-m-1.5 inline-flex size-(--size-touch) cursor-pointer items-center justify-center rounded-full"
            >
              <Avatar name={chore.assignee.name} color={chore.assignee.color} />
            </button>
          ) : (
            <Avatar name={chore.assignee.you ? `${chore.assignee.name} (you)` : chore.assignee.name} color={chore.assignee.color} />
          )
        ) : (
          onTake && (
            <Button variant="take" size="sm" icon="hand" onClick={onTake} aria-label={`Take it: ${chore.title}`}>
              Take it
            </Button>
          )
        )}
      </div>
    </div>
  )
}
