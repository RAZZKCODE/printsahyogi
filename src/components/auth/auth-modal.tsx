"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Eye, EyeOff, Gift, LoaderCircle, Lock, Mail, Phone, Printer, ShieldCheck, Sparkles, User, X } from "lucide-react";
import { useAuthStore } from "@/tools/auth/auth-store";

type Status = { tone: "error" | "success"; text: string } | null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}
const strengthLabel = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];

export function AuthModal() {
  const { modalOpen, mode, closeAuth, setMode, login, signup, loginWithGoogle, resetPassword, updatePassword } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referral, setReferral] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState<"" | "form" | "google">("");
  const [status, setStatus] = useState<Status>(null);
  const [touched, setTouched] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Prefill referral code from ?ref=CODE links
  useEffect(() => {
    if (!modalOpen) return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) { setReferral(ref.toUpperCase()); setShowReferral(true); }
  }, [modalOpen]);

  useEffect(() => {
    setStatus(null);
    setTouched(false);
    setPassword("");
    setConfirm("");
    if (modalOpen) window.setTimeout(() => firstFieldRef.current?.focus(), 60);
  }, [mode, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) closeAuth(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, closeAuth, modalOpen]);

  const strength = passwordStrength(password);
  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (mode === "signup" && name.trim().length < 2) result.name = "Enter your full name";
    if (mode !== "update-password" && !EMAIL_RE.test(email.trim())) result.email = "Enter a valid email address";
    if (mode === "signup" && phone && !/^[6-9]\d{9}$/.test(phone)) result.phone = "Enter a valid 10-digit mobile number";
    const isNew = mode === "signup" || mode === "update-password";
    if (mode !== "forgot" && password.length < (isNew ? 8 : 1)) result.password = isNew ? "Use at least 8 characters" : "Enter your password";
    if (isNew && confirm !== password) result.confirm = "Passwords do not match";
    if (mode === "signup" && !agree) result.agree = "Please accept the terms";
    return result;
  }, [agree, confirm, email, mode, name, password, phone]);

  if (!modalOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    setBusy("form");
    setStatus(null);
    const result = mode === "login" ? await login(email, password)
      : mode === "signup" ? await signup({ name, email, phone, password, referral: showReferral ? referral : "" })
      : mode === "update-password" ? await updatePassword(password)
      : await resetPassword(email);
    setBusy("");
    setStatus({ tone: result.ok ? "success" : "error", text: result.message });
    // Sign-up that needs email confirmation keeps the modal open to show the message.
    if (result.ok && mode !== "forgot" && !useAuthStore.getState().modalOpen) { setName(""); setPhone(""); setReferral(""); announce(result.message); }
  };

  const google = async () => {
    setBusy("google");
    const result = await loginWithGoogle();
    if (!result.ok) { setBusy(""); setStatus({ tone: "error", text: result.message }); }
  };

  const fieldError = (key: string) => touched && errors[key] ? <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-600"><CircleAlert className="h-3 w-3" />{errors[key]}</p> : null;
  const inputClass = (key: string) => `h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-950 ${touched && errors[key] ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10" : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-slate-700"}`;

  const titles = {
    login: { title: "Welcome back", subtitle: "Log in to continue printing with PrintSathi" },
    signup: { title: "Create your account", subtitle: "Join thousands of CSC & cyber café operators" },
    forgot: { title: "Reset password", subtitle: "Enter your email and we'll send you a reset link" },
    "update-password": { title: "Set a new password", subtitle: "Choose a new password for your account" }
  }[mode];

  return <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={titles.title} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeAuth(); }}>
    <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 md:grid-cols-[0.9fr_1.1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-sky-500 via-indigo-600 to-violet-700 p-8 text-white md:flex md:flex-col">
        <div aria-hidden="true" className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30"><Printer className="h-5 w-5" /></span>
          <span className="text-lg font-extrabold tracking-tight">PrintSathi</span>
        </div>
        <h2 className="relative mt-10 font-serif text-3xl font-semibold leading-tight">All your print tools in one place.</h2>
        <ul className="relative mt-6 space-y-3 text-sm text-white/90">
          {["Aadhaar, PAN & Ayushman card crop", "Passport & postcard photo sheets", "Background removal in your browser", "Earn Print Coins with referrals"].map((item) => <li key={item} className="flex items-center gap-2.5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20"><Check className="h-3 w-3" /></span>{item}</li>)}
        </ul>
        <div className="relative mt-auto flex items-center gap-2 rounded-2xl bg-white/10 p-3 text-xs ring-1 ring-white/20"><ShieldCheck className="h-5 w-5 shrink-0" />Your photos are processed on your device and never uploaded.</div>
      </aside>

      {/* Form panel */}
      <section className="relative p-6 sm:p-8">
        <button type="button" aria-label="Close" disabled={!!busy} onClick={closeAuth} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        <div className="mb-5 flex items-center gap-2.5 md:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white"><Printer className="h-4 w-4" /></span><span className="font-extrabold">PrintSathi</span></div>

        {mode === "forgot" && <button type="button" onClick={() => setMode("login")} className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Back to login</button>}
        <h3 className="font-serif text-2xl font-semibold tracking-tight">{titles.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{titles.subtitle}</p>

        {(mode === "login" || mode === "signup") && <div role="tablist" className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["login", "signup"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} className={`h-9 rounded-lg text-sm font-semibold transition ${mode === item ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>{item === "login" ? "Log in" : "Sign up"}</button>)}
        </div>}

        {(mode === "login" || mode === "signup") && <>
          <button type="button" disabled={!!busy} onClick={() => void google()} className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
            {busy === "google" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <GoogleIcon />}Continue with Google
          </button>
          <div className="my-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or with email<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
        </>}

        <form noValidate onSubmit={(event) => void submit(event)} className={`space-y-3 ${mode === "forgot" || mode === "update-password" ? "mt-5" : ""}`}>
          {mode === "signup" && <div>
            <Field icon={<User />}><input ref={firstFieldRef} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className={inputClass("name")} /></Field>
            {fieldError("name")}
          </div>}
          {mode !== "update-password" && <div>
            <Field icon={<Mail />}><input ref={mode === "signup" ? undefined : firstFieldRef} type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className={inputClass("email")} /></Field>
            {fieldError("email")}
          </div>}
          {mode === "signup" && <div>
            <Field icon={<Phone />}><input type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="Mobile number (optional)" className={inputClass("phone")} /></Field>
            {fieldError("phone")}
          </div>}
          {mode !== "forgot" && <div>
            <Field icon={<Lock />}>
              <input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" || mode === "update-password" ? "Create password (min 8 characters)" : "Password"} className={`${inputClass("password")} pr-10`} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </Field>
            {fieldError("password")}
            {(mode === "signup" || mode === "update-password") && password && <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < strength ? strengthColor[strength] : "bg-slate-200 dark:bg-slate-700"}`} />)}</div>
              <span className="text-[10px] font-semibold text-slate-500">{strengthLabel[strength]}</span>
            </div>}
          </div>}
          {(mode === "signup" || mode === "update-password") && <div>
            <Field icon={<Lock />}><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm password" className={inputClass("confirm")} /></Field>
            {fieldError("confirm")}
          </div>}

          {mode === "signup" && (showReferral
            ? <Field icon={<Gift />}><input value={referral} onChange={(event) => setReferral(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={12} placeholder="Referral code (e.g. PS8X2K)" className={`${inputClass("referral")} font-mono uppercase tracking-wider`} /></Field>
            : <button type="button" onClick={() => setShowReferral(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline"><Gift className="h-3.5 w-3.5" />Have a referral code? Get 10 free Print Coins</button>)}

          {mode === "login" && <div className="flex justify-end"><button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Forgot password?</button></div>}

          {mode === "signup" && <div>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-indigo-600" />
              <span>I agree to the <a href="/app/support" className="font-semibold text-slate-700 hover:underline dark:text-slate-200">Terms</a> and <a href="/app/support" className="font-semibold text-slate-700 hover:underline dark:text-slate-200">Privacy Policy</a></span>
            </label>
            {fieldError("agree")}
          </div>}

          {status && <div role="alert" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${status.tone === "error" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"}`}>{status.tone === "error" ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}{status.text}</div>}

          <button type="submit" disabled={!!busy} className="relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-70">
            {busy === "form" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : mode === "signup" ? <Sparkles className="h-4 w-4" /> : null}
            {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : mode === "update-password" ? "Save new password" : "Send reset link"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          {mode === "login" ? <>New to PrintSathi? <button type="button" onClick={() => setMode("signup")} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Create an account</button></>
            : mode === "signup" ? <>Already have an account? <button type="button" onClick={() => setMode("login")} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Log in</button></>
            : mode === "update-password" ? null : <>Remembered it? <button type="button" onClick={() => setMode("login")} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Back to login</button></>}
        </p>
      </section>
    </div>
  </div>;
}

/** Small global toast after login/signup (modal is already closed by then). */
function announce(text: string) {
  const element = document.createElement("div");
  element.setAttribute("role", "status");
  element.textContent = text;
  element.className = "fixed left-1/2 top-4 z-[140] -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-xl";
  document.body.appendChild(element);
  window.setTimeout(() => element.remove(), 3200);
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{children}</div>;
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
  </svg>;
}
