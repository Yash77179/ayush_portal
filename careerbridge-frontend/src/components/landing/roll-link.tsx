import Link from "next/link"
import { cn } from "cn"

/** A label that rolls up to reveal a copy of itself on hover (the studio-site "roll" effect). */
export function Roll({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("roll", className)}>
      <span className="roll-track">
        <span>{children}</span>
        <span aria-hidden>{children}</span>
      </span>
    </span>
  )
}

export function RollLink({
  href,
  children,
  variant = "dark",
  className,
}: {
  href: string
  children: string
  variant?: "dark" | "light" | "ghost"
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/roll inline-flex h-12 items-center justify-center rounded-full px-7 text-[1rem] font-medium outline-none transition-[transform,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
        variant === "dark" && "bg-primary text-primary-foreground shadow-[0_14px_28px_-14px_oklch(0.25_0.1_280/0.7)] hover:shadow-[0_18px_34px_-14px_oklch(0.25_0.1_280/0.8)]",
        variant === "light" && "bg-white text-[oklch(0.28_0.1_280)] shadow-[0_14px_28px_-14px_oklch(0.2_0.1_280/0.5)]",
        variant === "ghost" && "border border-current/25 hover:border-current/50",
        className
      )}
    >
      <Roll>{children}</Roll>
    </Link>
  )
}
