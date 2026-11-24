import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { InviteCard } from '../../components/InviteCard'
import type { Household } from '../../data/households'

function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`
}

/** "Invite people": the code to read aloud, plus copy/share of the link. */
export function InviteSheet({ household, onClose }: { household: Household; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const link = inviteLink(household.inviteCode)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${household.name} on Chours`, text: `Join ${household.name} on Chours`, url: link })
        return
      } catch {
        // Cancelled or unsupported: fall back to copying.
      }
    }
    await copy()
  }

  return (
    <BottomSheet title="Invite someone" onClose={onClose}>
      <div className="px-5 pb-2">
        <InviteCard code={household.inviteCode} copied={copied} onCopy={copy} onShare={share} />
      </div>
    </BottomSheet>
  )
}
