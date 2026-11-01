"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";

interface StudentSidebarProps {
  children: React.ReactNode;
}

export function StudentSidebar({ children }: StudentSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isReport = pathname === "/student/new";
  const isTickets = pathname.startsWith("/student/tickets");

  return (
    <div className="flex min-h-[calc(100vh-65px)] w-full bg-slate-50/50">
      {/* Desktop Left Sidebar */}
      <aside
        className={cx(
          "hidden md:flex flex-col justify-between border-r border-gray-200/80 bg-white transition-all duration-200 sticky top-[65px] h-[calc(100vh-65px)] z-20 select-none",
          collapsed ? "w-16 px-2 py-4" : "w-60 p-4"
        )}
      >
        <div className="space-y-4">
          {/* Collapse Toggle Header */}
          <div className="flex items-center justify-between pb-2">
            {!collapsed && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2.5">
                Student Portal
              </span>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors mx-auto"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cx("transition-transform duration-200", collapsed && "rotate-180")}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5" aria-label="Student Navigation">
            <Link
              href="/student/new"
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isReport
                  ? "bg-orange-50/90 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900",
                collapsed && "justify-center px-2"
              )}
              title="Report a problem"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isReport ? "2.2" : "1.8"}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isReport ? "text-orange-600" : "text-gray-500"}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {!collapsed && <span>Report a problem</span>}
            </Link>

            <Link
              href="/student/tickets"
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isTickets
                  ? "bg-orange-50/90 text-orange-700 font-semibold shadow-sm"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900",
                collapsed && "justify-center px-2"
              )}
              title="My tickets"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isTickets ? "2.2" : "1.8"}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isTickets ? "text-orange-600" : "text-gray-500"}
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              {!collapsed && <span>My tickets</span>}
            </Link>
          </nav>
        </div>

        {/* Bottom Pinned Controls (Help) */}
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-100/80 hover:text-gray-900 transition-colors",
              collapsed && "justify-center px-2"
            )}
            title="Help & Support"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {!collapsed && <span>Help & FAQ</span>}
          </button>

        </div>
      </aside>

      {/* Main Page Content */}
      <div className="flex-1 min-w-0 pb-20 md:pb-12">{children}</div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-gray-200 bg-white/95 backdrop-blur-md px-2 py-2"
        aria-label="Mobile Navigation"
      >
        <Link
          href="/student/new"
          className={cx(
            "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium",
            isReport ? "text-orange-600 font-semibold" : "text-gray-500"
          )}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Report</span>
        </Link>
        <Link
          href="/student/tickets"
          className={cx(
            "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium",
            isTickets ? "text-orange-600 font-semibold" : "text-gray-500"
          )}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>My tickets</span>
        </Link>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Help</span>
        </button>
      </nav>

      {/* Help Modal */}
      {showHelp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Student Grievance Help</h3>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-700 rounded-lg p-1"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3.5 text-xs text-gray-600 leading-relaxed">
              <p>
                <strong>How it works:</strong> Type your issue naturally. Our AI Desk Agent dedupes multiple complaints across rooms so technicians receive one master ticket instead of 15 duplicates.
              </p>
              <p>
                <strong>Privacy:</strong> We automatically redact phone numbers, roll numbers, and names before anything is saved to memory. You post under your student pseudonym.
              </p>
              <p>
                <strong>Live Updates:</strong> Once submitted, your ticket page updates in real-time as technicians accept, inspect, and complete repairs.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

