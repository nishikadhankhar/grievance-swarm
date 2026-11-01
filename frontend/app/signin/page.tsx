"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthShell, Field, input } from "@/components/auth";
import { DemoAccounts } from "@/components/DemoAccounts";
import { useRole } from "@/components/RoleProvider";
import { useDemoAccounts } from "@/components/TopBar";
import { Button, ErrorNote } from "@/components/ui";
import { HOME } from "@/lib/roles";

function SignInForm() {
  const { signIn } = useRole();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const demo = useDemoAccounts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const me = await signIn(e, p);
      // Go back to the page that asked for sign-in, unless it belongs to another kind of account.
      const otherArea = me.role === "student" ? /^\/(staff|dean)/ : /^\/student/;
      router.replace(next && next !== "/" && !otherArea.test(next) ? next : HOME[me.role]);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go(email, password);
  }

  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in to report problems or manage campus repairs."
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Email field */}
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@campus.edu"
            className={input}
          />
        </Field>

        {/* Password field with Forgot password? link and Eye toggle */}
        <Field
          label="Password"
          htmlFor="password"
          rightLabel={
            <span
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 select-none cursor-not-allowed"
              title="Password reset is coming soon"
            >
              <span>Forgot password?</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                Soon
              </span>
            </span>
          }
        >
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${input} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              {showPassword ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
        </Field>

        {/* Inline error */}
        <ErrorNote error={error} />

        {/* Full-width primary button with loading state */}
        <Button
          type="submit"
          disabled={busy}
          className="w-full h-12 min-h-[48px] rounded-xl text-base font-semibold shadow-sm"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {/* New here? Create account link */}
      <p className="mt-5 text-center text-sm text-gray-500">
        New here?{" "}
        <Link
          href="/signup"
          className="font-semibold text-orange-600 hover:text-orange-700 transition"
        >
          Create an account
        </Link>
      </p>

      {/* Demo accounts collapsible section */}
      {demo && (
        <DemoAccounts
          accounts={demo.accounts}
          password={demo.password}
          busy={busy}
          onSelect={go}
        />
      )}
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
