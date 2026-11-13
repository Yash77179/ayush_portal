// The sidebar/header shell now lives in the root layout (components/shell-gate.tsx).
export default function InternshipsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// A plain pass-through layout: skip Next's dev-only instant-navigation check for it (it dropped this segment and,
// when you clicked something while the page was still hydrating, left React stuck in a hydration loop).
export const instant = false
