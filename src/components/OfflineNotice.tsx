import { Icon } from './Icon'
import { useOnline } from './useOnline'

/** Non-blocking notice while offline; forms stay usable. */
export function OfflineNotice({ className }: { className?: string }) {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className={`flex items-start gap-2.5 rounded-md bg-info-soft px-4 py-3 text-[15px] leading-[22px] text-fg ${className ?? ''}`}>
      <Icon name="wifi-off" className="mt-px shrink-0 text-info" />
      <span>You’re offline. You can keep typing; we’ll connect when you’re back.</span>
    </div>
  )
}
