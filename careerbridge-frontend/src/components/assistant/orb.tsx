"use client"

import { useTheme } from "next-themes"

import Strands from "@/components/Strands"
import type { AssistantMood } from "@/lib/assistant"
import { cn } from "cn"

/**
 * Bridge's face: React Bits' Strands orb in CareerBridge's violets.
 * It reacts to what's actually happening —
 *   idle       a slow, quiet drift
 *   listening  moves like a voice while you speak
 *   thinking   gathers energy and speeds up while the request is out
 *   speaking   "talks" while the answer streams in or is read aloud
 */

// Strands' seven colour roles, warm → cool: edge, body, highlight, core, glow, bright, deep
export const BRIDGE_COLORS = ["#d946ef", "#a855f7", "#c084fc", "#ede4ff", "#818cf8", "#6366f1", "#3730a3"]

const MOODS: Record<AssistantMood, { energy: number; speed: number; glow: number; listening?: boolean }> = {
  idle: { energy: 0.45, speed: 0.85, glow: 1.05 },
  listening: { energy: 0.35, speed: 1.15, glow: 1.15, listening: true },
  thinking: { energy: 0.78, speed: 1.9, glow: 1.25 },
  speaking: { energy: 0.45, speed: 1.2, glow: 1.15, listening: true },
}

export function AssistantOrb({ mood, className }: { mood: AssistantMood; className?: string }) {
  const { resolvedTheme } = useTheme()
  const m = MOODS[mood]
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden>
      <Strands
        colors={BRIDGE_COLORS}
        energy={m.energy}
        speed={m.speed}
        glow={m.glow}
        saturation={1.25}
        intensity={1.1}
        listening={!!m.listening}
        // white mode: a milky glass orb with ink-violet strands; dark mode: the glowing one
        lightMode={resolvedTheme !== "dark"}
        maxDevicePixelRatio={2}
      />
    </div>
  )
}

/** A short status line that matches the orb. */
export const MOOD_LABEL: Record<AssistantMood, string> = {
  idle: "Ready when you are",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
}
