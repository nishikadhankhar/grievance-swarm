"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { MekoToggle } from "@/components/TopBar";
import { Button, Card, CategoryChip, Chip, ErrorNote, PageHeading, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Place } from "@/lib/types";

interface Side {
  meko: "on" | "off";
  call_id: string | null;
  routing: string;
  suggestion: string | null;
  suggestion_source: string | null;
  recalled: string[];
  expected_visits: number;
  observed_avg_visits: number | null;
}
interface Result {
  category: string;
  place: string;
  text: string;
  on: Side;
  off: Side;
}

function Column({ side, highlighted }: { side: Side; highlighted: boolean }) {
  const on = side.meko === "on";
  const steps: [string, string, string | null][] = [
    ["Agent", "Desk agent", `Routes it: ${side.routing}`],
    on
      ? ["Agent", "Department agent", side.suggestion ? `Suggests: “${side.suggestion}”` : "Recall found nothing similar"]
      : ["Agent", "Department agent", "No memory to read, so no suggestion"],
    ["Person", "Technician", side.suggestion ? "Checks the suggested cause first" : "Diagnoses from scratch, may need a return visit"],
  ];
  return (
    <Card className={cx("space-y-5 p-7 transition-opacity", highlighted ? (on ? "border-2 border-orange-500" : "border-2 border-gray-900") : "opacity-50")}>
      <div className="flex items-center gap-3">
        <span className={cx("flex h-[22px] w-10 items-center rounded-full p-0.5", on ? "justify-end bg-orange-500" : "justify-start bg-gray-300")}>
          <span className="h-[18px] w-[18px] rounded-full bg-white" />
        </span>
        <h2 className={cx("flex-1 text-lg font-semibold", on && "text-orange-700")}>Meko {on ? "ON" : "OFF"}</h2>
        <Chip className={on ? "border border-orange-200 bg-orange-50 text-orange-700" : "border border-gray-200 bg-gray-50 text-gray-500"}>
          {on ? "Memory-assisted" : "Generic routing"}
        </Chip>
      </div>
      <ol className="space-y-3.5">
        {steps.map(([kind, who, what], i) => (
          <li key={i} className="flex gap-3">
            <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", on ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-500")}>{i + 1}</span>
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <span className={cx("rounded-full px-2 py-0.5 text-[11px]", kind === "Agent" ? "bg-gray-900 text-white" : "border border-gray-900")}>{kind}</span>
                {who}
              </p>
              <p className="text-[15px] font-medium">{what}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={cx("flex flex-wrap gap-8 rounded-2xl border px-5 py-4", on ? "border-orange-200 bg-orange-50/60" : "border-gray-200 bg-gray-50")}>
        <div>
          <div className={cx("text-[32px] font-bold leading-tight", on ? "text-orange-500" : "text-gray-900")}>
            {side.expected_visits} visit{side.expected_visits > 1 && "s"}
          </div>
          <div className="text-xs font-medium text-gray-500">expected to resolve</div>
        </div>
        {side.observed_avg_visits !== null && (
          <div>
            <div className="text-[32px] font-bold leading-tight text-gray-900">{side.observed_avg_visits}</div>
            <div className="text-xs font-medium text-gray-500">avg visits on past tickets like this</div>
          </div>
        )}
      </div>
      {side.call_id && <p className="font-mono text-[11px] text-gray-400">call_id {side.call_id}{!on && " (skipped)"}</p>}
    </Card>
  );
}

export default function ComparePage() {
  const { settings } = useRole();
  const [places, setPlaces] = useState<Place[]>([]);
  const [text, setText] = useState("Geyser tripping again in my room");
  const [placeId, setPlaceId] = useState("hostel-b");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Result>("/compare", { text, place_id: placeId }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api<Place[]>("/places").then(setPlaces).catch(() => {});
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mekoOn = settings?.meko_enabled ?? true;

  return (
    <div className="space-y-6 px-4 pb-16 pt-10 sm:px-16">
      <PageHeading
        title="Meko ON vs OFF"
        sub="Same grievance, two outcomes. Flip the toggle to switch which side is live."
        right={<MekoToggle />}
      />
      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-gray-200 bg-gray-50 px-4 py-3">
        {result && <CategoryChip category={result.category} />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-[240px] flex-1 bg-transparent text-[15px] font-semibold outline-none"
          aria-label="Grievance text"
        />
        <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm" aria-label="Location">
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button onClick={run} disabled={busy || text.trim().length < 3}>
          {busy ? "Running…" : "Run both"}
        </Button>
      </div>
      <ErrorNote error={error} />
      {result && (
        <div className="grid gap-6 md:grid-cols-2">
          <Column side={result.on} highlighted={mekoOn} />
          <Column side={result.off} highlighted={!mekoOn} />
        </div>
      )}
    </div>
  );
}
