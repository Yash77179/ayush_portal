import { Suspense } from "react"
import { InternshipsView } from "./internships-view"

// The list loads in the browser (it reads the search box from the URL), so skip Next's dev-only
// instant-navigation check for this page — it was dropping the segment and looping hydration.
export const instant = false

export default function InternshipsPage() {
  return (
    <Suspense>
      <InternshipsView />
    </Suspense>
  )
}
