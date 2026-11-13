import type { LenisOptions } from "lenis"

/**
 * One feel for the whole site. Lower `lerp` = floatier, longer glide; lower `wheelMultiplier` =
 * each wheel notch travels less, so content doesn't "go by" too quickly.
 */
export const SMOOTH_SCROLL: LenisOptions = {
  lerp: 0.07,
  wheelMultiplier: 0.85,
  smoothWheel: true,
  allowNestedScroll: true, // chat panes, modals and menus keep their own scroll
  anchors: { offset: -90 },
}
