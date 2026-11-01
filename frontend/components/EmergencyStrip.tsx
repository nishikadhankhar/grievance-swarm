import { EMERGENCY_CONTACTS } from "@/lib/constants";

export function EmergencyStrip() {
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-2.5 text-xs text-red-900 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-red-800 font-bold text-[11px]">
          !
        </span>
        <span className="font-semibold text-red-800">
          Emergency (fire, gas leak, active sparking)?
        </span>
        <span className="hidden sm:inline text-red-700">
          Call immediate emergency help:
        </span>
      </div>
      <div className="flex items-center gap-3 font-medium text-[11px] sm:text-xs">
        {EMERGENCY_CONTACTS.campusSecurity && (
          <>
            <a
              href={`tel:${EMERGENCY_CONTACTS.campusSecurity.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-1 font-semibold text-red-700 underline decoration-red-300 hover:text-red-900"
            >
              Campus Security: {EMERGENCY_CONTACTS.campusSecurity}
            </a>
            <span className="text-red-300">·</span>
          </>
        )}
        <a
          href={`tel:${EMERGENCY_CONTACTS.fire}`}
          className="inline-flex items-center gap-1 font-semibold text-red-700 underline decoration-red-300 hover:text-red-900"
        >
          Fire: {EMERGENCY_CONTACTS.fire}
        </a>
        <span className="text-red-300">·</span>
        <a
          href={`tel:${EMERGENCY_CONTACTS.medical}`}
          className="inline-flex items-center gap-1 font-semibold text-red-700 underline decoration-red-300 hover:text-red-900"
        >
          Ambulance: {EMERGENCY_CONTACTS.medical}
        </a>
      </div>
    </div>
  );
}

