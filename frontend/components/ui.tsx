import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CATEGORY_LABEL, CATEGORY_STYLE } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-gray-200 bg-white", className)}>{children}</div>;
}

type Variant = "primary" | "outline" | "accentOutline" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-orange-500 text-white hover:bg-orange-600 disabled:bg-orange-300",
  outline: "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:text-gray-400",
  accentOutline: "border border-orange-500 bg-white text-orange-700 hover:bg-orange-50",
  ghost: "text-gray-600 hover:bg-gray-100",
};

export function Button({ variant = "primary", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Chip({ className, children, dot }: { className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function CategoryChip({ category }: { category: string }) {
  return <Chip className={CATEGORY_STYLE[category] ?? CATEGORY_STYLE.other}>{CATEGORY_LABEL[category] ?? category}</Chip>;
}

export function ActorBadge({ type }: { type: "person" | "agent" }) {
  return type === "agent" ? (
    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white">Agent</span>
  ) : (
    <span className="rounded-full border border-gray-900 px-2 py-0.5 text-[11px] font-semibold text-gray-900">Person</span>
  );
}

export function SimulatedBadge() {
  return (
    <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white">SIMULATED</span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  reported: "bg-gray-100 text-gray-600",
  assigned: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  in_progress: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  resolved: "bg-green-50 text-green-700 ring-1 ring-green-200",
};
export const STATUS_LABEL: Record<string, string> = {
  reported: "Reported",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <Chip dot className={STATUS_STYLE[status]}>
      {STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="flex-1 leading-snug">{error}</span>
    </div>
  );
}

export function PageHeading({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">{children}</div>;
}
