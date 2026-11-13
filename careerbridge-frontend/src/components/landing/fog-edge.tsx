"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * The fog that leads everything after the horizontal journey. The journey stays pinned once its track
 * has finished and this section climbs over it from the bottom of the screen: thin, shadowy wisps first,
 * then a body of fog that thickens until it *is* the page background. Going on, the fog is the first
 * thing to scroll away.
 *
 * It is a real fog, not sprites: a fragment shader evaluates domain-warped fractional Brownian motion
 * every frame, so the shapes continuously fold, roll and re-form instead of sliding around. Scroll feeds
 * it twice — progress lifts the whole field, and scroll *speed* makes it churn faster, so it reacts to you.
 * It renders at about half resolution (fog is soft anyway), pauses when off screen, and under reduced
 * motion draws one still frame.
 */

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uT;
uniform float uS;
uniform vec3 uBg;
uniform vec3 uLight;
uniform vec3 uShade;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, v = 0.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;          // y = 0 is the bottom of the band
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp * 1.1, uv.y * 1.15);
  float t = uT;

  // two layers of domain warping: the field folds over itself, which is what makes fog billow
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.11)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.09, 0.0)));
  vec2 r = vec2(fbm(p + 2.1 * q + vec2(1.7, 9.2) + t * 0.07), fbm(p + 2.1 * q + vec2(8.3, 2.8) - t * 0.06));
  vec2 w = p + 2.1 * r + vec2(t * 0.05, -uS * 1.8);
  float f = fbm(w);

  // density: banks of fog with clear air between them. A slow, large-scale field decides how high the fog
  // reaches in each column, so some of the scene stays crisp while other parts sit in thick fog.
  float cov = fbm(vec2(uv.x * asp * 0.55 + t * 0.015, 7.0 + t * 0.01));
  float top = 0.16 + cov * 0.62;
  float edge = (top - uv.y) * 5.0 + (f - 0.5) * 2.6 + (r.x - 0.5) * 0.9;
  float d = smoothstep(0.0, 1.1, edge);
  // loose wisps adrift above the bank, separate from it
  float wisp = smoothstep(0.64, 0.86, fbm(w * 1.4 + vec2(t * 0.04, 3.0))) * smoothstep(0.95, 0.45, uv.y) * 0.55;
  d = max(d, wisp);
  d = max(d, smoothstep(0.24, 0.07, uv.y));
  d *= smoothstep(1.0, 0.80, uv.y);

  // light from above: billows are shaded warm cream inside, thin haze is cool blue-grey
  float lit = clamp(0.5 + (fbm(w + vec2(0.0, 0.06)) - f) * 3.2, 0.0, 1.0);
  vec3 warm = mix(vec3(0.84, 0.82, 0.79), uLight, clamp(lit * 0.75 + (f - 0.38) * 1.1, 0.0, 1.0));
  vec3 cool = mix(uShade, vec3(0.8, 0.82, 0.9), 0.45);
  vec3 col = mix(cool, warm, smoothstep(0.18, 0.8, d));
  col = mix(col, uBg, smoothstep(0.24, 0.05, uv.y));       // deep in, it is exactly the page

  gl_FragColor = vec4(col * d, d);
}
`

type RGB = [number, number, number]

/** Any CSS colour (incl. oklch) → 0..1 rgb, by letting the browser paint it. */
function readBackground(): RGB {
  const probe = document.createElement("div")
  probe.style.cssText = "position:fixed;width:0;height:0;background-color:var(--background)"
  document.body.append(probe)
  const css = getComputedStyle(probe).backgroundColor
  probe.remove()
  const c = document.createElement("canvas")
  c.width = c.height = 1
  const x = c.getContext("2d", { willReadFrequently: true })
  if (!x) return [0.972, 0.972, 0.98]
  x.clearRect(0, 0, 1, 1)
  x.fillStyle = css
  x.fillRect(0, 0, 1, 1)
  const d = x.getImageData(0, 0, 1, 1).data
  return [d[0] / 255, d[1] / 255, d[2] / 255]
}

function palette(bg: RGB) {
  const lum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]
  if (lum > 0.5) return { light: [0.965, 0.95, 0.925] as RGB, shade: [0.5, 0.55, 0.7] as RGB }
  const up = (v: number, k: number) => Math.min(1, v + k)
  return { light: [up(bg[0], 0.3), up(bg[1], 0.3), up(bg[2], 0.34)] as RGB, shade: [bg[0] * 0.55, bg[1] * 0.55, bg[2] * 0.7] as RGB }
}

export function FogEdge({ className }: { className?: string }) {
  const wrap = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const [fallback, setFallback] = React.useState(false)

  React.useEffect(() => {
    const el = wrap.current
    const cv = canvas.current
    if (!el || !cv) return
    // phones & tablets: no fog at all (the section is hidden there; don't spend a WebGL context on it)
    if (window.matchMedia("(max-width: 1023px)").matches) return
    const gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" })
    if (!gl) {
      setFallback(true)
      return
    }

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFallback(true)
      return
    }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "a")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const U = {
      res: gl.getUniformLocation(prog, "uRes"),
      t: gl.getUniformLocation(prog, "uT"),
      s: gl.getUniformLocation(prog, "uS"),
      bg: gl.getUniformLocation(prog, "uBg"),
      light: gl.getUniformLocation(prog, "uLight"),
      shade: gl.getUniformLocation(prog, "uShade"),
    }
    gl.clearColor(0, 0, 0, 0)

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let bg = readBackground()
    const setColours = () => {
      bg = readBackground()
      const p = palette(bg)
      gl.uniform3f(U.bg, bg[0], bg[1], bg[2])
      gl.uniform3f(U.light, p.light[0], p.light[1], p.light[2])
      gl.uniform3f(U.shade, p.shade[0], p.shade[1], p.shade[2])
    }
    setColours()

    const SCALE = 0.55
    const resize = () => {
      const w = Math.max(2, Math.round(el.clientWidth * SCALE))
      const h = Math.max(2, Math.round(el.clientHeight * SCALE))
      if (cv.width !== w || cv.height !== h) {
        cv.width = w
        cv.height = h
        gl.viewport(0, 0, w, h)
        gl.uniform2f(U.res, w, h)
      }
    }

    let raf = 0
    let last = performance.now()
    let clock = 18 // start part-way in, so it never opens on an empty frame
    let speed = 0
    const dim = document.querySelector<HTMLElement>("[data-fog-dim]")
    const dock = document.querySelector<HTMLElement>("[data-fog-dock]")
    let lastY = window.scrollY
    let shown = 0
    const draw = (progress: number) => {
      // the pinned scene behind dims as the fog arrives, and its progress labels step aside. Set straight on those two
      // elements: a CSS variable on <html> would make the browser re-resolve styles for the whole page every frame.
      if (dim) dim.style.opacity = Math.min(0.6, Math.max(0, (progress - 0.1) * 0.95)).toFixed(3)
      if (dock) dock.style.opacity = Math.max(0, Math.min(1, 1 - progress * 9)).toFixed(3)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(U.t, clock)
      gl.uniform1f(U.s, progress)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    const progressNow = () => {
      const r = el.getBoundingClientRect()
      return Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)))
    }
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const y = window.scrollY
      const v = Math.abs(y - lastY) / Math.max(dt, 0.001)
      lastY = y
      speed += (Math.min(v / 2200, 1) - speed) * Math.min(1, dt * 4) // eased, so it surges and settles
      clock += dt * (0.72 + speed * 3.2)
      // ease towards the true scroll position, Lenis-style, so the fog glides instead of tracking every tick
      shown += (progressNow() - shown) * (1 - Math.exp(-dt * 5))
      draw(shown)
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (raf || reduce) return
      shown = progressNow()
      last = performance.now()
      lastY = window.scrollY
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    resize()
    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) draw(progressNow())
    })
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: "120px" })
    io.observe(el)
    const mo = new MutationObserver(() => {
      setColours()
      if (reduce) draw(progressNow())
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    const onScroll = () => draw(progressNow())
    if (reduce) {
      onScroll()
      window.addEventListener("scroll", onScroll, { passive: true })
    }

    return () => {
      window.removeEventListener("scroll", onScroll)
      if (dim) dim.style.opacity = "0"
      if (dock) dock.style.opacity = ""
      stop()
      ro.disconnect()
      io.disconnect()
      mo.disconnect()
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    }
  }, [])

  return (
    <div ref={wrap} aria-hidden className={cn("pointer-events-none relative hidden lg:block lg:h-[150svh]", className)}>
      {fallback ? (
        // no WebGL: a plain fade into the page, so the hand-off still works
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_oklab,var(--background)_60%,transparent)_35%,var(--background)_70%)]" />
      ) : (
        <canvas ref={canvas} className="absolute inset-0 size-full" />
      )}
    </div>
  )
}
