import { Avatar, type MemberColor } from './Avatar'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

/** A person on the Household screen: avatar, name, Admin badge, when they joined, admin menu. */
export function MemberRow({ name, color, you, admin, sub, onMenu }: { name: string; color: MemberColor; you?: boolean; admin?: boolean; sub?: string; onMenu?: () => void }) {
  return (
    <div role="listitem" className="flex min-h-16 items-center gap-3 bg-surface py-2 pr-2 pl-4">
      <Avatar name={name} color={color} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] leading-[22px] font-semibold">
          <span className="truncate">{name}</span>
          {you && <span className="font-normal text-fg-muted">(you)</span>}
          {admin && (
            <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-primary-soft px-2 text-[13px] leading-[18px] font-semibold text-primary">
              <Icon name="shield" size={14} />
              Admin
            </span>
          )}
        </span>
        {sub && <span className="text-[13px] leading-[18px] text-fg-muted">{sub}</span>}
      </div>
      {onMenu ? <IconButton icon="ellipsis-vertical" label={`Options for ${name}`} aria-haspopup="dialog" onClick={onMenu} /> : <span className="w-11 shrink-0" />}
    </div>
  )
}
