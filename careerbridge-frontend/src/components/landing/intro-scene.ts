/**
 * The opening scene's room (see intro-window.tsx), drawn in one WebGL pass on the `photo` canvas:
 *
 *  - the office photo, zoomed toward the window with gentle depth (the floor and the sides come at you a little
 *    faster than the far skyline);
 *  - the paper arrow on the floor under the window, coming at you with the near floor;
 *  - the shading at the edges and the window's soft blue-violet glow, which brightens and spreads as the window opens;
 *  - film grain: fine, dense, monochrome noise on every pixel, a little stronger in the midtones, re-exposed 15 times
 *    a second. It never moves or pops; it is the texture of the picture, and it covers the arrow too.
 *
 * A window-shaped hole (zoomed exactly like the DOM window frame, by s) is left open, so the window and the sky
 * behind it stay clean. Without WebGL the room is drawn on a 2D canvas (no grain) on a 2D canvas instead.
 */

export type Scene = {
  setZoom: (s: number) => void
  setLight: (l: number) => void
  start: () => void
  stop: () => void
  destroy: () => void
}

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`

const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D img;
uniform sampler2D arw;
uniform vec2 res;     // stage size, css px
uniform vec4 rect;    // where the photo sits at rest (object-fit: cover), css px, y down
uniform float s;      // zoom
uniform vec2 hole;    // half size of the window's hole at this zoom, css px
uniform vec4 arect;   // the arrow: centre (xy) and size (zw), css px, at this zoom
uniform float aang;   // the arrow's tilt, radians
uniform float aon;    // 1 once the arrow has loaded
uniform vec2 glowR;   // the window glow's inner and outer radius, css px
uniform float seed;   // grain frame
uniform float dpr;
uniform float light;  // 0..1: how far the window has opened; light pours out into the room as it does

float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float arrowA(vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(arw, uv).a;
}

void main() {
  vec2 p = vec2(v.x, 1.0 - v.y) * res;
  vec2 c = res * 0.5;
  vec2 d = p - c;
  if (abs(d.x) < hole.x && abs(d.y) < hole.y) discard;

  // the room, with gentle depth: the floor (low on screen) and the sides come at you a little faster than the skyline.
  // Kept light (about half of a full parallax) so the window stays the thing you watch
  float yb = p.y / res.y;
  float near = clamp(smoothstep(0.4, 1.05, yb) * 0.8 + smoothstep(0.18, 0.5, abs(d.x) / res.x) * 0.45, 0.0, 1.0);
  float z = pow(s, 0.94 + 0.2 * near);
  vec3 col = texture2D(img, (c + d / z - rect.xy) / rect.zw).rgb;

  // the paper arrow, with a soft shadow under it
  if (aon > 0.5) {
    vec2 q = p - arect.xy;
    float cs = cos(aang);
    float sn = sin(aang);
    q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
    vec2 au = q / arect.zw + 0.5;
    vec2 o = vec2(0.0, 8.0) / arect.zw;
    vec2 b = vec2(5.0) / arect.zw;
    float sh = (arrowA(au - o + vec2(b.x, 0.0)) + arrowA(au - o - vec2(b.x, 0.0)) + arrowA(au - o + vec2(0.0, b.y)) + arrowA(au - o - vec2(0.0, b.y))) * 0.25;
    col *= 1.0 - 0.5 * sh;
    if (au.x >= 0.0 && au.y >= 0.0 && au.x <= 1.0 && au.y <= 1.0) {
      vec4 a = texture2D(arw, au);
      col = mix(col, a.rgb, a.a);
    }
  }

  // the edges sink into shadow
  float r = length(d) / (length(res) * 0.5);
  col = mix(col, vec3(0.055, 0.04, 0.12), smoothstep(0.45, 1.05, r) * 0.72);
  // the window throws a soft blue-violet light onto the room around it
  float g = 1.0 - smoothstep(glowR.x, glowR.y * (1.0 + 0.45 * light), length(d));
  vec3 glow = mix(vec3(0.53, 0.57, 1.0), vec3(0.86, 0.8, 1.0), light) * (0.5 + 0.28 * light) * g * g;
  col = 1.0 - (1.0 - col) * (1.0 - glow);

  // film grain: per pixel (about a css px), near-gaussian, monochrome, a touch stronger in the midtones
  vec2 gp = floor(gl_FragCoord.xy / max(1.0, dpr * 0.85));
  float n = (h12(gp + seed * 13.17) + h12(gp + seed * 7.31 + 91.7) + h12(gp + seed * 3.77 + 17.3)) / 3.0 - 0.5;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += n * 0.2 * (0.6 + 0.4 * (1.0 - abs(l - 0.45) * 2.0));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export function createScene(opts: {
  stage: HTMLElement
  pane: HTMLElement
  photo: HTMLCanvasElement
  photoSrc: string
  arrowSrc: string
  /** called once, when the office photo has been drawn (or failed to load), so the page can reveal the scene */
  onReady?: () => void
}): Scene {
  const { stage, pane, photo: canvas } = opts

  let w = 0
  let h = 0
  let dpr = 1
  let s = 1 // zoom, from the scroll
  let light = 0 // how far the window has opened
  let running = false
  let raf = 0
  const t0 = performance.now()

  const img = new Image()
  img.decoding = "async"
  img.src = opts.photoSrc
  const arrow = new Image()
  arrow.decoding = "async"
  arrow.src = opts.arrowSrc

  const gl = canvas.getContext("webgl", { antialias: false })
  const flat = gl ? null : canvas.getContext("2d")
  let prog: WebGLProgram | null = null
  const tex: (WebGLTexture | null)[] = []
  let u: Record<string, WebGLUniformLocation | null> = {}

  if (gl) {
    const sh = (type: number, src: string) => {
      const o = gl.createShader(type)!
      gl.shaderSource(o, src)
      gl.compileShader(o)
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn("intro-scene shader:", gl.getShaderInfoLog(o))
      return o
    }
    prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(prog, "a")
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    u = Object.fromEntries(
      ["img", "arw", "res", "rect", "s", "hole", "arect", "aang", "aon", "glowR", "seed", "dpr", "light"].map((n) => [n, gl.getUniformLocation(prog!, n)])
    )
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(i ? [0, 0, 0, 0] : [26, 22, 48, 255]))
      tex.push(t)
    }
    gl.uniform1i(u.img, 0)
    gl.uniform1i(u.arw, 1)
  }
  const upload = (i: number, source: HTMLImageElement) => {
    if (!gl) return
    gl.activeTexture(gl.TEXTURE0 + i)
    gl.bindTexture(gl.TEXTURE_2D, tex[i])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  }
  let ready = false
  const markReady = () => {
    if (ready) return
    ready = true
    opts.onReady?.()
  }
  img.onload = () => {
    upload(0, img)
    draw()
    markReady()
  }
  img.onerror = markReady
  arrow.onload = () => {
    upload(1, arrow)
    draw()
  }

  // the photo's rest position: object-fit: cover, focused a little above centre (the neon sign stays in)
  const coverRect = () => {
    const iw0 = img.naturalWidth || 2400
    const ih0 = img.naturalHeight || 1792
    const k = Math.max(w / iw0, h / ih0)
    const iw = iw0 * k
    const ih = ih0 * k
    return [(w - iw) * 0.5, (h - ih) * 0.32, iw, ih] as const
  }

  // the arrow: centred under the window's sill, bobbing gently at rest; it comes at you with the floor
  const arrowBox = (k: number, t: number) => {
    if (!arrow.naturalWidth) return null
    const cx = w / 2
    const cy = h / 2
    const ph = pane.offsetHeight
    const tc = Math.min(17, Math.max(10, w * 0.011)) // the casing's thickness (--t)
    const top = cy + ph / 2 + tc * 3.4 + 6
    // a fifth of the window's height, so the two keep their proportions on every screen (the window is sized
    // to leave room for it: see --wh in intro-window.tsx)
    const ah = Math.min(ph * 0.2, h - top - h * 0.02)
    if (ah < 40) return null
    const aw = ah * (arrow.naturalWidth / arrow.naturalHeight)
    // a very slow, very small drift (one 5s cycle, a few px) rather than a bob
    const bob = Math.sin((t / 5) * Math.PI * 2) * Math.min(3, ah * 0.025) * Math.max(0, 1 - (s - 1) * 4)
    const za = Math.pow(k, 1.22)
    const ay = top + ah / 2 + bob
    return { x: cx, y: cy + (ay - cy) * za, w: aw * za, h: ah * za }
  }

  const draw = (now = performance.now()) => {
    if (!w) return
    const t = (now - t0) / 1000
    const cx = w / 2
    const cy = h / 2
    const pw = pane.offsetWidth
    const ph = pane.offsetHeight
    const k = s // the room only moves with the scroll
    const ab = arrowBox(k, t)
    const tilt = (-3 * Math.PI) / 180

    if (gl && prog) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      const r = coverRect()
      gl.uniform2f(u.res, w, h)
      gl.uniform4f(u.rect, r[0], r[1], r[2], r[3])
      gl.uniform1f(u.s, k)
      gl.uniform2f(u.hole, (pw / 2) * s, (ph / 2) * s)
      gl.uniform4f(u.arect, ab?.x ?? 0, ab?.y ?? 0, ab?.w ?? 1, ab?.h ?? 1)
      gl.uniform1f(u.aang, tilt)
      gl.uniform1f(u.aon, ab ? 1 : 0)
      gl.uniform2f(u.glowR, pw * 0.4 * s, ph * 1.05 * s)
      gl.uniform1f(u.light, light)
      gl.uniform1f(u.seed, Math.floor(t * 15) % 97)
      gl.uniform1f(u.dpr, dpr)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return
    }
    if (!flat) return
    // fallback: flat 2D, no depth or grain
    flat.setTransform(dpr, 0, 0, dpr, 0, 0)
    flat.clearRect(0, 0, w, h)
    flat.save()
    flat.translate(cx, cy)
    flat.scale(k, k)
    flat.translate(-cx, -cy)
    if (img.complete && img.naturalWidth) {
      const r = coverRect()
      flat.drawImage(img, r[0], r[1], r[2], r[3])
    }
    flat.restore()
    if (ab) {
      flat.save()
      flat.translate(ab.x, ab.y)
      flat.rotate(tilt)
      flat.drawImage(arrow, -ab.w / 2, -ab.h / 2, ab.w, ab.h)
      flat.restore()
    }
    const rr = Math.hypot(w, h) / 2
    const vig = flat.createRadialGradient(cx, cy, rr * 0.45, cx, cy, rr * 1.05)
    vig.addColorStop(0, "rgba(14,10,30,0)")
    vig.addColorStop(1, "rgba(14,10,30,0.72)")
    flat.fillStyle = vig
    flat.fillRect(0, 0, w, h)
    flat.clearRect(cx - (pw / 2) * s, cy - (ph / 2) * s, pw * s, ph * s)
  }

  const size = () => {
    // (touch screens: 1.5 at most; a full-screen shader at 3x on a phone costs more than it shows)
    const coarse = window.matchMedia("(pointer: coarse)").matches
    dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2)
    w = stage.offsetWidth
    h = stage.offsetHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    draw()
  }
  const ro = new ResizeObserver(size)
  ro.observe(stage)
  size()

  // the loop draws only when it must: the view moved (setZoom/setLight mark it dirty) or the grain is due for its
  // next exposure (15 a second). Drawing the full screen every frame for nothing is what loaded phones down.
  let dirty = true
  let lastSeed = -1
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const seed = Math.floor(((now - t0) / 1000) * 15)
    if (!dirty && seed === lastSeed) return
    dirty = false
    lastSeed = seed
    draw(now)
  }

  return {
    setZoom: (z) => {
      s = z
      dirty = true
      if (!running) draw()
    },
    setLight: (l) => {
      light = l
      dirty = true
      if (!running) draw()
    },
    start: () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(loop)
    },
    stop: () => {
      running = false
      cancelAnimationFrame(raf)
    },
    destroy: () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      img.onload = null
      img.onerror = null
      arrow.onload = null
      // free what we made, but keep the context itself: a canvas hands back the same context on the next mount
      // (React mounts effects twice in development), and a lost one would stay lost
      if (gl) {
        for (const t of tex) gl.deleteTexture(t)
        gl.deleteProgram(prog)
      }
    },
  }
}
