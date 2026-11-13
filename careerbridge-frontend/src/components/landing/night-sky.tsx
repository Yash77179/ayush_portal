/**
 * The night sky the intro climbs into and the hero sits under: one component, so the two are the same sky.
 *
 * Layers: a deep navy-to-violet gradient; a fine dust of stars (two tiles of different sizes, so the pattern never
 * visibly repeats); a handful of brighter stars twinkling slowly, in two groups out of phase; and a soft violet aurora
 * along the horizon. All static images built once at module load (deterministic, so server and browser match),
 * animated with opacity only.
 */

// a small integer generator: the same stars on the server and in the browser
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function starTile(seed: number, size: number, count: number, rMin: number, rMax: number, aMin: number, aMax: number) {
  const r = rng(seed)
  let dots = ""
  for (let i = 0; i < count; i++) {
    const x = (r() * size).toFixed(1)
    const y = (r() * size).toFixed(1)
    const rad = (rMin + r() * (rMax - rMin)).toFixed(2)
    const a = (aMin + r() * (aMax - aMin)).toFixed(2)
    // a few faintly lilac, most white
    const fill = r() < 0.25 ? "%23e4d8ff" : "%23ffffff"
    dots += `%3Ccircle cx='${x}' cy='${y}' r='${rad}' fill='${fill}' fill-opacity='${a}'/%3E`
  }
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E${dots}%3C/svg%3E")`
}

const DUST_A = starTile(11, 433, 150, 0.35, 0.8, 0.25, 0.75)
const DUST_B = starTile(29, 617, 120, 0.5, 1.05, 0.3, 0.85)
const TWINKLE_A = starTile(47, 701, 14, 1.1, 1.6, 0.85, 1)
const TWINKLE_B = starTile(83, 829, 12, 1.0, 1.5, 0.8, 1)

export function NightSky({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* the sky: near-black at the top, deep navy, warming to violet at the horizon */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#04060f_0%,#070b1d_30%,#0c1330_58%,#1a1146_82%,#271257_100%)]" />
      {/* the aurora, low and wide */}
      <div className="absolute inset-x-[-20%] bottom-[-30%] h-[70%] bg-[radial-gradient(50%_55%_at_50%_100%,oklch(0.55_0.2_295/0.55),oklch(0.42_0.16_285/0.18)_55%,transparent_80%)] blur-2xl" />
      {/* star dust, fading out toward the glowing horizon */}
      <div
        className="absolute inset-0 [mask-image:linear-gradient(#000_55%,transparent_95%)]"
        style={{ backgroundImage: `${DUST_A}, ${DUST_B}` }}
      />
      {/* brighter stars, twinkling slowly */}
      <div
        className="absolute inset-0 animate-[cb-star-twinkle_5.5s_ease-in-out_infinite] [mask-image:linear-gradient(#000_50%,transparent_90%)]"
        style={{ backgroundImage: TWINKLE_A }}
      />
      <div
        className="absolute inset-0 animate-[cb-star-twinkle_7s_ease-in-out_-3.2s_infinite] [mask-image:linear-gradient(#000_50%,transparent_90%)]"
        style={{ backgroundImage: TWINKLE_B }}
      />
    </div>
  )
}
