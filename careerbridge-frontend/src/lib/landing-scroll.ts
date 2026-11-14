import { getLenis } from "@/lib/lenis-instance"

/**
 * Where to scroll to for a section of the landing page, so it arrives in its finished state. Several sections are
 * pinned or slide over each other, so their top edge is not where they can be seen:
 *  - "hero": its own top edge, which overlaps the end of the intro (it rises over it);
 *  - "roles": it waits under the Open roles band (pulled up by --under) until that band has slid away;
 *  - anything else: its top edge, with no offset (the nav floats over the page, it takes no room).
 */
let heroAt: number | null = null

export function landingTarget(id: string): number | null {
  if (id === "hero") {
    // the hero rises over the end of the intro, so its place is its own top edge (read while it is still below the
    // screen; once it sticks to the top its box no longer says where it sits in the page)
    const hero = document.querySelector<HTMLElement>("[data-hero]")
    if (!hero) return 0
    const r = hero.getBoundingClientRect().top
    if (r > 0) heroAt = r + window.scrollY
    return heroAt ?? r + window.scrollY
  }
  const el = document.getElementById(id)
  if (!el) return null
  const top = el.getBoundingClientRect().top + window.scrollY
  if (id === "roles") {
    const under = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--under")) || 0
    return top + under
  }
  return top
}

/** Glide to a landing section (or jump, without smooth scrolling). */
export function goToSection(id: string, duration = 1.6) {
  const y = landingTarget(id)
  if (y == null) return false
  const lenis = getLenis()
  // lock: while it glides, a finger on the screen (the tap that started it, or a nudge) can't add a fling of its own;
  // when it lands, it is set exactly on the spot and stays there until you scroll yourself
  if (lenis)
    lenis.scrollTo(y, {
      duration,
      force: true,
      lock: true,
      onComplete: () => {
        lenis.stop()
        lenis.scrollTo(y, { immediate: true, force: true })
        lenis.start()
      },
    })
  else window.scrollTo({ top: y, behavior: "smooth" })
  return true
}
