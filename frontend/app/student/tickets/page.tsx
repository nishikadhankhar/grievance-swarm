"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { Empty, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/types";

// "My ticket": opens the student's most recent ticket.
export default function MyTickets() {
  const { userId, role } = useRole();
  const router = useRouter();
  const [none, setNone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "student") return;
    api<Ticket[]>(`/students/${userId}/tickets`)
      .then((ts) => (ts.length ? router.replace(`/student/tickets/${ts[0].id}`) : setNone(true)))
      .catch((e: Error) => setError(e.message));
  }, [userId, role, router]);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-12">
      <ErrorNote error={error} />
      {(none || role !== "student") && (
        <Empty>
          {role !== "student" ? "Sign in with a student account to see your tickets." : `${userId} hasn't reported anything yet. `}
          {role === "student" && (
            <Link href="/student/new" className="font-semibold text-orange-700">
              Report a problem
            </Link>
          )}
        </Empty>
      )}
    </div>
  );
}
