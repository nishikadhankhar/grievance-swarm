"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { TicketPanel } from "@/components/TicketPanel";
import { CategoryChip, Chip, Empty, ErrorNote, PageHeading, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { etaLabel } from "@/lib/format";
import type { Ticket, User } from "@/lib/types";
import { useEvents } from "@/lib/ws";

export default function QueuePage() {
  const { role, userId, setUserId, settings } = useRole();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [techs, setTechs] = useState<User[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const staffRole = role === "warden" ? "warden" : "technician";
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(() => {
    const q = staffRole === "technician" ? `role=technician&user_id=${userId}` : "role=warden";
    api<Ticket[]>(`/staff/queue?${q}`)
      .then((ts) => {
        setTickets(ts);
        setSelected((s) => (s && ts.some((t) => t.id === s) ? s : ts[0]?.id ?? null));
      })
      .catch((e: Error) => setError(e.message));
  }, [staffRole, userId]);

  useEffect(load, [load]);
  useEffect(() => {
    api<User[]>("/users?role=technician").then(setTechs).catch(() => {});
  }, []);

  // Live: any ticket change refreshes the list (debounced so a burst of agent steps refetches once).
  useEvents((e) => {
    if (e.type !== "ticket.updated") return;
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(load, 300);
  });

  return (
    <div className="grid gap-6 px-4 pb-12 pt-8 sm:px-10 lg:grid-cols-[1fr_440px]">
      <div className="space-y-4">
        <PageHeading
          title="Queue"
          sub={tickets ? `${tickets.length} open tickets · sorted by reports, then ETA` : "Loading…"}
          right={
            role === "technician" && (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium"
                aria-label="Technician"
              >
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )
          }
        />
        {role !== "technician" && role !== "warden" && <p className="text-sm text-gray-500">Viewing as Warden. Switch role to Technician or Warden to act.</p>}
        <ErrorNote error={error} />
        {tickets?.length === 0 && <Empty>Nothing open. Nice.</Empty>}
        {tickets?.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={cx(
              "block w-full space-y-3 rounded-2xl border bg-white p-5 text-left transition-colors",
              t.id === selected ? "border-2 border-orange-500" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex-1 text-[17px] font-semibold">{t.title}</span>
              <Chip className="whitespace-nowrap border border-gray-200 bg-gray-50 text-gray-900">ETA {etaLabel(t.eta, settings?.now)}</Chip>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
              <span className="font-semibold text-gray-500">{t.id}</span>
              <CategoryChip category={t.category} />
              <span className="font-medium text-gray-500">{t.place.name}</span>
              <span className="text-gray-400">·</span>
              <span className="font-medium">{t.report_count} reports</span>
            </div>
            {t.suggestion ? (
              <p className="flex items-center gap-2.5 rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] font-medium text-orange-700">
                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white">Agent</span>
                <span className="flex-1">{t.suggestion}</span>
                {t.suggestion_call_id && <span className="font-mono text-[11px] text-orange-400">{t.suggestion_call_id}</span>}
              </p>
            ) : (
              t.eta_reason && <p className="text-[13px] text-gray-500">{t.eta_reason}</p>
            )}
          </button>
        ))}
      </div>
      <div className="lg:sticky lg:top-[120px] lg:self-start">
        {selected ? <TicketPanel key={selected} id={selected} onChanged={load} /> : <Empty>Select a ticket</Empty>}
      </div>
    </div>
  );
}
