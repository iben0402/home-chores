import { Link, useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { cx } from '../../components/cx'
import { Icon } from '../../components/Icon'
import { useAuth } from '../auth/useAuth'
import { useMyHouseholds } from '../households/useMyHouseholds'

/** "Your households": switch, create or join another, your account. */
export function SwitcherSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const { households } = useMyHouseholds()
  const { user } = useAuth()
  const navigate = useNavigate()
  const linkRow = 'flex min-h-14 w-full items-center gap-4 px-5 text-body-medium text-fg no-underline hover:bg-surface-hover'
  return (
    <BottomSheet title="Your households" onClose={onClose}>
      <div role="radiogroup" aria-label="Households">
        {households.map((h) => {
          const on = h.id === current
          const admin = !!user && h.adminUids.includes(user.uid)
          return (
            <button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onClose()
                if (!on) navigate(`/h/${h.id}`)
              }}
              className={cx('flex min-h-16 w-full cursor-pointer items-center gap-3 px-5 text-left text-fg hover:bg-surface-hover', on && 'bg-primary-soft font-semibold')}
            >
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
                <Icon name="house" size={22} />
              </span>
              <span className="min-w-0 flex-1 truncate">{h.name}</span>
              <span className={cx('inline-flex h-6 items-center gap-1 rounded-sm px-2 text-[13px] font-semibold', admin ? 'bg-primary-soft text-primary' : 'bg-status-upcoming-bg text-status-upcoming-fg')}>
                {admin && <Icon name="shield" size={14} />}
                {admin ? 'Admin' : 'Member'}
              </span>
              <span className="w-5 text-primary">{on && <Icon name="check" />}</span>
            </button>
          )
        })}
      </div>
      <div role="separator" className="mx-5 my-1 h-px bg-border" />
      <Link to="/start" onClick={onClose} className={linkRow}>
        <Icon name="plus" size={22} className="text-fg-muted" />
        Create or join another household
      </Link>
      <Link to="/account" onClick={onClose} className={linkRow}>
        <Icon name="user-round" size={22} className="text-fg-muted" />
        Your account
      </Link>
    </BottomSheet>
  )
}
