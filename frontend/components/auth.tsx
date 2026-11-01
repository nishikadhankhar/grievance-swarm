import type { ReactNode } from "react";

export const input = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-500";

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-gray-50 px-4 py-12 sm:py-20">
      <div className="w-full max-w-[440px] space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-orange-500 text-base font-bold text-white">G</span>
          <span className="text-base font-semibold">Campus Grievance Swarm</span>
        </div>
        <div>
          <h1 className="text-[28px] font-bold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{sub}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
