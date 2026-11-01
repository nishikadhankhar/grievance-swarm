"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { MekoToggle } from "@/components/TopBar";
import { Button, Card, ErrorNote, PageHeading } from "@/components/ui";
import { api } from "@/lib/api";

const input = "block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400";

export default function SettingsPage() {
  const { settings, updateSettings } = useRole();
  const [llmUrl, setLlmUrl] = useState("");
  const [model, setModel] = useState("");
  const [hostel, setHostel] = useState("hostel-b");
  const [until, setUntil] = useState("22:00");
  const [message, setMessage] = useState("Power cut in Hostel B until 22:00");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setLlmUrl(settings.llm_base_url);
      setModel(settings.model);
    }
  }, [settings]);

  async function act(fn: () => Promise<string>) {
    setError(null);
    setNote(null);
    try {
      setNote(await fn());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const fastForward = (minutes: number) =>
    act(async () => {
      const s = await api<{ now: string }>("/settings/fast-forward", { minutes });
      return `Clock moved to ${new Date(s.now).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
    });

  return (
    <div className="mx-auto max-w-[760px] space-y-6 px-4 pb-16 pt-10">
      <PageHeading title="Demo settings" sub="Controls for the 5-minute demo. Changes reach every open screen live." />
      <ErrorNote error={error} />
      {note && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{note}</p>}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Meko</h2>
        <MekoToggle />
        <p className="text-[13px] text-gray-500">OFF really means off: the adapter skips every call and logs it as skipped.</p>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Power-cut directive (Electricity)</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <input value={message} onChange={(e) => setMessage(e.target.value)} className={input} aria-label="Directive message" />
          <input value={until} onChange={(e) => setUntil(e.target.value)} className={input} placeholder="HH:MM" aria-label="Valid until" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={hostel} onChange={(e) => setHostel(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" aria-label="Hostel">
            <option value="hostel-a">Hostel A</option>
            <option value="hostel-b">Hostel B</option>
            <option value="all">Whole campus</option>
          </select>
          <Button
            onClick={() =>
              act(async () => {
                const r = await api<{ held_tickets: string[] }>("/events/directive", {
                  department: "electricity",
                  hostel,
                  message,
                  valid_to: until,
                });
                return r.held_tickets.length ? `Posted. Held: ${r.held_tickets.join(", ")}` : "Posted. No open tickets needed holding.";
              })
            }
          >
            Post directive
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Demo clock</h2>
        <p className="text-[13px] text-gray-500">
          Now: {settings ? new Date(settings.now).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
          {settings?.clock_offset_minutes ? ` (+${Math.round(settings.clock_offset_minutes / 60)} h)` : ""}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={() => fastForward(60)}>+1 hour</Button>
          <Button variant="outline" onClick={() => fastForward(24 * 60)}>+1 day</Button>
          <Button variant="outline" onClick={() => fastForward(3 * 24 * 60)}>+3 days</Button>
          <Button variant="ghost" onClick={() => act(async () => (await updateSettings({ clock_offset_minutes: 0 }), "Clock reset"))}>Reset</Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">LLM</h2>
        <label className="block space-y-1.5 text-[13px] font-medium text-gray-500">
          OpenAI-compatible base URL
          <input value={llmUrl} onChange={(e) => setLlmUrl(e.target.value)} className={input} />
        </label>
        <label className="block space-y-1.5 text-[13px] font-medium text-gray-500">
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} className={input} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings?.llm_enabled ?? true}
            onChange={(e) => updateSettings({ llm_enabled: e.target.checked })}
            className="accent-orange-500"
          />
          Use the LLM (off = rule-based fallbacks only)
        </label>
        <Button onClick={() => act(async () => (await updateSettings({ llm_base_url: llmUrl, model }), "LLM settings saved"))}>Save</Button>
      </Card>
    </div>
  );
}
