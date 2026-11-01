"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, getToken, onTokenChange } from "./api";
import type { BusEvent } from "./types";

// One shared WebSocket to /ws/events for the whole app; pages subscribe with useEvents. Nothing polls.
type Handler = (e: BusEvent) => void;

const handlers = new Set<Handler>();
const statusListeners = new Set<(up: boolean) => void>();
let sock: WebSocket | null = null;
let up = false;
let retry = 0;

function setUp(v: boolean) {
  up = v;
  statusListeners.forEach((l) => l(v));
}

function connect() {
  const token = getToken();
  if (sock || typeof window === "undefined" || !token) return; // the socket needs a signed-in session
  sock = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws/events?token=${encodeURIComponent(token)}`);
  sock.onopen = () => {
    retry = 0;
    setUp(true);
  };
  sock.onmessage = (m) => {
    const e = JSON.parse(m.data) as BusEvent;
    handlers.forEach((h) => h(e));
  };
  sock.onclose = () => {
    sock = null;
    setUp(false);
    setTimeout(connect, Math.min(5000, 500 * 2 ** retry++));
  };
}

// Signing in, out, or as someone else reopens the socket with the new session.
if (typeof window !== "undefined") {
  onTokenChange(() => {
    if (sock) {
      sock.onclose = null;
      sock.close();
      sock = null;
      setUp(false);
    }
    retry = 0;
    connect();
  });
}

export function useEvents(handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h: Handler = (e) => ref.current(e);
    handlers.add(h);
    connect();
    return () => {
      handlers.delete(h);
    };
  }, []);
}

export function useSocketUp(): boolean {
  const [v, setV] = useState(up);
  useEffect(() => {
    statusListeners.add(setV);
    connect();
    return () => {
      statusListeners.delete(setV);
    };
  }, []);
  return v;
}
