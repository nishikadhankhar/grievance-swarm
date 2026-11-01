export const EMERGENCY_CONTACTS = {
  // Set NEXT_PUBLIC_CAMPUS_SECURITY_PHONE to your campus number; the strip leaves it out until then.
  campusSecurity: process.env.NEXT_PUBLIC_CAMPUS_SECURITY_PHONE ?? "",
  fire: "101",
  medical: "108",
};

/** Badge text for the backend's Meko mode, from GET /health. */
export const MEKO_MODE_BADGE: Record<string, { label: string; title: string }> = {
  local: { label: "LocalMeko (offline stand-in)", title: "Running on the local SQLite keyword stand-in, not Meko" },
  real: { label: "Meko cloud", title: "Memory calls go to the real Meko service" },
};
