import type { Role } from "./types";

export const HOME: Record<Role, string> = {
  student: "/student/new",
  technician: "/staff/queue",
  warden: "/staff/queue",
  dean: "/dean",
};

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  technician: "Technician",
  warden: "Warden",
  dean: "Dean",
};

/** "hostel-b" → "Hostel B" */
export function hostelName(id: string): string {
  return id.replace(/^hostel-(\w)$/, (_, x: string) => `Hostel ${x.toUpperCase()}`);
}
