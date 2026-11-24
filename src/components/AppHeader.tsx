/**
 * Top bar with the household name. The switcher and the bell arrive with their screens
 * (household switcher, notifications); until then nothing here pretends to be a control.
 */
export function AppHeader({ household }: { household: string }) {
  return (
    <header className="sticky top-0 z-(--z-header) flex h-(--size-header) shrink-0 items-center bg-canvas px-4">
      <p className="m-0 truncate text-[18px] leading-6 font-bold">{household}</p>
    </header>
  )
}
