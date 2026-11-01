"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export const input =
  "w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export function BrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden rounded-3xl m-3 lg:m-4 p-10 lg:p-12 bg-gradient-to-br from-orange-400 via-orange-500 to-amber-500 text-white shadow-sm select-none">
      {/* Background soft decorative shapes and ambient blur */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-96 w-96 rounded-full bg-yellow-200/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 h-64 w-64 -translate-y-1/2 rounded-full bg-white/15 blur-2xl" />

      {/* Decorative dot matrix pattern */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-15"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="brand-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#brand-dots)" />
      </svg>

      {/* Top Brand Tag */}
      <div className="relative z-10 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-md text-xs font-bold text-white shadow-sm">
          S
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-orange-100/90">
          Campus Swarm
        </span>
      </div>

      {/* Middle & Lower-Left Content */}
      <div className="relative z-10 my-auto py-12 space-y-4">
        <h2 className="text-6xl lg:text-7xl font-extrabold tracking-tight text-white drop-shadow-sm">
          Sahayak
        </h2>
        <p className="text-xl lg:text-2xl font-medium italic text-orange-50 leading-snug">
          “Every complaint heard once. Every fix remembered forever.”
        </p>
        <p className="text-sm lg:text-base text-orange-100/80 font-normal">
          Smarter campus repairs, powered by shared memory.
        </p>
      </div>

      {/* Bottom Glass Chips */}
      <div className="relative z-10 flex flex-wrap gap-2.5 pt-4">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md shadow-sm">
          One ticket, not fifteen
        </span>
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md shadow-sm">
          Fixed on visit one
        </span>
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-md shadow-sm">
          Your identity stays private
        </span>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7f5] p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-[1100px] overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-2xl shadow-stone-900/5 transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column (Form) */}
          <div className="flex flex-col justify-between overflow-y-auto max-h-[92vh] lg:max-h-[740px] p-6 sm:p-10 lg:p-12">
            <div className="space-y-6">
              {/* Logo & Brand Header */}
              <Link href="/" className="inline-flex items-center gap-2.5 group">
                <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-orange-500 text-base font-bold text-white shadow-sm transition group-hover:bg-orange-600">
                  S
                </span>
                <span className="text-base font-bold tracking-tight text-gray-900">
                  Sahayak
                </span>
              </Link>

              {/* Heading and Subtitle */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  {title}
                </h1>
                <p className="mt-1 text-sm text-gray-500 leading-normal">{sub}</p>
              </div>

              {/* Form & Children content */}
              <div className="pt-1">{children}</div>
            </div>
          </div>

          {/* Right Column (Visual Brand Panel) */}
          <BrandPanel />
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  rightLabel,
  children,
}: {
  label: string;
  htmlFor?: string;
  rightLabel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-gray-700">
          {label}
        </label>
        {rightLabel}
      </div>
      {children}
    </div>
  );
}
