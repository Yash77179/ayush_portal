import { resolveApiUrl } from "@/lib/api"
/** "aarav  SHARMA" -> "Aarav Sharma" (display only). */
export function titleCase(value?: string | null) {
  return (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

const API_ORIGIN = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "")

/** Uploaded photos come back as "/media/…": point them at the API host. */
export function mediaUrl(path?: string | null) {
  if (!path) return null
  return /^(https?:|data:|blob:)/.test(path) ? path : `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`
}
