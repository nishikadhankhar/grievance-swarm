"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { Button, Card, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import type { Place, Ticket, User } from "@/lib/types";

interface Preview {
  similar: { ticket_id: string; report_count: number; message: string } | null;
  meko_skipped: boolean;
}

const MAX_PHOTO = 1_000_000;

export default function ReportPage() {
  const { userId, setUserId, role } = useRole();
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [text, setText] = useState("");
  const [placeId, setPlaceId] = useState("hostel-b");
  const [photo, setPhoto] = useState<{ name: string; data: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    api<Place[]>("/places").then(setPlaces).catch((e: Error) => setError(e.message));
    api<User[]>("/users?role=student").then(setStudents).catch(() => {});
  }, []);

  // Before submitting: ask the Desk agent whether this matches an open ticket.
  useEffect(() => {
    setPreview(null);
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

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ticket: Ticket }>("/grievances", {
        user_id: userId,
        text,
        place_id: placeId,
        photo_url: photo?.data ?? null,
      });
      router.push(`/student/tickets/${r.ticket.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-center px-4 pb-16 pt-12 sm:pt-14">
      <div className="w-full max-w-[720px] space-y-6">
        <div>
          <h1 className="text-[32px] font-bold">Report a problem</h1>
          <p className="mt-1.5 text-base text-gray-500">Describe it in your own words. Our agents will route it to the right team.</p>
        </div>
        <Card className="space-y-5 p-6 sm:p-7">
          <label className="block space-y-3">
            <span className="text-[15px] font-semibold">What&apos;s wrong? Describe it in your own words.</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="e.g. Wi-Fi is not working on the 2nd floor of Hostel B since evening."
              className="block w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 p-4 text-base leading-relaxed outline-none focus:border-orange-400 focus:bg-white"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[13px] font-medium text-gray-500">Location</span>
              <select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                className="block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[15px] font-medium outline-none focus:border-orange-400"
              >
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-[13px] font-medium text-gray-500">Photo (optional)</span>
              <span className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-3 text-[15px] font-medium text-gray-500 hover:border-orange-400">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 7a2 2 0 0 1 2-2h1.5l1-1.5h5L13.5 5H15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
                  <circle cx="10" cy="10.5" r="2.5" />
                </svg>
                <span className="truncate">{photo ? photo.name : "Add a photo"}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </span>
            </label>
          </div>
          {preview?.similar && (
            <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 text-sm font-medium text-orange-700" role="status">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 9v5M10 6.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {preview.similar.message}
            </div>
          )}
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-medium text-gray-500">Posting as</span>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={role !== "student"}
              className="rounded-lg border border-gray-200 px-2 py-1 text-[13px] font-medium"
              aria-label="Student pseudonym"
            >
              {(students.length ? students : [{ id: userId } as User]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
            <span className="flex-1" />
            <Button onClick={submit} disabled={busy || text.trim().length < 3 || role !== "student"} className="px-7 py-3.5">
              {busy ? "Submitting…" : "Submit report"}
            </Button>
          </div>
          {role !== "student" && <p className="text-xs text-gray-500">Switch to the Student role to submit.</p>}
        </Card>
      </div>
    </div>
  );
}
