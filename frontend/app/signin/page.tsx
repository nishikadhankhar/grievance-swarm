"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthShell, Field, input } from "@/components/auth";
import { useRole } from "@/components/RoleProvider";
import { useDemoAccounts } from "@/components/TopBar";
import { Button, Card, ErrorNote } from "@/components/ui";
import { HOME, ROLE_LABEL, hostelName } from "@/lib/roles";
import type { Me } from "@/lib/types";

function SignInForm() {
  const { signIn } = useRole();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const demo = useDemoAccounts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <AuthShell title="Sign in" sub="Students and campus staff use the same sign-in.">
      <Card className="space-y-4 p-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </Field>
          <Field label="Password">
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-gray-500">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-orange-700">
            Create an account
          </Link>
        </p>
      </Card>

      {demo && demo.accounts.length > 0 && (
        <Card className="space-y-3 p-6">
          <div>
            <h2 className="font-semibold">Demo accounts</h2>
            <p className="text-[13px] text-gray-500">One click to sign in. Password for all: {demo.password}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demo.accounts.map((a: Me) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => go(a.email ?? "", demo.password ?? "")}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:border-orange-500 disabled:opacity-50"
              >
                <span className="block text-[13px] font-semibold">{a.name}</span>
                <span className="block text-xs text-gray-500">
                  {ROLE_LABEL[a.role]}
                  {a.hostel ? ` · ${hostelName(a.hostel)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </Card>
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
