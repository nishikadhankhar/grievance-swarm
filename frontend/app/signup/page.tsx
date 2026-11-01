"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell, Field, input } from "@/components/auth";
import { useRole, type SignUpBody } from "@/components/RoleProvider";
import { Button, Card, ErrorNote, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { HOME } from "@/lib/roles";
import type { Place } from "@/lib/types";

type Kind = "student" | "staff";

export default function SignUpPage() {
  const { signUp } = useRole();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("student");
  const [hostels, setHostels] = useState<Place[]>([]);
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
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
      sub={kind === "student" ? "Students appear only as a pseudonym like S-1201. Your email is used to sign in, nothing else." : "Staff need the staff code from the warden's office."}
    >
      <Card className="space-y-4 p-6">
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-[3px]" role="tablist">
          {(["student", "staff"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cx("flex-1 rounded-[9px] py-1.5 text-[13px] font-medium", kind === k ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-900")}
            >
              {k === "student" ? "Student" : "Staff"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input type="email" autoComplete="email" required value={form.email} onChange={set("email")} className={input} />
          </Field>
          <Field label="Password (at least 8 characters)">
            <input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} className={input} />
          </Field>
          {kind === "student" ? (
            <Field label="Hostel">
              <select required value={form.hostel} onChange={set("hostel")} className={input}>
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
            <>
              <Field label="Name shown to students">
                <input required maxLength={48} placeholder="e.g. Ravi (Water)" value={form.name} onChange={set("name")} className={input} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role">
                  <select value={form.role} onChange={set("role")} className={input}>
                    <option value="technician">Technician</option>
                    <option value="warden">Warden</option>
                    <option value="dean">Dean</option>
                  </select>
                </Field>
                {form.role === "technician" && (
                  <Field label="Department">
                    <select value={form.department} onChange={set("department")} className={input}>
                      <option value="electricity">Electricity</option>
                      <option value="wifi">Wi-Fi</option>
                      <option value="water">Water</option>
                    </select>
                  </Field>
                )}
              </div>
              <Field label="Staff code">
                <input required value={form.staff_code} onChange={set("staff_code")} className={input} />
              </Field>
            </>
          )}
          <ErrorNote error={error} />
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-orange-700">
            Sign in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
