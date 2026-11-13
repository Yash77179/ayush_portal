"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "cn"

const LENGTH = 6

/**
 * Six boxes for an emailed code. Typing moves forward, Backspace moves back, arrows move freely,
 * and pasting a whole code (or the phone's one-time-code autofill into the first box) fills every box.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string
  onChange: (code: string) => void
  /** called once all six digits are in */
  onComplete?: (code: string) => void
  disabled?: boolean
  /** a red edge after a wrong code */
  invalid?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focused, setFocused] = useState(0)

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus()

  // write digits starting at box i, then move to the box after the last one written
  const fill = (i: number, digits: string) => {
    const chars = value.padEnd(LENGTH, " ").split("")
    const clean = digits.replace(/\D/g, "").slice(0, LENGTH - i)
    if (!clean) return
    clean.split("").forEach((d, k) => (chars[i + k] = d))
    const next = chars.join("").replace(/\s+$/, "")
    onChange(next)
    focus(i + clean.length)
    if (next.replace(/\s/g, "").length === LENGTH) onComplete?.(next)
  }

  const clear = (i: number) => {
    const chars = value.padEnd(LENGTH, " ").split("")
    chars[i] = " "
    onChange(chars.join("").replace(/\s+$/, ""))
  }

  return (
    <div className="flex justify-between gap-1.5 sm:gap-2" role="group" aria-label="6-digit code">
      {Array.from({ length: LENGTH }, (_, i) => {
        const ch = value[i]?.trim() ?? ""
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={ch}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            maxLength={i === 0 ? LENGTH : 1}
            onFocus={(e) => {
              setFocused(i)
              e.target.select()
            }}
            onBlur={() => setFocused((f) => (f === i ? -1 : f))}
            onChange={(e) => {
              const typed = e.target.value.replace(ch, "") || e.target.value
              if (typed) fill(i, typed)
            }}
            onPaste={(e) => {
              e.preventDefault()
              fill(0, e.clipboardData.getData("text"))
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault()
                if (ch) clear(i)
                else if (i > 0) {
                  clear(i - 1)
                  focus(i - 1)
                }
              } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                focus(i - 1)
              } else if (e.key === "ArrowRight") {
                e.preventDefault()
                focus(i + 1)
              }
            }}
            className={cn(
              "field-surface h-14 w-full min-w-0 rounded-[14px] text-center text-[22px] sm:h-16 sm:rounded-[16px] sm:text-[26px] font-semibold tabular-nums caret-transparent outline-none transition-[box-shadow,border-color] disabled:opacity-50",
              focused === i && "ring-2 ring-ring",
              invalid && "ring-2 ring-destructive/70"
            )}
          />
        )
      })}
    </div>
  )
}
