"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRole } from "@/components/RoleProvider";
import { HOME } from "@/components/TopBar";

export default function Index() {
  const { role } = useRole();
  const router = useRouter();
  useEffect(() => router.replace(HOME[role]), [role, router]);
  return null;
}
