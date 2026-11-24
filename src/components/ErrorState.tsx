import { Button } from './Button'
import { EmptyState } from './EmptyState'

/** Generic "something went wrong" with Try again (reloads). */
export function ErrorState() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas text-fg">
      <EmptyState icon="circle-alert" title="Something went wrong" body="Check your connection and try again.">
        <Button variant="primary" size="lg" block onClick={() => window.location.reload()}>
          Try again
        </Button>
      </EmptyState>
    </div>
  )
}
