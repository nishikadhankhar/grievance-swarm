"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell, Field, input } from "@/components/auth";
import { useRole, type SignUpBody } from "@/components/RoleProvider";
import { Button, ErrorNote, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { HOME } from "@/lib/roles";
import type { Place } from "@/lib/types";

type Kind = "student" | "staff";

export default function SignUpPage() {
  const { signUp } = useRole();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("student");
  const [hostels, setHostels] = useState<Place[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    hostel: "",
    name: "",
    role: "technician" as NonNullable<SignUpBody["role"]>,
    department: "electricity",
    staff_code: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set =
    (k: keyof typeof form) => (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api<Place[]>("/places")
      .then((ps) => setHostels(ps.filter((p) => p.type === "hostel")))
      .catch(() => setError("Can't reach the server. Is the backend running?"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: SignUpBody =
      kind === "student"
        ? { kind, email: form.email, password: form.password, hostel: form.hostel }
        : {
            kind,
            email: form.email,
            password: form.password,
            name: form.name,
            role: form.role,
            department: form.role === "technician" ? form.department : undefined,
            staff_code: form.staff_code,
          };
    try {
      const me = await signUp(body);
      router.replace(HOME[me.role]);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create an account"
      sub={
        kind === "student"
          ? "Students appear only as a pseudonym like S-1201. Your email is used to sign in, nothing else."
          : "Staff need the staff code from the warden's office."
      }
    >
      {/* Student / Staff Tab Switcher */}
      <div
        className="mb-5 flex rounded-xl border border-gray-200 bg-gray-50 p-1"
        role="tablist"
        aria-label="Account Type"
      >
        {(["student", "staff"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              "flex-1 min-h-[40px] rounded-lg py-2 text-sm font-semibold transition-all",
              kind === k
                ? "bg-orange-500 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            {k === "student" ? "Student" : "Staff"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Email field */}
        <Field label="Email" htmlFor="signup-email">
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set("email")}
            placeholder="you@campus.edu"
            className={input}
          />
        </Field>

        {/* Password field with show/hide toggle */}
        <Field label="Password (at least 8 characters)" htmlFor="signup-password">
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={set("password")}
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

        {/* Student Specific Fields */}
        {kind === "student" ? (
          <Field label="Hostel" htmlFor="signup-hostel">
            <select
              id="signup-hostel"
              required
              value={form.hostel}
              onChange={set("hostel")}
              className={input}
            >
              <option value="" disabled>
                Pick your hostel
              </option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          /* Staff Specific Fields */
          <>
            <Field label="Name shown to students" htmlFor="signup-name">
              <input
                id="signup-name"
                required
                maxLength={48}
                placeholder="e.g. Ravi (Water)"
                value={form.name}
                onChange={set("name")}
                className={input}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Role" htmlFor="signup-role">
                <select
                  id="signup-role"
                  value={form.role}
                  onChange={set("role")}
                  className={input}
                >
                  <option value="technician">Technician</option>
                  <option value="warden">Warden</option>
                  <option value="dean">Dean</option>
                </select>
              </Field>

              {form.role === "technician" && (
                <Field label="Department" htmlFor="signup-department">
                  <select
                    id="signup-department"
                    value={form.department}
                    onChange={set("department")}
                    className={input}
                  >
                    <option value="electricity">Electricity</option>
                    <option value="wifi">Wi-Fi</option>
                    <option value="water">Water</option>
                  </select>
                </Field>
              )}
            </div>

            <Field label="Staff code" htmlFor="signup-staff-code">
              <input
                id="signup-staff-code"
                required
                value={form.staff_code}
                onChange={set("staff_code")}
                placeholder="campus-staff"
                className={input}
              />
            </Field>
          </>
        )}

        {/* Inline error note */}
        <ErrorNote error={error} />

        {/* Full-width submit button with loading state */}
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
              Creating account…
            </span>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      {/* Sign in link */}
      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="font-semibold text-orange-600 hover:text-orange-700 transition"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
