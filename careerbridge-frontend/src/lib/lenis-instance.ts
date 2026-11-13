import type Lenis from "lenis"

/** The page's smooth-scroll instance, shared so other components (the footer's resistance and snap) can reach it. */
let instance: Lenis | null = null
export const setLenis = (l: Lenis | null) => {
  instance = l
}
export const getLenis = () => instance
