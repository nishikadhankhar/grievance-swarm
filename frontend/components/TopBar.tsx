"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { LOCAL_MEKO_BADGE } from "@/lib/constants";
import { HOME, ROLE_LABEL } from "@/lib/roles";
import type { Me, Role } from "@/lib/types";
import { useSocketUp } from "@/lib/ws";
import { AUTH_PAGES, useRole } from "./RoleProvider";
import { cx } from "./ui";

export { HOME };

interface DemoAccounts {
  password: string | null;
  accounts: Me[];
}

export function useDemoAccounts(): DemoAccounts | null {
  const [demo, setDemo] = useState<DemoAccounts | null>(null);
  useEffect(() => {
    api<DemoAccounts>("/auth/demo-accounts").then(setDemo).catch(() => setDemo(null));
  }, []);
  return demo;
}

function AccountMenu() {
  const { user, signIn, signOut } = useRole();
  const router = useRouter();
  const demo = useDemoAccounts();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!user) return null;
  const others = demo?.accounts.filter((a) => a.id !== user.id) ?? [];

  async function switchTo(a: Me) {
    setOpen(false);
    const me = await signIn(a.email ?? "", demo?.password ?? "");
    router.push(HOME[me.role]);
  }

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-1.5 pr-3 text-[13px] font-medium hover:border-gray-300"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-xs font-bold text-white">
          {user.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}
        </span>
        <span className="max-w-[160px] truncate">{user.name}</span>
        <span className="text-gray-500">· {ROLE_LABEL[user.role]}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg" role="menu">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          {others.length > 0 && (
            <>
              <p className="border-t border-gray-100 px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Switch demo account</p>
              {others.map((a) => (
                <button key={a.id} onClick={() => switchTo(a)} className="flex w-full items-center rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-gray-50" role="menuitem">
                  <span className="flex-1">{a.name}</span>
                  <span className="text-xs text-gray-500">{ROLE_LABEL[a.role as Role]}</span>
                </button>
              ))}
            </>
          )}
          <button onClick={signOut} className="mt-1 w-full rounded-lg border-t border-gray-100 px-3 py-2 text-left text-[13px] font-medium text-red-700 hover:bg-red-50" role="menuitem">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

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
  const { role, user } = useRole();
  const path = usePathname();
  const live = useSocketUp();
  const onSwarm = path.startsWith("/swarm");
  if (!user || AUTH_PAGES.some((p) => path.startsWith(p))) return null;

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
        <MekoToggle />
        <Link
          href="/swarm"
          className={cx("rounded-xl px-[18px] py-[9px] text-sm font-semibold", onSwarm ? "bg-orange-500 text-white" : "border border-orange-500 text-orange-700 hover:bg-orange-50")}
        >
          Swarm
        </Link>
        <AccountMenu />
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
