"use client"

import type { ComponentType } from "react"
import {
  DangerCircleIcon,
  HourglassLineIcon,
  PauseCircleIcon,
  PlugCircleIcon,
  StopCircleIcon,
  StopwatchIcon,
  WiFiOffIcon,
} from "@solar-icons/react/bold-duotone"
import { RestartIcon } from "@solar-icons/react/linear"

import { ERROR_COPY, type ErrorKind } from "@/lib/assistant"
import { cn } from "cn"

type Icon = ComponentType<{ className?: string }>

/* The site's own icon set (Solar), in its two-tone style so each icon picks up the card's tint. */
const ICONS: Record<ErrorKind, Icon> = {
  busy: HourglassLineIcon,
  timeout: StopwatchIcon,
  offline: WiFiOffIcon,
  setup: PlugCircleIcon,
  limit: PauseCircleIcon,
  generic: DangerCircleIcon,
  stopped: StopCircleIcon,
}

// temporary hiccups in a warm butter tone; real problems in a soft coral
const TONE: Record<ErrorKind, string> = {
  busy: "tone-peach",
  timeout: "tone-peach",
  limit: "tone-peach",
  offline: "tone-pink",
  setup: "tone-pink",
  generic: "tone-pink",
  stopped: "tone-mist",
}

function TryAgain({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "dbl inline-flex h-9 items-center gap-2 rounded-[12px] border border-(--hairline) bg-card px-3.5 text-[13.5px] font-medium text-foreground/85 shadow-[0_1px_2px_oklch(0.2_0.03_280/0.06)] transition-[background-color,transform] duration-150 [--r:12px] hover:bg-secondary hover:text-foreground active:scale-95",
        className
      )}
    >
      <RestartIcon className="size-4" />
      Try again
    </button>
  )
}

/** The whole answer failed: a calm tinted card (icon beside the title, one helpful line), with Try again under it. */
export function ErrorCard({ kind, message, onRetry }: { kind: ErrorKind; message?: string; onRetry?: () => void }) {
  const copy = ERROR_COPY[kind]
  const Icon = ICONS[kind]
  if (kind === "stopped") {
    return (
      <p className="flex animate-in items-center gap-2 text-[13.5px] text-muted-foreground duration-200 fade-in-0">
        <Icon className="size-4" />
        You stopped this answer.
        {onRetry && (
          <button type="button" onClick={onRetry} className="font-medium text-foreground/80 underline-offset-4 hover:underline">
            Ask again
          </button>
        )}
      </p>
    )
  }
  return (
    <div className="flex animate-in flex-col items-start gap-2.5 duration-300 fade-in-0 slide-in-from-bottom-1">
      <div role="alert" className={cn("glass-card tint w-full rounded-[var(--r)] px-4 py-3.5 text-(--t-fg) [--r:18px]", TONE[kind])}>
        <p className="flex items-center gap-2 text-[14.5px] leading-snug font-semibold">
          <Icon className="size-5 shrink-0" />
          {copy.title}
        </p>
        <p className="mt-1 pl-7 text-[13.5px] leading-snug opacity-80">{message || copy.text}</p>
      </div>
      {copy.retry && onRetry && <TryAgain onClick={onRetry} />}
    </div>
  )
}

/** Part of the answer arrived, then something went wrong (or you stopped it): a quiet note under the text. */
export function CutShortNote({ kind, onRetry }: { kind: ErrorKind | "stopped"; onRetry?: () => void }) {
  const stopped = kind === "stopped"
  const Icon = ICONS[stopped ? "stopped" : kind]
  return (
    <div className="mt-3 flex animate-in flex-col items-start gap-2.5 duration-300 fade-in-0">
      <p className={cn("flex items-center gap-2 text-[13px]", stopped ? "text-muted-foreground" : "text-[oklch(0.5_0.14_28)] dark:text-[oklch(0.8_0.1_25)]")}>
        <Icon className="size-[18px] shrink-0" />
        {stopped ? "You stopped this answer." : `This answer was cut short — ${ERROR_COPY[kind].title.toLowerCase()}.`}
      </p>
      {onRetry && !stopped && <TryAgain onClick={onRetry} />}
    </div>
  )
}
