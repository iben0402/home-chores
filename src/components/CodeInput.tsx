import { useId } from 'react'
import { formatCode, normalizeCode } from '../lib/inviteCode'
import { cx } from './cx'
import { FieldMessage } from './Field'

/** One big, paste-friendly field for an 8-character invite code. Reports the normalised code. */
export function CodeInput({ value, onChange, error, disabled }: { value: string; onChange: (code: string) => void; error?: string; disabled?: boolean }) {
  const id = useId()
  const messageId = `${id}-msg`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] leading-5 font-semibold text-fg">
        Invite code
      </label>
      <input
        id={id}
        value={formatCode(value)}
        onChange={(e) => onChange(normalizeCode(e.target.value))}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        placeholder="XXXX-XXXX"
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={cx(
          'h-[72px] w-full rounded-md border bg-surface px-3 text-center text-code tracking-[0.14em] text-fg uppercase tabular-nums placeholder:text-fg-disabled',
          'focus-visible:border-focus-ring focus-visible:outline-offset-0 disabled:bg-surface-sunken',
          error ? 'border-danger' : 'border-border-strong',
        )}
      />
      <FieldMessage id={messageId} error={error} hint="Paste it or type it. Dashes and spaces don’t matter." />
    </div>
  )
}
