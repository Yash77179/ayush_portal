import { Fragment, type ReactNode } from "react"
import Link from "next/link"

/**
 * The small slice of Markdown Bridge writes: paragraphs, bullet / numbered lists, **bold**, *italic*, `code`
 * and [links](/internships/12). Built from React elements — never injected HTML — so a reply can't run script.
 */

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*[^*\s][^*]*\*)/g

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`
    if (!part) return null
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={k} className="font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={k} className="rounded-md bg-current/10 px-1.5 py-0.5 font-mono text-[0.88em]">{part.slice(1, -1)}</code>
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const [, label, href] = link
      const cls = "font-medium underline decoration-current/40 underline-offset-[3px] transition-colors hover:decoration-current"
      if (href.startsWith("/")) return <Link key={k} href={href} className={cls}>{label}</Link>
      if (/^https?:\/\//.test(href)) return <a key={k} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>
      return <Fragment key={k}>{label}</Fragment>
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={k}>{part.slice(1, -1)}</em>
    return <Fragment key={k}>{part}</Fragment>
  })
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, "").split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const bullet = /^\s*[-*•]\s+/
    const num = /^\s*\d+[.)]\s+/
    if (bullet.test(line) || num.test(line)) {
      const ordered = num.test(line)
      const re = ordered ? num : bullet
      const items: string[] = []
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""))
      const List = ordered ? "ol" : "ul"
      blocks.push(
        <List key={`b${i}`} className={ordered ? "list-decimal space-y-1.5 pl-5 marker:text-current/50" : "space-y-1.5"}>
          {items.map((it, j) =>
            ordered ? (
              <li key={j} className="pl-1">{inline(it, `l${i}-${j}`)}</li>
            ) : (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-current opacity-50" />
                <span className="min-w-0">{inline(it, `l${i}-${j}`)}</span>
              </li>
            )
          )}
        </List>
      )
      continue
    }
    const heading = line.match(/^#{1,3}\s+(.*)/)
    if (heading) {
      blocks.push(<p key={`b${i}`} className="font-semibold">{inline(heading[1], `h${i}`)}</p>)
      i++
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !bullet.test(lines[i]) && !num.test(lines[i]) && !/^#{1,3}\s/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={`b${i}`}>{inline(para.join(" "), `p${i}`)}</p>)
  }
  return <div className="space-y-3">{blocks}</div>
}
