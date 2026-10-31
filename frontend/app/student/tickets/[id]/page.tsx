"use client";

import { EtaCard, TicketHeader, TicketTimeline, useTicket } from "@/components/ticket";
import { useRole } from "@/components/RoleProvider";
import { Card, ErrorNote } from "@/components/ui";

export default function TicketPage({ params }: { params: { id: string } }) {
  const { detail, error } = useTicket(params.id);
  const { userId } = useRole();

  if (error) return <div className="p-8"><ErrorNote error={error} /></div>;
  if (!detail) return <div className="p-8 text-sm text-gray-500">Loading {params.id}…</div>;
  const { ticket, events, reporters } = detail;
  const mine = reporters.includes(userId);

  return (
    <div className="space-y-6 px-4 pb-16 pt-10 sm:px-16">
      <TicketHeader ticket={ticket} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <EtaCard ticket={ticket} />
          <Card className="p-7">
            <h2 className="mb-5 text-lg font-semibold">What happened so far</h2>
            <TicketTimeline events={events} ticket={ticket} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="space-y-3 p-6">
            <h2 className="text-base font-semibold">{mine ? "Your report" : "Reports"}</h2>
            <dl className="space-y-2 text-[13px]">
              {[
                ["Reported by", mine ? userId : reporters[0] ?? "—"],
                ["Also affected", `${Math.max(ticket.report_count - 1, 0)} students`],
                ["Location", ticket.place.name],
                ["Ticket", ticket.id],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
            <p className="text-sm font-semibold text-orange-700">You do not need to do anything</p>
            <p className="mt-1 text-[13px] text-orange-700">This page updates live as agents and staff act.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
