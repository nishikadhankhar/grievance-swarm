"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { Card, Empty, ErrorNote, PageHeading } from "@/components/ui";
import { api } from "@/lib/api";

interface Pattern {
  id: string;
  text: string;
  stat: string | null;
  series: number[];
  verified_by: string | null;
}

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const w = 600;
  const h = 72;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => [4 + (i / (series.length - 1)) * (w - 8), h - 6 - (v / max) * (h - 14)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[72px] w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L${w - 4} ${h} L4 ${h} Z`} fill="#F97316" fillOpacity="0.1" />
      <path d={line} fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="4.5" fill="#F97316" />
    </svg>
  );
}

export default function DeanPage() {
  const { settings } = useRole();
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ patterns: Pattern[]; meko_skipped: boolean }>("/dean/patterns")
      .then((r) => {
        setPatterns(r.patterns);
        setSkipped(r.meko_skipped);
      })
      .catch((e: Error) => setError(e.message));
  }, [settings?.meko_enabled]);

  return (
    <div className="space-y-6 px-4 pb-16 pt-10 sm:px-16">
      <PageHeading title="Patterns" sub="Recurring campus issues, verified by the Warden. Use them to plan maintenance." />
      <ErrorNote error={error} />
      {skipped && <Empty>Meko is OFF. Patterns are only ever read from Meko, so there is nothing to show.</Empty>}
      {patterns?.length === 0 && !skipped && <Empty>No verified patterns yet.</Empty>}
      <div className="grid gap-6 md:grid-cols-2">
        {patterns?.map((p) => (
          <Card key={p.id} className="space-y-4 p-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M8 1.8l5 1.8v4c0 3-2.1 5.2-5 6.2-2.9-1-5-3.2-5-6.2v-4l5-1.8Z" strokeLinejoin="round" />
                <path d="M5.8 8l1.6 1.6L10.4 6.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified by Warden
            </span>
            <h2 className="text-xl font-semibold leading-snug">{p.text}</h2>
            <Sparkline series={p.series} />
            {p.stat && <p className="text-sm font-semibold text-orange-700">{p.stat}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
