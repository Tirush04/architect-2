"use client";

import { useCallback, useRef } from "react";
import { SseParser } from "@/lib/sse";
import type { BuildEvent } from "@/lib/schemas";

export class StreamError extends Error {
  constructor(message: string, public readonly needsConnect = false) {
    super(message);
  }
}

export function useStream() {
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (url: string, body: unknown, onEvent: (e: BuildEvent) => void) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      const j = (await res.json().catch(() => ({}))) as { error?: string; needsConnect?: boolean };
      throw new StreamError(j.error ?? `Request failed (${res.status})`, !!j.needsConnect);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const ev of parser.push(decoder.decode(value, { stream: true }))) onEvent(ev);
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { run, stop };
}
