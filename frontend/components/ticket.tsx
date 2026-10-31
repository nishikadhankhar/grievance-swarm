"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { etaLabel, hhmm } from "@/lib/format";
import type { MekoRef, Ticket, TicketDetail, TicketEvent } from "@/lib/types";
import { useEvents } from "@/lib/ws";
import { useRole } from "./RoleProvider";
import { ActorBadge, CategoryChip, Card, STATUS_LABEL, SimulatedBadge, StatusPill, cx } from "./ui";

const STEPS = ["reported", "assigned", "in_progress", "resolved"] as const;

/** Loads a ticket and keeps it live from ticket.updated events. */
export function useTicket(id: string | null) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    setError(null);
    api<TicketDetail>(`/tickets/${id}`).then(setDetail).catch((e: Error) => setError(e.message));
  }, [id]);

  useEvents((e) => {
    if (e.type !== "ticket.updated" || e.data.ticket.id !== id) return;
    setDetail((d) =>
      d && {
        ...d,
        ticket: e.data.ticket,
        events: d.events.some((x) => x.id === e.data.event.id) ? d.events : [...d.events, e.data.event],
      },
    );
  });

  return { detail, error, setDetail };
}

export function StatusStepper({ status }: { status: Ticket["status"] }) {
  const cur = STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-2.5">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2.5">
          <span
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold",
              i === cur ? (s === "resolved" ? "bg-green-600 text-white" : "bg-orange-500 text-white") : i < cur ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-500",
            )}
          >
            {STATUS_LABEL[s]}
          </span>
          {i < STEPS.length - 1 && <span className="text-gray-400">→</span>}
        </li>
      ))}
    </ol>
  );
}

export function TicketHeader({ ticket }: { ticket: Ticket }) {
  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-500">{ticket.id}</span>
        <CategoryChip category={ticket.category} />
        <span className="text-sm font-medium text-gray-500">{ticket.place.name}</span>
        <span className="text-sm text-gray-400">·</span>
        <span className="text-sm text-gray-500">{ticket.report_count} reports</span>
        <span className="flex-1" />
        <StatusPill status={ticket.status} />
      </div>
      <h1 className="text-[26px] font-bold leading-tight">{ticket.title}</h1>
      <StatusStepper status={ticket.status} />
    </Card>
  );
}

export function EtaCard({ ticket }: { ticket: Ticket }) {
  const { settings } = useRole();
  const resolved = ticket.status === "resolved";
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-7">
      <div>
        <div className="text-[13px] font-semibold uppercase tracking-wide text-orange-700">{resolved ? "Resolved at" : "ETA"}</div>
        <div className="text-[56px] font-bold leading-none text-orange-500 sm:text-[64px]">
          {resolved ? hhmm(ticket.closed_at) : etaLabel(ticket.eta, settings?.now)}
        </div>
      </div>
      <div className="min-w-[220px] flex-1">
        <p className="text-[22px] font-semibold leading-snug">
          {resolved ? "Fixed. Thanks for reporting." : ticket.eta_reason ?? "On track"}
        </p>
        <p className="mt-1.5 text-sm text-gray-500">
          {resolved ? `ETA was ${etaLabel(ticket.eta, settings?.now)}` : ticket.assignee ? `Assigned to ${ticket.assignee.name}` : "Waiting for assignment"}
        </p>
      </div>
    </div>
  );
}

/** Shows only what Meko returned; hover reveals the raw recall and its call ID (B5). */
export function ContextChip({ meko }: { meko: MekoRef }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className={cx(
          "inline-flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium outline-none",
          meko.skipped ? "border-gray-300 bg-gray-50 text-gray-500" : "border-orange-500 bg-orange-50 text-orange-700",
        )}
      >
        <span className={cx("h-1.5 w-1.5 rounded-full", meko.skipped ? "bg-gray-400" : "bg-orange-500")} />
        {meko.skipped ? "Meko OFF" : "Meko context"}
      </span>
      <span className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-80 rounded-xl bg-gray-900 p-3.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-orange-300">
          {meko.op} · {meko.datapack}
        </span>
        {meko.skipped ? (
          <span className="mt-1 block text-gray-300">Meko was OFF, so nothing was read or stored.</span>
        ) : meko.recalled.length ? (
          <span className="mt-1.5 block space-y-1.5">
            {meko.recalled.map((r, i) => (
              <span key={i} className="block leading-snug">“{r}”</span>
            ))}
          </span>
        ) : (
          <span className="mt-1 block text-gray-300">{meko.op === "recall" ? "Recall returned nothing." : "Written to Meko."}</span>
        )}
        <span className="mt-2 block font-mono text-[11px] text-gray-400">call_id {meko.call_id}</span>
      </span>
    </span>
  );
}

function Dot({ state }: { state: "done" | "current" | "pending" }) {
  return (
    <span
      className={cx(
        "mt-1 h-3.5 w-3.5 shrink-0 rounded-full",
        state === "done" && "bg-orange-500",
        state === "current" && "border-4 border-orange-500 bg-white",
        state === "pending" && "bg-gray-300",
      )}
    />
  );
}

export function TicketTimeline({ events, ticket, compact }: { events: TicketEvent[]; ticket: Ticket; compact?: boolean }) {
  const resolved = ticket.status === "resolved";
  return (
    <ol>
      {events.map((e, i) => {
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="flex gap-4">
            <div className="flex flex-col items-center gap-1">
              <Dot state={last && !resolved ? "current" : "done"} />
              {(!last || !resolved) && <span className="w-0.5 flex-1 bg-orange-200" />}
            </div>
            <div className={cx("min-w-0 flex-1 space-y-1.5", compact ? "pb-4" : "pb-6")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">{hhmm(e.at)}</span>
                <ActorBadge type={e.actor_type} />
                <span className="text-sm font-semibold">{e.actor_name}</span>
                {e.simulated && <SimulatedBadge />}
              </div>
              <p className={cx("font-medium", compact ? "text-sm" : "text-[15px]")}>{e.action}</p>
              {e.reason && <p className="text-[13px] text-gray-500">Why: {e.reason}</p>}
              {e.meko && <ContextChip meko={e.meko} />}
            </div>
          </li>
        );
      })}
      {!resolved && (
        <li className="flex gap-4">
          <Dot state="pending" />
          <p className="text-[15px] text-gray-400">Next: technician fixes it and closes the ticket</p>
        </li>
      )}
    </ol>
  );
}
