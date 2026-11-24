import { Avatar, type MemberColor } from './Avatar'
import { Button } from './Button'
import { cx } from './cx'
import { DueBadge, type DueStatus } from './DueBadge'

export type ChoreRowData = {
  title: string
  room?: string
  due: { status: DueStatus; label: string }
  assignee?: { name: string; color: MemberColor } | null
  done?: boolean
}

type ChoreRowProps = {
  chore: ChoreRowData
  onToggle?: (checked: boolean) => void
  onTake?: () => void
  className?: string
}

/** One chore: what (title), where/when (room + due badge), whose (avatar or Take it). */
export function ChoreRow({ chore, onToggle, onTake, className }: ChoreRowProps) {
  const done = !!chore.done
  return (
    <div className={cx('relative flex min-h-(--size-row) items-start gap-3 bg-surface px-4 py-3', className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark done: ${chore.title}`}
        onClick={() => {
          if (!done) navigator.vibrate?.(10)
          onToggle?.(!done)
        }}
        className="group relative -m-2.5 -mt-[18px] inline-flex size-(--size-touch) shrink-0 cursor-pointer items-center justify-center rounded-full"
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
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-px">
        <span className={cx('line-clamp-2 text-body-medium transition-colors duration-(--duration-base) [overflow-wrap:anywhere]', done ? 'text-fg-muted' : 'text-fg')}>
          {chore.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-fg-muted">
          {chore.room && <span>{chore.room}</span>}
          <DueBadge status={chore.due.status} label={chore.due.label} />
        </span>
      </div>
      <div className="flex shrink-0 items-center self-center">
        {chore.assignee ? (
          <Avatar name={chore.assignee.name} color={chore.assignee.color} />
        ) : (
          onTake && (
            <Button variant="take" size="sm" icon="hand" onClick={onTake}>
              Take it
            </Button>
          )
        )}
      </div>
    </div>
  )
}
