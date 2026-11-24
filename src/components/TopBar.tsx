import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { IconButton } from './IconButton'

/** Back + title for screens inside a tab (room detail, manage rooms). */
export function TopBar({ title, back, children }: { title: string; back: string; children?: ReactNode }) {
  const navigate = useNavigate()
  const opened = useLocation().key === 'default'
  return (
    <div className="flex h-(--size-header) items-center gap-1 px-2">
      <IconButton icon="chevron-left" label="Back" onClick={() => (opened ? navigate(back) : navigate(-1))} />
      <h1 className="m-0 flex-1 truncate text-[18px] leading-6 font-semibold">{title}</h1>
      {children}
    </div>
  )
}
