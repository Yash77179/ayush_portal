import GradientASCII from "@/components/GradientASCII"

/**
 * The login / register backdrop: React Bits' GradientASCII (src/components/GradientASCII.jsx, installed from the
 * @react-bits registry) in the site's purples, kept quiet so the form stays the focus.
 *
 * Colours are the same family of purples the rest of the site uses — a softened violet (the hero's indigo, lightened so it never sits darkly behind text), the pale lilac page tone, lavender, and an orchid violet.
 * Characters: the component maps the field's density onto this string (faint → dense, duplicates ignored), so the letters of
 * CAREERBRIDGE sit in the middle of the ramp, from light to heavy (I C R E A B D G). They read as part of the gradient, not as a word.
 * (dpr and style are passed explicitly only because TypeScript infers them as required from the plain-JS source.)
 */
export function AsciiBackdrop() {
  return (
    <GradientASCII
      colors={["#6a58c9", "#f4f2fe", "#d3c6f7", "#b08cf3"]}
      shape="horizon"
      characters=" .:-=+ICREABDG#@"
      cellSize={18}
      density={0.8}
      glyphOpacity={0.42}
      gradientOpacity={0.5}
      lightMode
      dpr={undefined}
      style={undefined}
    />
  )
}
