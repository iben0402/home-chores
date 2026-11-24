import { formatCode } from '../lib/inviteCode'
import { Button } from './Button'

/** The household's invite: a code that's easy to read aloud, plus copy/share of the link. */
export function InviteCard({ code, copied, onCopy, onShare, onNewCode, copyLabel = 'Copy link', shareLabel = 'Share', hint = 'They enter this code after signing up, or open the link.' }: {
  code: string
  copied?: boolean
  onCopy: () => void
  onShare: () => void
  /** Admins: replace the code. */
  onNewCode?: () => void
  copyLabel?: string
  shareLabel?: string
  hint?: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-[13px] leading-[18px] text-fg-muted">{hint}</p>
      <div
        role="img"
        aria-label={`Invite code: ${code.split('').join(' ')}`}
        className="flex select-all justify-center rounded-md bg-surface-sunken px-2 py-4 text-code tracking-[0.14em] text-fg tabular-nums"
      >
        <span aria-hidden="true">{formatCode(code)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={copied ? 'check' : 'copy'} onClick={onCopy}>
          {copied ? 'Copied' : copyLabel}
        </Button>
        <Button variant="primary" icon="share-2" onClick={onShare}>
          {shareLabel}
        </Button>
      </div>
      {onNewCode ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" icon="repeat-2" onClick={onNewCode}>
            Get a new code
          </Button>
        </div>
      ) : (
        <p className="m-0 text-center text-[13px] leading-[18px] text-fg-muted">Admins can make a new code any time.</p>
      )}
    </section>
  )
}
