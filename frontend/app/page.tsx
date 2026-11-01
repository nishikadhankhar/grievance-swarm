"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRole } from "@/components/RoleProvider";
import { HOME } from "@/components/TopBar";

export default function Index() {
  const { role } = useRole();
  const router = useRouter();

  useEffect(() => {
    const target = HOME[role] || "/student/new";
    router.replace(target);
  }, [role, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      <p className="mt-4 text-sm font-medium text-gray-600">
        Redirecting to {role === "student" ? "student portal" : `${role} view`}…
      </p>
      <Link
        href={HOME[role] || "/student/new"}
        className="mt-3 text-xs font-semibold text-orange-600 underline hover:text-orange-700"
      >
        Click here if not redirected automatically
      </Link>
    </div>
  );
}
