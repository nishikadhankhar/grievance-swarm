"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { etaLabel } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import { useRole } from "./RoleProvider";
import { ContextChip, TicketTimeline, useTicket } from "./ticket";
import { Button, Card, CategoryChip, ErrorNote, StatusPill } from "./ui";

/** Staff view of one ticket: timeline, add note, accept / override / close. */
export function TicketPanel({ id, onChanged }: { id: string; onChanged?: (t: Ticket) => void }) {
  const { detail, error } = useTicket(id);
  const { role, settings } = useRole();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const staff = role === "technician" || role === "warden";

  async function run(kind: string, path: string, body: object) {
    setBusy(kind);
    setActionError(null);
    try {
      const t = await api<Ticket>(path, body);
      setNote("");
      onChanged?.(t);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Card className="p-6"><ErrorNote error={error} /></Card>;
  if (!detail) return <Card className="p-6 text-sm text-gray-500">Loading {id}…</Card>;
  const { ticket, events } = detail;
  const resolved = ticket.status === "resolved";
  const suggestion = events.find((e) => e.meko_call_id && e.meko_call_id === ticket.suggestion_call_id)?.meko;

  return (
    <Card className="space-y-5 p-6">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] font-semibold text-gray-500">{ticket.id}</span>
          <CategoryChip category={ticket.category} />
          <StatusPill status={ticket.status} />
        </div>
        <h2 className="text-xl font-bold">{ticket.title}</h2>
        <p className="text-[13px] text-gray-500">
          {ticket.place.name} · {ticket.report_count} reports · ETA {etaLabel(ticket.eta, settings?.now)}
          {ticket.eta_reason && ` — ${ticket.eta_reason}`}
        </p>
      </div>

      {ticket.suggestion && (
        <div className="space-y-2 rounded-xl bg-orange-50 p-3.5">
          <p className="text-[13px] font-medium text-orange-700">
            <span className="mr-2 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white">Agent</span>
            {ticket.suggestion}
          </p>
          {suggestion && <ContextChip meko={suggestion} />}
        </div>
      )}

      <div className="max-h-[420px] overflow-y-auto pr-1">
        <TicketTimeline events={events} ticket={ticket} compact />
      </div>

      {!resolved && staff && (
        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="text-[13px] font-medium text-gray-500">Add note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What you found or did, e.g. “Router needs a new PSU, part arrives Thursday”"
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-sm outline-none focus:border-orange-400 focus:bg-white"
            />
          </label>
          <ErrorNote error={actionError} />
          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => run("accept", `/tickets/${id}/decision`, { action: "accept", note: note || null })}
              disabled={!!busy}
            >
              {busy === "accept" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                note.trim()
                  ? run("override", `/tickets/${id}/decision`, { action: "override", note })
                  : setActionError("Write a note saying why you are overriding the suggestion")
              }
              disabled={!!busy}
            >
              Override
            </Button>
            <Button
              variant="outline"
              onClick={() => run("close", `/tickets/${id}/decision`, { action: "close", note: note || null })}
              disabled={!!busy}
              title="The note becomes the fix the Curator learns from"
            >
              Close
            </Button>
            <span className="flex-1" />
            <Button
              variant="ghost"
              onClick={() => run("note", `/tickets/${id}/notes`, { text: note })}
              disabled={!!busy || note.trim().length < 2}
            >
              {busy === "note" ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>
      )}
      {!staff && <p className="text-xs text-gray-500">Switch to Technician or Warden to act on this ticket.</p>}
    </Card>
  );
}
