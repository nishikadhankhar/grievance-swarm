"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { EmergencyStrip } from "@/components/EmergencyStrip";
import { StarterCards } from "@/components/StarterCards";
import { StudentSidebar } from "@/components/StudentSidebar";
import { ErrorNote, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Place, Ticket, User } from "@/lib/types";

interface Preview {
  similar: { ticket_id: string; report_count: number; message: string } | null;
  meko_skipped: boolean;
}

const MAX_PHOTO = 1_000_000;
const MAX_CHARS = 1000;

export default function ReportPage() {
  const { userId, setUserId, role } = useRole();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [text, setText] = useState("");
  const [placeId, setPlaceId] = useState("hostel-b");
  const [photo, setPhoto] = useState<{ name: string; data: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User decision on duplicate detection:
  // - null: default/unanswered
  // - false: user confirmed "No, mine is different" (force new ticket)
  // - true: user confirmed "Yes, add me"
  const [forceNewTicket, setForceNewTicket] = useState(false);

  const seq = useRef(0);

  useEffect(() => {
    api<Place[]>("/places").then(setPlaces).catch((e: Error) => setError(e.message));
    api<User[]>("/users?role=student").then(setStudents).catch(() => {});
  }, []);

  // Before submitting: ask the Desk agent whether this matches an open ticket.
  useEffect(() => {
    setPreview(null);
    setForceNewTicket(false);
    if (text.trim().length < 12) return;
    const n = ++seq.current;
    const t = setTimeout(() => {
      api<Preview>("/grievances/preview", { text, place_id: placeId })
        .then((p) => n === seq.current && setPreview(p))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [text, placeId]);

  function onPhoto(file: File | undefined) {
    if (!file) return setPhoto(null);
    if (file.size > MAX_PHOTO) return setError("Photo must be under 1 MB");
    const reader = new FileReader();
    reader.onload = () => setPhoto({ name: file.name, data: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function handleStarterSelect(starterText: string) {
    setText(starterText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      /**
       * TODO (Backend Change Needed for 'No, mine is different'):
       * In backend/app/api/grievances.py, update GrievanceIn to accept `force_new_ticket: bool = False`.
       * In backend/app/agents/desk.py:handle_grievance(), if `force_new_ticket` is True, bypass
       * `recall_similar()` so that a new ticket is always created rather than merging.
       */
      const payload: Record<string, unknown> = {
        user_id: userId,
        text,
        place_id: placeId,
        photo_url: photo?.data ?? null,
      };

      if (forceNewTicket) {
        payload.force_new_ticket = true;
      }

      const r = await api<{ ticket: Ticket }>("/grievances", payload);
      router.push(`/student/tickets/${r.ticket.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <StudentSidebar>
      <div className="mx-auto w-full max-w-[880px] px-4 py-8 sm:px-8 sm:py-10">
        {/* Permanent Safety Alert Banner */}
        <EmergencyStrip />

        {/* Heading Block */}
        <div className="mb-6 space-y-1.5">
          <p className="text-xs sm:text-sm font-medium text-gray-500">
            Welcome, <span className="font-semibold text-gray-800">{userId}</span>
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold tracking-tight text-gray-900 leading-tight">
            What&apos;s broken? Tell us in your own words.
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Our autonomous Desk Agent routes, dedupes, and updates technicians with real-time ETAs.
          </p>
        </div>

        {/* Main AI Chat-Style Input Card */}
        <div className="rounded-2xl border border-gray-200/90 bg-white p-5 sm:p-7 shadow-sm space-y-4 transition-shadow hover:shadow-md">
          {/* Big Textarea with Live Character Counter */}
          <div className="relative">
            <label htmlFor="grievance-text" className="sr-only">
              What&apos;s wrong? Describe it in your own words.
            </label>
            <textarea
              id="grievance-text"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              rows={6}
              maxLength={MAX_CHARS}
              placeholder="e.g. Wi-Fi is not working on the 2nd floor of Hostel B since evening."
              className="block w-full min-h-[180px] resize-y rounded-xl border border-gray-100 bg-gray-50/60 p-4 pb-8 text-base text-gray-900 leading-relaxed outline-none transition-all placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-3 focus:ring-orange-500/10"
            />
            {/* Live Character Counter */}
            <div className="pointer-events-none absolute bottom-3 right-3 text-xs font-mono text-gray-400">
              <span className={cx(text.length >= MAX_CHARS ? "text-red-500 font-semibold" : "")}>
                {text.length}
              </span>{" "}
              / {MAX_CHARS.toLocaleString()}
            </div>
          </div>

          {/* Privacy Hint */}
          <p className="text-xs text-gray-400 flex items-center gap-1.5 pl-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>
              Don&apos;t include names or phone numbers. We remove them automatically, but not perfectly.
            </span>
          </p>

          {/* Restyled Merge Banner (Question format with Yes / No actions) */}
          {preview?.similar && !forceNewTicket && (
            <div
              className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-800 text-sm font-bold">
                  ⚡
                </span>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-amber-900">
                      {preview.similar.report_count} others reported something similar (ticket{" "}
                      <span className="font-mono underline font-bold">{preview.similar.ticket_id}</span>). Is this the same issue?
                    </p>
                    <span className="rounded-md bg-amber-200/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800">
                      Desk Agent Match
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/90">
                    If merged, you will be subscribed to shared updates and the technician&apos;s ETA directly.
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={submit}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 active:scale-95 transition-all"
                    >
                      <span>Yes, add me</span>
                      <span>✓</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceNewTicket(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100/50 transition-colors"
                    >
                      <span>No, mine is different</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback when user chose "No, mine is different" */}
          {preview?.similar && forceNewTicket && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Marked as a separate issue. A new ticket will be generated upon submission.</span>
              </div>
              <button
                type="button"
                onClick={() => setForceNewTicket(false)}
                className="text-xs font-medium text-orange-600 underline hover:text-orange-800"
              >
                Undo
              </button>
            </div>
          )}

          <ErrorNote error={error} />

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Bottom Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Left Toolbar Controls: Location Chip, Photo Upload, Disabled Voice */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Location Selector styled as a Chip */}
              <div className="relative inline-flex items-center rounded-xl border border-gray-200 bg-gray-50/80 hover:bg-gray-100 text-gray-700 transition-colors">
                <span className="pointer-events-none pl-3 text-gray-400">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <select
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  aria-label="Location"
                  className="appearance-none bg-transparent py-2 pl-2 pr-7 text-xs font-medium text-gray-800 outline-none cursor-pointer"
                >
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 text-gray-400 text-xs">▼</span>
              </div>

              {/* Photo Upload Chip */}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="max-w-[120px] truncate">{photo ? photo.name : "Add photo"}</span>
                {photo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPhoto(null);
                    }}
                    className="ml-1 text-gray-400 hover:text-gray-700 font-bold"
                  >
                    ✕
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPhoto(e.target.files?.[0])}
                />
              </label>

              {/* Disabled Voice Message Button with 'Soon' pill */}
              <button
                type="button"
                disabled
                title="Voice input coming soon"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-gray-50/50 px-3 py-2 text-xs font-medium text-gray-400 cursor-not-allowed opacity-75"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                <span>Voice</span>
                <span className="rounded bg-gray-200/80 px-1 py-0.2 text-[9px] font-semibold text-gray-600 uppercase">
                  Soon
                </span>
              </button>
            </div>

            {/* Right Toolbar Controls: Posting As & Orange Submit Button */}
            <div className="flex items-center gap-3 ml-auto">
              {/* Posting As Pseudonym selector */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="hidden sm:inline">Posting as:</span>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={role !== "student"}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-800"
                  aria-label="Student pseudonym"
                >
                  {(students.length ? students : [{ id: userId } as User]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Primary Orange Send/Submit Button */}
              <button
                type="button"
                onClick={submit}
                disabled={busy || text.trim().length < 3 || role !== "student"}
                className={cx(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]",
                  busy || text.trim().length < 3 || role !== "student"
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-orange-500 hover:bg-orange-600 hover:shadow-md"
                )}
              >
                <span>{busy ? "Submitting…" : "Submit report"}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Explore By Ready Prompt / Common Problems Section */}
        <StarterCards onSelect={handleStarterSelect} />
      </div>
    </StudentSidebar>
  );
}
