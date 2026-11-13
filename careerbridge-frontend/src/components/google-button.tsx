"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { AUTH_BUTTON } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GSI_SRC = "https://accounts.google.com/gsi/client"

/** The bit of Google Identity Services we use: the popup that hands back an access token. */
type TokenResponse = { access_token?: string; error?: string }
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }
type Gsi = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string
        scope: string
        callback: (r: TokenResponse) => void
        error_callback?: (e: { type?: string }) => void
      }) => TokenClient
    }
  }
}
declare global {
  interface Window {
    google?: Gsi
  }
}

/** Loads Google's script once for the whole app. */
let gsiPromise: Promise<Gsi> | null = null
function loadGsi() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  gsiPromise ??= new Promise<Gsi>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = GSI_SRC
    s.async = true
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google script loaded without its API")))
    s.onerror = () => {
      gsiPromise = null
      reject(new Error("Couldn't load Google sign-in"))
    }
    document.head.appendChild(s)
  })
  return gsiPromise
}

/** The multicolour Google "G". */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  )
}

/**
 * "Continue with Google" for login and sign-up, under an "or" divider.
 * Opens Google's account picker in a popup; the access token it returns goes to our backend, which checks it with
 * Google and signs the user in — creating the account the first time, with `role` (the sign-up page passes the role picked there).
 */
export function GoogleAuth({ label = "Continue with Google", role }: { label?: string; role?: string }) {
  const { loginWithGoogle } = useAuth()
  const router = useRouter()
  const client = useRef<TokenClient | null>(null)
  const [busy, setBusy] = useState(false)

  // What to do with Google's token — kept in a ref so the popup, set up once, always uses the latest role and handlers.
  const onToken = useRef<(token: string) => Promise<void>>(async () => {})
  useEffect(() => {
    onToken.current = async (token) => {
      try {
        const { created, profileCompleted } = await loginWithGoogle(token, role)
        if (!profileCompleted) {
          // new (or unfinished) Google account: role, gender, name and username first
          toast.success(created ? "Almost there — tell us a bit about you." : "Please finish setting up your account.")
          router.push("/complete-profile")
          return
        }
        toast.success("Welcome back")
        router.push("/dashboard")
      } catch (err) {
        toast.error(errorMessage(err, "Google sign-in failed."))
        setBusy(false)
      }
    }
  })

  // Set the popup up ahead of time: browsers only allow a popup straight from the click, with nothing awaited first.
  useEffect(() => {
    if (!CLIENT_ID) return
    let live = true
    loadGsi()
      .then((g) => {
        if (!live) return
        client.current = g.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: "openid email profile",
          callback: (r) => {
            if (r.access_token) return void onToken.current(r.access_token)
            setBusy(false)
            if (r.error && r.error !== "access_denied") toast.error("Google sign-in didn't finish. Please try again.")
          },
          // the user closed the popup, or the browser blocked it
          error_callback: (e) => {
            setBusy(false)
            if (e?.type === "popup_failed_to_open") toast.error("Your browser blocked the Google popup. Allow popups for this site and try again.")
          },
        })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const start = () => {
    if (!CLIENT_ID) {
      toast.info("Google sign-in isn’t set up yet.")
      return
    }
    if (!client.current) {
      toast.error("Google sign-in is still loading — try again in a second.")
      loadGsi().catch(() => toast.error("Couldn't reach Google. Check your connection."))
      return
    }
    setBusy(true)
    client.current.requestAccessToken({ prompt: "select_account" })
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-4 text-[12px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
        <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
        or
        <span aria-hidden className="h-px flex-1 bg-(--hairline)" />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={start}
        disabled={busy}
        className={`${AUTH_BUTTON} mt-5 w-full gap-3 bg-card hover:bg-secondary`}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleG className="size-5" />}
        {label}
      </Button>
    </div>
  )
}
