export const CATEGORY_LABEL: Record<string, string> = {
  wifi: "Wi-Fi",
  electricity: "Electrical",
  water: "Water",
  other: "Other",
};

export const CATEGORY_STYLE: Record<string, string> = {
  wifi: "bg-blue-50 text-blue-700",
  electricity: "bg-amber-100 text-amber-800",
  water: "bg-sky-100 text-sky-700",
  other: "bg-gray-100 text-gray-600",
};

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "22:30" today, "12 Apr 22:30" on any other day. */
export function stamp(iso: string | null | undefined, now?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ref = now ? new Date(now) : new Date();
  if (d.toDateString() === ref.toDateString()) return hhmm(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${hhmm(iso)}`;
}

/** "22:30" today, "Thu 18:00" on another day. `now` is the backend's (fast-forwardable) clock. */
export function etaLabel(iso: string | null, now?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ref = now ? new Date(now) : new Date();
  if (d.toDateString() === ref.toDateString()) return hhmm(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${hhmm(iso)}`;
}
