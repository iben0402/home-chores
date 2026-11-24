import type { ReactNode } from 'react'
import { OfflineNotice } from '../../components/OfflineNotice'

/**
 * Full-height single column. Phone: full width. Desktop: a centred 440px column on the canvas
 * (design artboard "Welcome — desktop").
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas text-fg">
      <div className="flex w-full max-w-[440px] flex-1 flex-col pb-[env(safe-area-inset-bottom)] sm:pt-8 sm:pb-6">
        <OfflineNotice className="mx-4 mt-3" />
        {children}
      </div>
    </div>
  )
}
