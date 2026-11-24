import logoMark from '../assets/logo-mark.svg'
import { cx } from './cx'

/** The Chours logo tile plus the name. Compact for secondary screens. */
export function AppMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src={logoMark} alt="" aria-hidden="true" className={cx('shrink-0', compact ? 'size-8' : 'size-11')} />
      {/* Full size it is the screen's heading (Welcome); compact it is just branding. */}
      {compact ? <span className="text-[18px] leading-6 font-bold">Chours</span> : <h1 className="m-0 text-display">Chours</h1>}
    </div>
  )
}
