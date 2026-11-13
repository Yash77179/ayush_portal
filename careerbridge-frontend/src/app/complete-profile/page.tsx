"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { AUTH_BUTTON, AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completeProfile, errorMessage } from "@/lib/api";

const ROLES = { student: "Student", company: "Company recruiter", university: "University representative" } as const;
const GENDERS = { male: "Male", female: "Female", other: "Prefer not to say" } as const;
type Form = { role: string; gender: string; first_name: string; last_name: string; username: string };

/**
 * The one-time step after signing up with Google: Google gave us the email (shown, locked) and maybe a name;
 * the person picks their role and gender and confirms their name and username before the account is usable.
 * The app sends any account with profile_completed === false here (see ShellGate).
 */
export default function CompleteProfilePage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // what the person has typed; anything untouched shows what the account already has (from Google)
  const [edits, setEdits] = useState<Partial<Form>>({});
  const ready = !loading && user?.profile_completed === false;

  // Not signed in → login. Already complete → dashboard.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.profile_completed !== false) router.replace("/dashboard");
  }, [loading, user, router]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const form: Form = {
    role: user.role === "admin" ? "student" : user.role,
    gender: user.gender || "",
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    ...edits,
  };
  const set = (key: keyof Form, value: string) => setEdits((e) => ({ ...e, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.gender) {
      toast.error("Please choose a gender option.");
      return;
    }
    setSaving(true);
    try {
      await completeProfile({ ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), username: form.username.trim() });
      await refreshUser();
      toast.success("You're all set — welcome to CareerBridge!");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save your details."));
      setSaving(false);
    }
  };

  return (
    <AuthShell
      title="Finish your profile"
      subtitle="You signed in with Google. Tell us a little more to activate your account."
      footer={
        <>
          Not you?{" "}
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="font-semibold text-[oklch(0.5_0.17_285)] underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" hint="From your Google account — it can't be changed here.">
          <div className="relative">
            <Input id="email" type="email" value={user.email} disabled readOnly className="pr-12" />
            <Lock aria-hidden className="absolute top-1/2 right-5 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="I am a…">
            <Select value={form.role} items={ROLES} onValueChange={(v) => v && set("role", v)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLES).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gender">
            <Select value={form.gender} items={GENDERS} onValueChange={(v) => v && set("gender", v)}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GENDERS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Field label="First name">
            <Input id="first_name" placeholder="Arjun" autoComplete="given-name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
          </Field>
          <Field label="Last name">
            <Input id="last_name" placeholder="Sharma" autoComplete="family-name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
          </Field>
        </div>

        <Field label="Username">
          <Input id="username" placeholder="arjun_sharma" autoComplete="username" value={form.username} onChange={(e) => set("username", e.target.value)} required />
        </Field>

        <Button type="submit" size="lg" disabled={saving} className={`${AUTH_BUTTON} w-full`}>
          {saving && <Loader2 className="animate-spin" />}
          Activate my account
        </Button>
      </form>
    </AuthShell>
  );
}
