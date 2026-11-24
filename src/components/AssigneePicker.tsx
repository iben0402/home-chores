import { Avatar, type MemberColor } from './Avatar'
import { cx } from './cx'
import { Icon } from './Icon'

export type PickerMember = { uid: string; name: string; color: MemberColor; you?: boolean }

/** Who a chore (or one time of it) is for: a radio list of members, optionally with "Nobody yet". */
export function AssigneePicker({ members, value, allowNobody, onChange }: { members: PickerMember[]; value: string | null; allowNobody: boolean; onChange: (uid: string | null) => void }) {
  const rows: Array<PickerMember | null> = [...(allowNobody ? [null] : []), ...members]
  return (
    <div role="radiogroup" aria-label="Assign to">
      {rows.map((m) => {
        const on = (m?.uid ?? null) === value
        return (
          <button
            key={m?.uid ?? 'nobody'}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m?.uid ?? null)}
            className={cx('flex min-h-14 w-full cursor-pointer items-center gap-3 px-5 text-left text-[16px] leading-[22px] text-fg hover:bg-surface-hover', on && 'bg-primary-soft font-semibold')}
          >
            {m ? (
              <Avatar name={m.name} color={m.color} size="lg" />
            ) : (
              <span aria-hidden="true" className="grid size-(--size-avatar-lg) place-items-center rounded-full border-2 border-dashed border-status-unassigned-fg bg-status-unassigned-bg text-status-unassigned-fg">
                <Icon name="user-round" size={18} />
              </span>
            )}
            <span>
              {m ? m.name : 'Nobody yet'}
              {m?.you && <span className="font-normal text-fg-muted"> (you)</span>}
            </span>
            {on && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                {m && 'Assigned'}
                <Icon name="check" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
