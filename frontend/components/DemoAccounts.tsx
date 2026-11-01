"use client";

import { useState } from "react";
import { ROLE_LABEL, hostelName } from "@/lib/roles";
import type { Me } from "@/lib/types";

interface DemoAccountsProps {
  accounts: Me[];
  password: string | null;
  busy: boolean;
  onSelect: (email: string, password: string) => void;
}

const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";

export function DemoAccounts({ accounts, password, busy, onSelect }: DemoAccountsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!SHOW_DEMO_ACCOUNTS || !accounts || accounts.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-orange-500/20 rounded-lg"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Demo accounts</span>
          <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 tracking-wide uppercase">
            Demo mode
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 pt-1 border-t border-gray-200/60">
          <p className="text-xs text-gray-500">
            One click to sign in. Password for all:{" "}
            <span className="font-mono font-medium text-gray-700">{password || "demo1234"}</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {accounts.map((a: Me) => {
              const subtitle = a.hostel
                ? hostelName(a.hostel)
                : a.department
                ? a.department.charAt(0).toUpperCase() + a.department.slice(1)
                : ROLE_LABEL[a.role] || a.role;

              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(a.email ?? "", password ?? "demo1234")}
                  className="group flex min-h-[44px] flex-col justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-orange-500 hover:bg-orange-50/30 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50"
                >
                  <span className="block text-[13px] font-semibold text-gray-900 group-hover:text-orange-600 truncate">
                    {a.name}
                  </span>
                  <span className="block text-xs text-gray-500 truncate">
                    {subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

