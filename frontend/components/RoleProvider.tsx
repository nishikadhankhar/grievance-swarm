"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Role, Settings } from "@/lib/types";
import { useEvents } from "@/lib/ws";

// Demo login: a role switcher plus a pseudonymous user per role. Stored in the browser only.
const DEFAULT_USER: Record<Role, string> = {
  student: "S-1042",
  technician: "TECH-WIFI",
  warden: "WARDEN-1",
  dean: "DEAN-1",
};

interface Ctx {
  role: Role;
  userId: string;
  setRole: (r: Role) => void;
  setUserId: (id: string) => void;
  settings: Settings | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const RoleContext = createContext<Ctx | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("student");
  const [users, setUsers] = useState<Record<Role, string>>(DEFAULT_USER);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    setRoleState(load<Role>("cgs.role", "student"));
    setUsers(load("cgs.users", DEFAULT_USER));
    api<Settings>("/settings").then(setSettings).catch(() => setSettings(null));
  }, []);

  useEvents((e) => {
    if (e.type === "settings.updated") setSettings(e.data);
  });

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem("cgs.role", JSON.stringify(r));
    } catch {
      /* private window */
    }
  }, []);

  const setUserId = useCallback(
    (id: string) => {
      setUsers((u) => {
        const next = { ...u, [role]: id };
        try {
          localStorage.setItem("cgs.users", JSON.stringify(next));
        } catch {
          /* private window */
        }
        return next;
      });
    },
    [role],
  );

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await api<Settings>("/settings", patch));
  }, []);

  return (
    <RoleContext.Provider value={{ role, userId: users[role], setRole, setUserId, settings, updateSettings }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): Ctx {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole outside RoleProvider");
  return ctx;
}
