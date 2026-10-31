"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODE_IDS, SwarmGraph, type Pulse } from "@/components/SwarmGraph";
import { Card, Chip, ErrorNote, SimulatedBadge, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { useRole } from "@/components/RoleProvider";
import { hhmm, stamp } from "@/lib/format";
import type { Counters, MekoCall, Message } from "@/lib/types";
import { useEvents } from "@/lib/ws";

const PULSE_MS = 1600;
const REPLAY_STEP_MS = 650;

// Same rules as the backend's counters(): the board shows only what the call log says.
function countCalls(calls: MekoCall[]): Counters {
  const live = calls.filter((c) => !c.skipped);
  const n = (op: string) => live.filter((c) => c.op === op).length;
  return {
    notes: n("write") + n("share"),
    reads: n("recall"),
    promotions: n("promote"),
    directives: n("directive"),
    approvals: n("approval"),
    errors: calls.filter((c) => c.error).length,
    skipped: calls.length - live.length,
  };
}

const TAGS: Record<string, string> = {
  directive: "bg-orange-50 text-orange-700",
  promote: "bg-orange-50 text-orange-700",
  approval: "bg-orange-50 text-orange-700",
};

export default function SwarmPage() {
  const { settings } = useRole();
  const [calls, setCalls] = useState<MekoCall[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [cursor, setCursor] = useState<number | null>(null); // null = live
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pulseKey = useRef(0);

  const pulse = useCallback((call: MekoCall) => {
    const key = ++pulseKey.current;
    setPulses((p) => [...p.slice(-6), { call, key }]);
    setTimeout(() => setPulses((p) => p.filter((x) => x.key !== key)), PULSE_MS);
  }, []);

  useEffect(() => {
    Promise.all([api<{ calls: MekoCall[] }>("/meko/calls?limit=5000"), api<Message[]>("/messages?limit=300")])
      .then(([c, m]) => {
        setCalls(c.calls);
        setMessages(m);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEvents((e) => {
    if (e.type === "meko.call") {
      setCalls((c) => [...c, e.data]);
      if (cursor === null) pulse(e.data);
    }
    if (e.type === "message") setMessages((m) => [e.data, ...m]);
  });

  // Replay: walk the call log in order and re-animate each call.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setCursor((i) => {
        const next = (i ?? -1) + 1;
        if (next >= calls.length) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, REPLAY_STEP_MS);
    return () => clearInterval(t);
  }, [playing, calls.length]);

  useEffect(() => {
    if (cursor !== null && calls[cursor]) pulse(calls[cursor]);
  }, [cursor, calls, pulse]);

  const visibleCalls = cursor === null ? calls : calls.slice(0, cursor + 1);
  const until = cursor === null ? null : calls[cursor]?.at;
  const counters = useMemo(() => countCalls(visibleCalls), [visibleCalls]);
  const visibleMessages = until ? messages.filter((m) => m.at <= until) : messages;
  const lastSimulated = pulses.length > 0 && pulses[pulses.length - 1].call.simulated;
  const holds = selected
    ? visibleCalls.filter((c) => c.actor === selected && !c.skipped && ["write", "share", "directive", "promote"].includes(c.op)).slice(-5).reverse()
    : [];

  const COUNTER_ROWS: [keyof Counters, string, boolean][] = [
    ["notes", "Notes", false],
    ["reads", "Reads", false],
    ["promotions", "Promotions", true],
    ["directives", "Directives", true],
    ["approvals", "Approvals", false],
    ["errors", "Errors", false],
  ];

  return (
    <div className="space-y-4 px-4 pb-8 pt-5 sm:px-8">
      <ErrorNote error={error} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COUNTER_ROWS.map(([k, label, hl]) => (
          <div key={k} className={cx("rounded-[14px] border bg-white px-[18px] py-3", hl ? "border-orange-200" : "border-gray-200")}>
            <div className={cx("text-[26px] font-bold leading-tight", hl ? "text-orange-500" : k === "errors" && counters.errors ? "text-red-600" : "text-gray-900")}>
              {counters[k]}
            </div>
            <div className="text-xs font-medium text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[7fr_3fr]">
        <Card className="space-y-2.5 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-base font-semibold">Swarm board</h1>
            {lastSimulated && <SimulatedBadge />}
            {counters.skipped > 0 && <span className="text-xs text-gray-500">{counters.skipped} calls skipped (Meko OFF)</span>}
            <span className="flex-1" />
            <Legend />
          </div>
          <SwarmGraph pulses={pulses} selected={selected} onNodeClick={(id) => setSelected((s) => (s === id || !NODE_IDS.has(id) ? null : id))} />
          {selected && (
            <div className="rounded-xl border border-gray-200 p-3.5 text-[13px]">
              <p className="mb-2 font-semibold">{selected} holds · last {holds.length} items it wrote</p>
              {holds.length === 0 && <p className="text-gray-500">Nothing written yet.</p>}
              <ul className="space-y-1.5">
                {holds.map((h) => (
                  <li key={h.id} className="flex gap-2">
                    <span className="font-mono text-[11px] text-gray-400">{h.id}</span>
                    <span className="text-gray-500">{h.datapack}</span>
                    <span className="flex-1 truncate">{h.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!selected && <p className="text-xs text-gray-400">Click a node to see what it holds.</p>}
        </Card>

        <Card className="flex max-h-[640px] flex-col p-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="flex-1 text-base font-semibold">Message stream</h2>
            <Chip dot className={cursor === null ? "bg-orange-50 text-orange-700" : "bg-gray-100 text-gray-500"}>
              {cursor === null ? "Live" : `Replay ${stamp(until, settings?.now)}`}
            </Chip>
          </div>
          <ul className="-mr-2 flex-1 overflow-y-auto pr-2">
            {visibleMessages.map((m, i) => (
              <li key={m.id} className={cx("flex gap-3 border-b border-gray-200 py-2.5", i === 0 && "rounded-lg border-transparent bg-orange-50 px-2.5")}>
                <span className="pt-0.5 text-xs font-medium text-gray-500">{hhmm(m.at)}</span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cx("rounded-md border border-gray-200 px-1.5 py-px text-[9px] font-bold uppercase", TAGS[m.kind] ?? "bg-gray-50 text-gray-500")}>
                      {m.kind}
                    </span>
                    {m.simulated && <SimulatedBadge />}
                  </div>
                  <p className="text-[13px] font-semibold">
                    {m.from} → {m.to}
                  </p>
                  <p className="text-[13px] text-gray-500">{m.text}</p>
                </div>
              </li>
            ))}
            {visibleMessages.length === 0 && <li className="py-6 text-center text-sm text-gray-400">No messages yet</li>}
          </ul>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center gap-4 px-5 py-3">
        <button
          onClick={() => {
            if (!playing && cursor === null) setCursor(-1);
            setPlaying((p) => !p);
          }}
          disabled={calls.length === 0}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-orange-500 text-white disabled:bg-orange-300"
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1.5" width="3.5" height="11" rx="1" /><rect x="8.5" y="1.5" width="3.5" height="11" rx="1" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" /></svg>
          )}
        </button>
        <span className="text-[13px] font-semibold">Replay</span>
        <span className="text-[13px] font-medium text-orange-700">{stamp(until ?? calls[calls.length - 1]?.at, settings?.now)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(calls.length - 1, 0)}
          value={cursor ?? Math.max(calls.length - 1, 0)}
          onChange={(e) => {
            setPlaying(false);
            setCursor(Number(e.target.value));
          }}
          className="min-w-[200px] flex-1 accent-orange-500"
          aria-label="Replay position"
        />
        <span className="text-xs text-gray-500">
          {stamp(calls[0]?.at, settings?.now)} – {stamp(calls[calls.length - 1]?.at, settings?.now)} · {visibleCalls.length}/{calls.length} calls
        </span>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor(null);
          }}
          className={cx("rounded-full px-3 py-1 text-xs font-semibold", cursor === null ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-700")}
        >
          Live
        </button>
      </Card>
    </div>
  );
}

function Legend() {
  const item = (label: string, line: JSX.Element) => (
    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
      {line}
      {label}
    </span>
  );
  const ln = (stroke: string, dash?: string) => (
    <svg width="24" height="4"><path d="M0 2H24" stroke={stroke} strokeWidth="2" strokeDasharray={dash} /></svg>
  );
  return (
    <div className="flex flex-wrap gap-4">
      {item("Write", ln("#4B5563"))}
      {item("Recall", ln("#6B7280", "4 3"))}
      {item("Directive", ln("#F97316"))}
      {item("Promote", <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_6px_2px_rgba(249,115,22,0.6)]" />)}
    </div>
  );
}
