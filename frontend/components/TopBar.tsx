"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { LOCAL_MEKO_BADGE } from "@/lib/constants";
import { useSocketUp } from "@/lib/ws";
import { useRole } from "./RoleProvider";
import { cx } from "./ui";

const ROLES: { id: Role; label: string }[] = [
  { id: "student", label: "Student" },
  { id: "technician", label: "Technician" },
  { id: "warden", label: "Warden" },
  { id: "dean", label: "Dean" },
];

export const HOME: Record<Role, string> = {
  student: "/student/new",
  technician: "/staff/queue",
  warden: "/staff/queue",
  dean: "/dean",
};

const COMPARE = { label: "Meko ON vs OFF", href: "/compare" };
const TABS: Record<Role, { label: string; href: string }[]> = {
  student: [
    { label: "Report a problem", href: "/student/new" },
    { label: "My ticket", href: "/student/tickets" },
  ],
  technician: [{ label: "Queue", href: "/staff/queue" }, COMPARE],
  warden: [{ label: "Queue", href: "/staff/queue" }, { label: "Approvals", href: "/staff/approvals" }, COMPARE],
  dean: [{ label: "Patterns", href: "/dean" }, COMPARE],
};

export function MekoToggle() {
  const { settings, updateSettings } = useRole();
  const on = settings?.meko_enabled ?? true;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => updateSettings({ meko_enabled: !on })}
        disabled={!settings}
        className="flex items-center gap-2.5 text-[13px] font-medium"
        aria-pressed={on}
        title="Meko OFF really means off: agents run with no memory"
      >
        Meko
        <span className={cx("flex h-[22px] w-10 items-center rounded-full p-0.5 transition-colors", on ? "justify-end bg-orange-500" : "justify-start bg-gray-300")}>
          <span className="h-[18px] w-[18px] rounded-full bg-white shadow-sm" />
        </span>
        <span className={cx("w-7 text-xs font-semibold", on ? "text-orange-500" : "text-gray-500")}>{on ? "ON" : "OFF"}</span>
      </button>
      <span
        className="hidden xl:inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
        title="Running on local SQLite keyword stand-in (offline mode)"
      >
        {LOCAL_MEKO_BADGE}
      </span>
    </div>
  );
}

export function TopBar() {
  const { role, setRole } = useRole();
  const router = useRouter();
  const path = usePathname();
  const live = useSocketUp();
  const onSwarm = path.startsWith("/swarm");

  return (
    <header className="sticky top-0 z-30 bg-white">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 sm:px-8">
        <Link href={HOME[role]} className="flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-orange-500 text-base font-bold text-white">G</span>
          <span className="text-base font-semibold">Campus Grievance Swarm</span>
        </Link>
        <span
          className={cx("flex items-center gap-1.5 text-xs", live ? "text-green-700" : "text-gray-400")}
          title={live ? "Live updates connected" : "Not connected to the backend"}
        >
          <span className={cx("h-2 w-2 rounded-full", live ? "bg-green-500" : "bg-gray-300")} />
          {live ? "Live" : "Offline"}
        </span>
        <div className="flex-1" />
        <nav className="flex rounded-xl border border-gray-200 bg-gray-50 p-[3px]" aria-label="Role">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRole(r.id);
                router.push(HOME[r.id]);
              }}
              className={cx("rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium", r.id === role ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-900")}
            >
              {r.label}
            </button>
          ))}
        </nav>
        <MekoToggle />
        <Link
          href="/swarm"
          className={cx("rounded-xl px-[18px] py-[9px] text-sm font-semibold", onSwarm ? "bg-orange-500 text-white" : "border border-orange-500 text-orange-700 hover:bg-orange-50")}
        >
          Swarm
        </Link>
        <Link href="/settings" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Demo settings" aria-label="Demo settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </Link>
      </div>
      {role !== "student" && (
        <nav className="flex gap-7 overflow-x-auto border-b border-gray-200 px-4 sm:px-8" aria-label="Screens">
          {TABS[role].map((t) => {
            const active = !onSwarm && path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cx("whitespace-nowrap border-b-2 py-3 text-sm", active ? "border-orange-500 font-semibold text-orange-700" : "border-transparent font-medium text-gray-500 hover:text-gray-900")}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
