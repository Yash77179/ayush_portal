/**
 * Line art for the plates in the horizontal journey. Each plate gets its own distinct figure — waves,
 * a spiral, ripples, contours, flowing silk, a spirograph, rays — drawn as many fine ink lines with a
 * few heavier accent strokes in the plate's hue. Pure SVG paths generated at render time (no images,
 * no dots), laid under the plate's content and left quiet enough to read over.
 */

export type ArtKind = "waves" | "spiral" | "ripples" | "contours" | "silk" | "spiro" | "rays"

const W = 400
const H = 300
const INK = "oklch(0.28 0.09 280)"
const n = (v: number) => v.toFixed(1)
const poly = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")
const range = (count: number) => Array.from({ length: count }, (_, i) => i)

/** Calm, overlapping sine bands that drift slightly out of step with each other. */
function waves() {
  return range(13).map((i) => {
    const y0 = 8 + i * 24
    const amp = 9 + i * 1.8
    const ph = i * 0.5
    const pts: [number, number][] = []
    for (let x = -10; x <= W + 10; x += 10) pts.push([x, y0 + amp * Math.sin(x / 40 + ph) + 5 * Math.sin(x / 16 + ph * 2)])
    return { d: poly(pts), accent: i === 6, o: 0.16 + (i % 3) * 0.04 }
  })
}

/** Two interleaved Archimedean spirals winding out of one corner. */
function spiral(cx = 300, cy = 96, tight = 3.4, turns = 7) {
  const make = (rot: number, tight: number) => {
    const pts: [number, number][] = []
    for (let t = 0; t < Math.PI * 2 * turns; t += 0.12) {
      const r = 4 + t * tight
      pts.push([cx + r * Math.cos(t + rot), cy + r * Math.sin(t + rot)])
    }
    return poly(pts)
  }
  return [
    { d: make(0, tight), accent: false, o: 0.34 },
    { d: make(Math.PI, tight), accent: true, o: 0.85 },
    ...(turns < 5 ? [] : [{ d: make(Math.PI / 2, tight), accent: false, o: 0.14 }]),
  ]
}

/** A swirl of curved arms around a point — reads as a spiral even when the middle is covered by a medallion. */
function vortex(cx = 200, cy = 150) {
  const ARMS = 11
  return range(ARMS).map((k) => {
    const pts: [number, number][] = []
    for (let s = 0; s <= 1.001; s += 0.04) {
      const r = 28 + s * 150
      const a = (k / ARMS) * Math.PI * 2 + s * 2.3
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
    return { d: poly(pts), accent: k % 5 === 0, o: k % 5 === 0 ? 0.85 : 0.3 }
  })
}

/** Rings spreading from a point, each one a little off-centre from the last. */
function ripples(cx = 250, cy = 78) {
  return range(18).map((i) => ({
    d: `M${n(cx + i * 2.4 - (12 + i * 16))} ${n(cy + i * 1.5)}a${n(12 + i * 16)} ${n(12 + i * 16)} 0 1 0 ${n((12 + i * 16) * 2)} 0a${n(12 + i * 16)} ${n(12 + i * 16)} 0 1 0 ${n(-(12 + i * 16) * 2)} 0`,
    accent: i % 6 === 3,
    o: Math.max(0.1, 0.36 - i * 0.015),
  }))
}

/** Topographic rings: nested closed curves that wobble like contour lines on a map. */
function contours(cx = 150, cy = 196) {
  return range(13).map((i) => {
    const R = 12 + i * 17
    const pts: [number, number][] = []
    for (let t = 0; t <= Math.PI * 2 + 0.1; t += 0.17) {
      const r = R * (1 + 0.1 * Math.sin(3 * t + i * 0.32 + 1) + 0.05 * Math.sin(5 * t - i * 0.2))
      pts.push([cx + r * Math.cos(t), cy + r * 0.82 * Math.sin(t)])
    }
    return { d: poly(pts), accent: i === 8, o: 0.2 }
  })
}

/** A fan of long flowing lines, like silk caught in wind. */
function silk() {
  return range(28).map((i) => {
    const pts: [number, number][] = []
    for (let x = -10; x <= W + 10; x += 12) pts.push([x, 330 - i * 12.5 - (40 + i * 2.6) * Math.sin(x / 105 + i * 0.1)])
    return { d: poly(pts), accent: i === 14, o: 0.14 + (i % 4) * 0.03 }
  })
}

/** A hypotrochoid: the looping, woven curve a spirograph draws. */
function spiro(cx = 250, cy = 150, scale = 0.95) {
  const R = 100
  const r = 36
  const d = 64
  const pts: [number, number][] = []
  for (let t = 0; t <= Math.PI * 18 + 0.05; t += 0.09) {
    pts.push([cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)), cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t))])
  }
  const inner: [number, number][] = pts.map(([x, y]) => [cx + (x - cx) * 0.62, cy + (y - cy) * 0.62])
  return [
    { d: poly(pts), accent: false, o: 0.28 },
    { d: poly(inner), accent: true, o: 0.7 },
  ]
}

/** Lines fanning out from a corner, like a sunrise. */
function rays() {
  return range(26).map((i) => {
    const a = (Math.PI / 2) * (1 + i / 25) + 0.08
    return { d: `M380 8L${n(380 + 560 * Math.cos(a))} ${n(8 + 560 * Math.sin(a))}`, accent: i === 13, o: 0.16 + (i % 2) * 0.1 }
  })
}

type Lines = { d: string; accent: boolean; o: number }[]
const MAKERS: Record<ArtKind, (centered: boolean) => Lines> = {
  waves,
  silk,
  rays,
  // in a round plate the figure sits dead centre, so nothing important is cropped by the circle
  spiral: (c) => (c ? vortex(200, 150) : spiral()),
  ripples: (c) => (c ? ripples(200, 150) : ripples()),
  contours: (c) => (c ? contours(200, 160) : contours()),
  spiro: (c) => (c ? spiro(200, 150, 1.12) : spiro()),
}

export function PlateArt({
  kind,
  hue,
  id,
  centered = false,
  tone = "ink",
  weight = 1,
}: {
  kind: ArtKind
  hue: number
  id: string
  centered?: boolean
  /** "light" draws white lines with no wash, for use on saturated backgrounds */
  tone?: "ink" | "light"
  /** multiplies line thickness — useful when the figure is scaled up a lot */
  weight?: number
}) {
  const light = tone === "light"
  const accent = light ? `oklch(0.97 0.06 ${hue})` : `oklch(0.56 0.17 ${hue})`
  const ink = light ? "#fff" : INK
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 size-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {!light && (
        <>
          <defs>
            <radialGradient id={`${id}-wash`} cx="82%" cy="86%" r="75%">
              <stop offset="0" stopColor={`oklch(0.9 0.09 ${hue})`} stopOpacity="0.85" />
              <stop offset="1" stopColor={`oklch(0.9 0.09 ${hue})`} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}-wash)`} />
        </>
      )}
      {MAKERS[kind](centered).map((l, i) => (
        <path key={i} d={l.d} stroke={l.accent ? accent : ink} strokeOpacity={light ? Math.min(1, l.o * 1.5) : l.o} strokeWidth={(l.accent ? 1.7 : 1) * weight} />
      ))}
    </svg>
  )
}
