import { useId, useRef, type KeyboardEvent } from 'react'
import { ROOM_ICONS, type RoomIcon } from '../data/rooms'
import { cx } from './cx'
import { Icon } from './Icon'

const LABELS: Record<RoomIcon, string> = {
  house: 'House',
  'cooking-pot': 'Cooking pot',
  bath: 'Bath',
  sofa: 'Sofa',
  'bed-double': 'Bed',
  shirt: 'Shirt',
  trash: 'Bin',
  sprout: 'Plant',
}

/** Room icon choice: a radio group (one tab stop; arrow keys move the choice). */
export function IconPicker({ value, onChange }: { value: RoomIcon; onChange: (icon: RoomIcon) => void }) {
  const labelId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (i + step + ROOM_ICONS.length) % ROOM_ICONS.length
    onChange(ROOM_ICONS[next])
    refs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[14px] leading-5 font-semibold text-fg">
        Icon
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-4 gap-2">
        {ROOM_ICONS.map((icon, i) => {
          const checked = icon === value
          return (
            <button
              key={icon}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={LABELS[icon]}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(icon)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                'flex h-14 cursor-pointer items-center justify-center rounded-md',
                checked ? 'border-2 border-primary bg-primary-soft text-primary' : 'border border-border-strong bg-surface text-fg hover:bg-surface-hover',
              )}
            >
              <Icon name={icon} size={22} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
