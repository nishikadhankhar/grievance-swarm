"use client";

import Link from "next/link";
import { TicketPanel } from "@/components/TicketPanel";

export default function StaffTicketPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-4 py-8">
      <Link href="/staff/queue" className="text-sm font-medium text-gray-500 hover:text-gray-900">
        ← Queue
      </Link>
      <TicketPanel id={params.id} />
    </div>
  );
}
