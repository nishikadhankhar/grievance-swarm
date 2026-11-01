"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, getToken, onTokenChange, setToken } from "@/lib/api";
import { HOME } from "@/lib/roles";
import type { Me, Role, Settings } from "@/lib/types";
import { useEvents } from "@/lib/ws";

// Pages anyone can open; everything else needs a signed-in account.
export const AUTH_PAGES = ["/signin", "/signup"];

export interface SignUpBody {
  kind: "student" | "staff";
  email: string;
  password: string;
  hostel?: string;
  name?: string;
  role?: Exclude<Role, "student">;
  department?: string;
  staff_code?: string;
}

interface Ctx {
  user: Me | null;
  role: Role;
  userId: string;
  signIn: (email: string, password: string) => Promise<Me>;
  signUp: (body: SignUpBody) => Promise<Me>;
  signOut: () => Promise<void>;
  settings: Settings | null;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const RoleContext = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const router = useRouter();
  const path = usePathname();
  const onAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));
  const signingOut = useRef(false);

  // Load the account for the stored token, and drop it whenever the token goes away (e.g. a 401).
  useEffect(() => {
    const sync = () => {
      if (!getToken()) {
        setUser(null);
        setReady(true);
        return;
      }
      api<Me>("/auth/me")
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setReady(true));
    };
    sync();
    return onTokenChange(sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // After a sign-out, don't send the next person back to the page the last one was on.
    if (!user && !onAuthPage) router.replace(signingOut.current ? "/signin" : `/signin?next=${encodeURIComponent(path)}`);
    if (onAuthPage) signingOut.current = false;
    if (user && onAuthPage) router.replace(HOME[user.role]);
  }, [ready, user, onAuthPage, path, router]);

  useEffect(() => {
    if (user) api<Settings>("/settings").then(setSettings).catch(() => setSettings(null));
  }, [user]);

  useEvents((e) => {
    if (e.type === "settings.updated") setSettings(e.data);
  });

  const start = useCallback((r: { token: string; user: Me }) => {
    setUser(r.user);
    setToken(r.token);
    return r.user;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => start(await api<{ token: string; user: Me }>("/auth/signin", { email, password })),
    [start],
  );

  const signUp = useCallback(async (body: SignUpBody) => start(await api<{ token: string; user: Me }>("/auth/signup", body)), [start]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    await api("/auth/signout", {}).catch(() => {});
    setToken(null);
    setUser(null);
    router.replace("/signin");
  }, [router]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await api<Settings>("/settings", patch));
  }, []);

  return (
    <RoleContext.Provider
      value={{ user, role: user?.role ?? "student", userId: user?.id ?? "", signIn, signUp, signOut, settings, updateSettings }}
    >
      {/* Pages fetch on mount, so only render them once we know who is signed in. */}
      {onAuthPage || user ? children : null}
    </RoleContext.Provider>
  );
}

export function useRole(): Ctx {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole outside RoleProvider");
  return ctx;
}
