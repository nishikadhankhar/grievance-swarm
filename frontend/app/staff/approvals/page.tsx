"use client";

import { useEffect, useRef, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { Button, Card, Chip, Empty, ErrorNote, PageHeading, SimulatedBadge, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Approval } from "@/lib/types";
import { useEvents } from "@/lib/ws";

interface KbItem {
  id: string;
  text: string;
  approved_by: string | null;
  category: string | null;
}

export default function ApprovalsPage() {
  const { role, userId, settings } = useRole();
  const [pending, setPending] = useState<Approval[] | null>(null);
  const [kb, setKb] = useState<KbItem[]>([]);
  const [leaving, setLeaving] = useState<Record<number, "approve" | "reject">>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deciding = useRef(new Set<number>());
  const isWarden = role === "warden";

  const loadKb = () =>
    api<{ items: KbItem[] }>("/kb?kind=lesson")
      .then((r) => setKb(r.items))
      .catch(() => {});

  useEffect(() => {
    api<Approval[]>("/approvals?status=pending").then(setPending).catch((e: Error) => setError(e.message));
    loadKb();
  }, [settings?.meko_enabled]);

  useEvents((e) => {
    if (e.type === "approval.created") setPending((p) => (p && !p.some((a) => a.id === e.data.id) ? [e.data, ...p] : p));
    // Decisions made on this screen animate out themselves; only drop ones decided elsewhere.
    if (e.type === "approval.decided" && !deciding.current.has(e.data.id)) setPending((p) => p?.filter((a) => a.id !== e.data.id) ?? p);
  });

  async function decide(a: Approval, decision: "approve" | "reject") {
    setError(null);
    deciding.current.add(a.id);
    try {
      await api(`/approvals/${a.id}`, { decision });
    } catch (e) {
      deciding.current.delete(a.id);
      setError((e as Error).message);
      return;
    }
    setLeaving((l) => ({ ...l, [a.id]: decision }));
    // Let the card slide out, then drop it and (if approved) slide the lesson into Campus Knowledge.
    setTimeout(() => {
      setPending((p) => p?.filter((x) => x.id !== a.id) ?? p);
      if (decision === "approve") {
        const text = a.payload.lesson ?? a.payload.pattern ?? "";
        setKb((k) => (k.some((x) => x.text === text) ? k : [{ id: `pending-${a.id}`, text, approved_by: userId, category: a.payload.category ?? null }, ...k]));
        setJustAdded(text);
        loadKb();
        setTimeout(() => setJustAdded((j) => (j === text ? null : j)), 6000);
      }
    }, 420);
  }

  return (
    <div className="grid gap-8 px-4 pb-12 pt-8 sm:px-10 lg:grid-cols-[1fr_440px]">
      <div className="space-y-4">
        <PageHeading title="Approvals" sub="Lessons proposed by the Curator agent. Nothing enters Campus Knowledge without your approval." />
        {!isWarden && <p className="text-sm text-gray-500">Only the Warden can approve or reject.</p>}
        <ErrorNote error={error} />
        {pending?.length === 0 && <Empty>No proposals waiting. Close a ticket with a fix note and the Curator will propose one.</Empty>}
        {pending?.map((a) => (
          <Card
            key={a.id}
            className={cx(
              "space-y-3.5 p-5 transition-all duration-400 ease-out",
              leaving[a.id] === "approve" && "translate-x-16 opacity-0",
              leaving[a.id] === "reject" && "-translate-y-2 scale-95 opacity-0",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white">Agent</span>
              <span className="font-semibold">{a.proposed_by_agent === "pattern" ? "Pattern agent" : "Curator"}</span>
              <span className="text-gray-500">· {a.kind}{a.ticket_id && ` from ${a.ticket_id}`}</span>
              {a.simulated && <SimulatedBadge />}
            </div>
            <p className="text-xl font-semibold leading-snug">{a.kind === "lesson" ? "Lesson: " : "Pattern: "}{a.payload.lesson ?? a.payload.pattern}</p>
            {a.payload.evidence && <p className="text-[13px] text-gray-500">Evidence: {a.payload.evidence}</p>}
            <div className="flex gap-2.5">
              <Button onClick={() => decide(a, "approve")} disabled={!isWarden || !!leaving[a.id]}>Approve</Button>
              <Button variant="outline" onClick={() => decide(a, "reject")} disabled={!isWarden || !!leaving[a.id]}>Reject</Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-3.5 self-start rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center">
          <h2 className="flex-1 text-lg font-semibold">Campus Knowledge</h2>
          <Chip className="border border-gray-200 bg-white text-gray-500">{kb.length} lessons</Chip>
        </div>
        {settings && !settings.meko_enabled && <p className="text-[13px] text-gray-500">Meko is OFF, so Campus Knowledge can&apos;t be read.</p>}
        {[...kb].sort((x, y) => Number(y.text === justAdded) - Number(x.text === justAdded)).map((k) => {
          const fresh = k.text === justAdded;
          return (
            <div
              key={k.id}
              className={cx("flex gap-3 rounded-2xl border bg-white p-4", fresh ? "animate-slideIn border-2 border-orange-500 shadow-glow" : "border-gray-200")}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <circle cx="10" cy="10" r="9" fill="#E8F7EE" />
                <path d="M6 10.3l2.6 2.6L14 7.5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="space-y-1">
                {fresh && <Chip className="bg-orange-500 text-white">Just added</Chip>}
                <p className="text-sm font-medium">{k.text}</p>
                <p className="text-xs text-gray-500">Approved by {k.approved_by === "WARDEN-1" ? "Warden" : k.approved_by ?? "Warden"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
