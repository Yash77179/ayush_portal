import { PlateArt, type ArtKind } from "@/components/landing/plate-art"

/**
 * The pictures on the "Who it's for" cards (roles-scroll.tsx): kept quiet on purpose. The side's soft wave plate,
 * and one big serif number on it with a small label. Sized to the picture (cq units), so it reads the same on a phone.
 */
function Plate({ hue, art, figure, unit, label }: { hue: number; art: ArtKind; figure: string; unit?: string; label: string }) {
  return (
    <div
      className="@container relative h-[52%] w-full shrink-0 overflow-hidden text-[oklch(0.2_0.05_280)] lg:h-full lg:w-[22.4vw]"
      style={{ background: `linear-gradient(158deg, oklch(0.999 0.002 285), oklch(0.955 0.03 ${hue}))` }}
    >
      <PlateArt kind={art} hue={hue} id={`side-${art}`} />
      <div className="absolute bottom-[8%] left-[8%]">
        <p className="text-[max(10px,3.2cqmin)] font-semibold tracking-[0.2em] text-[oklch(0.22_0.06_280/0.55)] uppercase">{label}</p>
        <p className="font-display mt-[1.5cqmin] flex items-start leading-[0.78] tracking-[-0.03em] italic">
          <span className="text-[max(72px,40cqmin)]">{figure}</span>
          {unit && <span className="mt-[2.4cqmin] ml-[1cqmin] text-[max(24px,12cqmin)]">{unit}</span>}
        </p>
      </div>
    </div>
  )
}

export const StudentPicture = () => <Plate hue={262} art="waves" figure="86" unit="%" label="Match score" />
export const CompanyPicture = () => <Plate hue={300} art="silk" figure="38" label="Applicants, one opening" />
export const UniversityPicture = () => <Plate hue={190} art="ripples" figure="92" unit="%" label="Placed this season" />
