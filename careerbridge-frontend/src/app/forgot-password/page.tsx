"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { AUTH_BUTTON, AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/kit";
import { OtpInput } from "@/components/otp-input";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmPasswordReset, errorMessage, sendPasswordResetOtp, verifyPasswordResetOtp } from "@/lib/api";

type Stage = "email" | "code" | "password";
const ORDER: Stage[] = ["email", "code", "password"];

/**
 * Forgot password, in three steps on one card:
 * 1. the email → we send a 6-digit code (the server answers the same whether or not the email has an account);
 * 2. the code → checked on its own, so a wrong code is caught before anything else;
 * 3. a new password → it is saved and the user is signed straight in.
 */
export default function ForgotPasswordPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [pw, setPw] = useState({ password: "", password2: "" });
  const [resendIn, setResendIn] = useState(0);
  const address = email.trim();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    setLoading(true);
    try {
      const res = await sendPasswordResetOtp(address);
      setResendIn(res.resend_in);
      setOtp("");
      setOtpError(false);
      setStage("code");
      toast.success("If that email has an account, a code is on its way.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't send the code."));
    } finally {
      setLoading(false);
    }
  };

  const checkCode = async (code = otp) => {
    if (loading) return;
    if (code.length < 6) {
      setOtpError(true);
      toast.error("Enter the 6-digit code from the email.");
      return;
    }
    setLoading(true);
    try {
      await verifyPasswordResetOtp(address, code);
      setStage("password");
    } catch (err) {
      setOtpError(true);
      toast.error(errorMessage(err, "Couldn't check the code."));
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (pw.password !== pw.password2) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    let username: string;
    try {
      ({ username } = await confirmPasswordReset({ email: address, otp, ...pw }));
    } catch (err) {
      const msg = errorMessage(err, "Couldn't reset the password.");
      toast.error(msg);
      // the code ran out while they were typing: back to step 2 for a fresh one
      if (/code/i.test(msg)) {
        setOtp("");
        setOtpError(true);
        setStage("code");
      }
      setLoading(false);
      return;
    }
    try {
      await login(username, pw.password);
      toast.success("Password updated — you're signed in.");
      router.push("/dashboard");
    } catch {
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stage === "email") sendCode();
    else if (stage === "code") checkCode();
    else savePassword();
  };

  const step = ORDER.indexOf(stage);
  const back = () => setStage(ORDER[Math.max(0, step - 1)]);

  const copy = {
    email: { title: "Forgot password?", subtitle: "Enter your account's email and we'll send you a 6-digit code.", button: "Send code" },
    code: { title: "Check your email", subtitle: `Enter the 6-digit code we sent to ${address}.`, button: "Verify code" },
    password: { title: "New password", subtitle: "Choose a new password for your account.", button: "Reset password" },
  }[stage];

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.subtitle}
      aside={
        <ol aria-label={`Step ${step + 1} of ${ORDER.length}`} className="flex shrink-0 gap-1.5">
          {ORDER.map((s, i) => (
            <li key={s} aria-hidden className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-foreground/15"}`} />
          ))}
        </ol>
      }
      footer={
        <>
          Remembered it? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div key={stage} className="animate-in space-y-4 duration-300 fade-in-0 slide-in-from-right-2">
          {stage === "email" && (
            <Field label="Email">
              <Input id="email" type="email" placeholder="arjun@example.com" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
          )}

          {stage === "code" && (
            <>
              <OtpInput
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  setOtpError(false);
                }}
                onComplete={(v) => checkCode(v)}
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

          {stage === "password" && (
            <>
              <Field label="New password">
                <PasswordInput id="password" placeholder="Min. 8 characters" autoComplete="new-password" autoFocus value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required minLength={8} />
              </Field>
              <Field label="Confirm new password">
                <PasswordInput id="password2" placeholder="Repeat it" autoComplete="new-password" value={pw.password2} onChange={(e) => setPw({ ...pw, password2: e.target.value })} required />
              </Field>
            </>
          )}
        </div>

        <div className="flex gap-2.5">
          {stage !== "email" && (
            <Button type="button" variant="outline" aria-label="Back" onClick={back} disabled={loading} className="size-14! shrink-0 rounded-full p-0!">
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <Button type="submit" size="lg" disabled={loading} className={`${AUTH_BUTTON} min-w-0 flex-1`}>
            {loading && <Loader2 className="animate-spin" />}
            {copy.button}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
