"use client";

import { useRouter } from "next/navigation";
import { useThemeRipple } from "@/lib/theme-ripple";
import { toast } from "sonner";
import { cn } from "cn";

import { useAuth } from "@/contexts/auth-context";
import { usePhotoUpload } from "@/lib/use-photo-upload";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import { PageHeader, Panel, ProfileCard, stagger } from "@/components/kit";

const THEMES = [
  { v: "light", label: "Light", Icon: SunIcon },
  { v: "dark", label: "Dark", Icon: MoonIcon },
  { v: "system", label: "System", Icon: MonitorIcon },
];

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search pages and actions" },
  { keys: ["⌘", "B"], label: "Collapse or expand the sidebar" },
];

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useThemeRipple();
  const router = useRouter();
  const photo = usePhotoUpload();
  if (!user) return null;

  const name = user.full_name || user.username;

  return (
    <div className="space-y-8">
      <PageHeader title="Account" subtitle="Your details, appearance and shortcuts." />

      <div className="grid gap-5 lg:grid-cols-12">
        <ProfileCard
          className="lg:col-span-4"
          name={name}
          status={user.role === "company" ? "Hiring now" : "Active"}
          handle={user.email || user.username}
          photo={user.profile_photo}
          gender={user.gender}
          onPhoto={photo.upload}
          uploading={photo.uploading}
          style={stagger(0)}
          href="/dashboard/student/profile"
          roleLabel={user.role === "company" ? "Recruiter" : user.role === "university" ? "University" : user.role}
          action="Log out"
          onAction={() => {
            logout();
            toast("Signed out");
            router.push("/");
          }}
        />

        <Panel className="lg:col-span-8" title="Appearance" style={stagger(1)} contentClassName="space-y-4">
          <p className="text-[0.875rem] text-muted-foreground">Choose how CareerBridge looks on this device.</p>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(({ v, label, Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setTheme(v)}
                aria-pressed={theme === v}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-[1.375rem] border p-5 text-[0.875rem] font-medium outline-none transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring",
                  theme === v ? "border-foreground/80 bg-secondary" : "border-(--hairline) hover:bg-secondary"
                )}
              >
                <Icon className="size-6" />
                {label}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Shortcuts" style={stagger(2)} contentClassName="stagger divide-y divide-border">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
            <span className="text-[0.875rem]">{s.label}</span>
            <span className="flex gap-1.5">
              {s.keys.map((k) => (
                <kbd key={k} className="grid h-7 min-w-7 place-items-center rounded-lg border border-(--hairline) bg-secondary px-1.5 text-[0.75rem] font-medium">
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
