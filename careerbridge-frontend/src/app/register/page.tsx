"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import gsap from "gsap";

import { useAuth } from "@/contexts/auth-context";
import { AUTH_BUTTON, AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/kit";
import { GoogleAuth } from "@/components/google-button";
import { OtpInput } from "@/components/otp-input";
import { PasswordInput } from "@/components/password-input";
import { errorMessage, sendRegisterOtp } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Any CSS colour (the theme's are oklch) → an rgba() string GSAP can tween, keeping the alpha. */
function toRgba(css: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return css;
  x.clearRect(0, 0, 1, 1);
  x.fillStyle = css;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`;
}

/** Short steps, two rows each — so the card stays the same size as the sign-in card. The last one checks the emailed code. */
const STEPS = [
  { subtitle: "First, tell us who you are." },
  { subtitle: "Now your name and a username." },
  { subtitle: "Your email and a password." },
  { subtitle: "" }, // the verify step writes its own, with the email in it
] as const;
const DETAILS = 2; // the step whose submit emails the code
const VERIFY = 3;

/** Which step shows the field a server error is about, so we can take the user back to it. */
const FIELD_STEP: Record<string, number> = { role: 0, gender: 0, first_name: 1, last_name: 1, username: 1, email: 2, password: 2, password2: 2 };
function stepOfError(err: unknown) {
  try {
    const keys = Object.keys(JSON.parse((err as Error).message));
    return keys.map((k) => FIELD_STEP[k]).find((s) => s !== undefined);
  } catch {
    return undefined;
  }
}

/** Seconds left on a countdown that ticks once a second. */
function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft] as const;
}

function RegisterForm() {
  const { register, login } = useAuth();
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [resendIn, setResendIn] = useCountdown();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const mainWrap = useRef<HTMLDivElement>(null);
  const goo = useRef<HTMLDivElement>(null);
  const gooMain = useRef<HTMLDivElement>(null);
  const gooBack = useRef<HTMLDivElement>(null);
  const split = useRef<{ open: boolean; tl: gsap.core.Timeline | null }>({ open: false, tl: null });
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    // the role tapped on the landing page ("Pick yours") arrives as ?role=student|company|university
    role: ["student", "company", "university"].includes(params.get("role") ?? "") ? (params.get("role") as string) : "student",
    gender: "",
    password: "",
    password2: "",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // The back button splits off the main one like a cell dividing. While it plays, the buttons' real backgrounds step aside and
  // two dark shapes do the work under an SVG "goo" filter: a circle buds out of the left end of the bar, a neck stretches between
  // them, thins, and snaps. At the end the real, light back button and the real dark main button fade in over the shapes and the
  // shapes are hidden. It is one timeline, so going back to step 1 simply plays it in reverse and the circle merges back in.
  const open = step > 0;
  useEffect(() => {
    const b = backRef.current;
    const m = mainRef.current;
    const wrap = mainWrap.current;
    const g = goo.current;
    const gm = gooMain.current;
    const gb = gooBack.current;
    if (!b || !m || !wrap || !g || !gm || !gb) return;
    const st = split.current;
    const SLOT = 66; // the circle (56) plus its gap (10)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!st.tl) {
      st.open = false;
      gsap.set(b, { autoAlpha: 0, pointerEvents: "none" });
      gsap.set(g, { autoAlpha: 0 });
      gsap.set(gb, { x: 36, scale: 0.2 });
      if (!reduce) {
        const dark = toRgba(getComputedStyle(m).backgroundColor);
        // At the end of either direction: make sure the bar is solid ink in the same instant the shapes hide (a reversed zero-length tween
        // can leave it transparent for a few frames), then, a frame later, hand colour and transitions back to the stylesheet so hover works.
        const clear = () => {
          gsap.set(m, { backgroundColor: dark });
          requestAnimationFrame(() => gsap.set([m, b], { clearProps: "backgroundColor,transition" }));
        };
        const tl = gsap.timeline({ paused: true, onComplete: clear, onReverseComplete: clear });
        tl.to(g, { autoAlpha: 1, duration: 0.001 }, 0); // the shapes appear a hair before the real bar's colour leaves — and, in reverse, go only after it is back
        // explicit start colour: the theme's own colour is lab(), which GSAP can't read as a starting point
        tl.fromTo(m, { backgroundColor: dark }, { backgroundColor: dark.replace(/,[^,]*\)$/, ",0)"), duration: 0.001, immediateRender: false }, 0.001); // the goo shapes draw the dark bar while it moves
        tl.to(gm, { left: SLOT, duration: 0.8, ease: "power3.inOut" }, 0.002);
        tl.to(wrap, { marginLeft: SLOT, duration: 0.8, ease: "power3.inOut" }, 0.002);
        tl.to(gb, { x: 0, scale: 1, duration: 0.8, ease: "power3.inOut" }, 0.002);
        tl.to(b, { autoAlpha: 1, duration: 0.22, ease: "power1.out" }, 0.68);
        tl.to(gb, { autoAlpha: 0, duration: 0.22 }, 0.68);
        tl.to(m, { backgroundColor: dark, duration: 0.22 }, 0.68);
        tl.to(g, { autoAlpha: 0, duration: 0.001 }, 0.92);
        tl.set(b, { pointerEvents: "auto" }, 0.9);
        st.tl = tl;
      }
    }
    if (st.open === open) return;
    st.open = open;

    if (reduce || !st.tl) {
      gsap.set(wrap, { marginLeft: open ? SLOT : 0 });
      gsap.set(b, { autoAlpha: open ? 1 : 0, pointerEvents: open ? "auto" : "none" });
      return;
    }
    // the buttons carry a CSS colour transition; while GSAP drives their colours it would lag behind and show pale in-between frames
    gsap.set([m, b], { transition: "none" });
    if (open) st.tl.play();
    else st.tl.reverse();
  }, [open]);

  // Native validation runs on submit for the fields on screen, so each step checks only what it shows.
  // Ask the server to check the whole form and email a code. Any field it rejects sends the user back to that field's step.
  const sendCode = async () => {
    setLoading(true);
    try {
      const res = await sendRegisterOtp(form);
      setOtp("");
      setOtpError(false);
      setResendIn(res.resend_in);
      setStep(VERIFY);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send the code."));
      const s = stepOfError(err);
      if (s !== undefined) setStep(s);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code = otp) => {
    if (code.length < 6 || loading) return;
    setLoading(true);
    try {
      await register({ ...form, otp: code });
    } catch (err) {
      setOtpError(true);
      toast.error(errorMessage(err, "Couldn't verify the code."));
      setLoading(false);
      return;
    }
    // the account exists — sign straight in
    try {
      await login(form.username, form.password);
      toast.success("Welcome to CareerBridge!");
      router.push("/dashboard");
    } catch {
      toast.success("Account created — please sign in.");
      router.push("/login");
    }
  };

  // Native validation runs on submit for the fields on screen, so each step checks only what it shows.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < DETAILS) {
      setStep((s) => s + 1);
      return;
    }
    if (step === DETAILS) {
      if (form.password !== form.password2) {
        toast.error("Passwords do not match.");
        return;
      }
      await sendCode();
      return;
    }
    await verify();
  };

  return (
    <AuthShell
      title={step === VERIFY ? "Check your email" : "Create your account"}
      subtitle={step === VERIFY ? `We sent a 6-digit code to ${form.email}.` : STEPS[step].subtitle}
      aside={
        <ol aria-label={`Step ${step + 1} of ${STEPS.length}`} className="flex shrink-0 gap-1.5">
          {STEPS.map((_, i) => (
            <li key={i} aria-hidden className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-foreground/15"}`} />
          ))}
        </ol>
      }
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div key={step} className="animate-in space-y-4 duration-300 fade-in-0 slide-in-from-right-2">
          {step === 0 && (
            <>
              <Field label="I am a…">
                <Select value={form.role} items={{ student: "Student", company: "Company recruiter", university: "University representative" }} onValueChange={(v) => v && set("role", v)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="company">Company recruiter</SelectItem>
                    <SelectItem value="university">University representative</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Gender">
                <Select value={form.gender} items={{ male: "Male", female: "Female", other: "Prefer not to say" }} onValueChange={(v) => v && set("gender", v)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Field label="First name">
                  <Input id="first_name" placeholder="Arjun" autoFocus value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                </Field>
                <Field label="Last name">
                  <Input id="last_name" placeholder="Sharma" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                </Field>
              </div>
              <Field label="Username">
                <Input id="username" placeholder="arjun_sharma" autoComplete="username" value={form.username} onChange={(e) => set("username", e.target.value)} required />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Email">
                <Input id="email" type="email" placeholder="arjun@example.com" autoComplete="email" autoFocus value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password">
                  <PasswordInput id="password" placeholder="8+ characters" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
                </Field>
                <Field label="Confirm">
                  <PasswordInput id="password2" placeholder="Repeat" autoComplete="new-password" value={form.password2} onChange={(e) => set("password2", e.target.value)} required />
                </Field>
              </div>
            </>
          )}

          {step === VERIFY && (
            <>
              <OtpInput
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setOtpError(false);
                }}
                onComplete={(v) => verify(v)}
                disabled={loading}
                invalid={otpError}
              />
              <p className="text-center text-[14px] text-muted-foreground">
                {resendIn > 0 ? (
                  <>Didn&apos;t get it? You can ask again in <span className="tabular-nums">{Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, "0")}</span></>
                ) : (
                  <>
                    Didn&apos;t get it? Check spam, or{" "}
                    <button type="button" onClick={sendCode} disabled={loading} className="font-semibold text-[oklch(0.5_0.17_285)] underline-offset-4 hover:underline disabled:opacity-50">
                      send a new code
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>

        {/* The row: the real back button (a circle) and the real main button, plus the hidden "goo" shapes the split is drawn with. */}
        <div className="relative h-14">
          <svg aria-hidden width="0" height="0" className="absolute">
            <defs>
              <filter id="auth-goo" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
              </filter>
            </defs>
          </svg>
          <div ref={goo} aria-hidden className="pointer-events-none invisible absolute inset-0" style={{ filter: "url(#auth-goo)" }}>
            <div ref={gooMain} className="absolute inset-y-0 right-0 left-0 rounded-[14px] bg-primary" />
            <div ref={gooBack} className="absolute top-0 left-0 size-14 rounded-full bg-primary" />
          </div>

          <Button
            ref={backRef}
            type="button"
            variant="outline"
            aria-label="Back"
            aria-hidden={!open}
            tabIndex={open ? 0 : -1}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="invisible absolute top-0 left-0 size-14! rounded-full p-0!"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div ref={mainWrap} className="relative">
            <Button ref={mainRef} type="submit" size="lg" disabled={loading} className={`${AUTH_BUTTON} w-full`}>
              {loading && <Loader2 className="animate-spin" />}
              {step === VERIFY ? "Verify & create account" : step === DETAILS ? "Email me a code" : "Continue"}
            </Button>
          </div>
        </div>
      </form>
      {step !== VERIFY && <GoogleAuth label="Sign up with Google" role={form.role} />}
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
