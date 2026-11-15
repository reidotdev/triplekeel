"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** How often to refresh while polling. */
export const POLL_INTERVAL_MS = 5_000;
/** Polling stops after this long without a change in `version`. */
export const POLL_WINDOW_MS = 120_000;
/** Focus and visibility events often fire together. One refresh is enough. */
const MIN_GAP_MS = 1_000;

/**
 * Re-renders the dashboard's server components so new reports from "Score
 * this chat" show up without a reload. It calls router.refresh(), which is a
 * page request, not an /api/* call.
 *
 * - When the tab becomes visible or gets focus, it refreshes at once.
 * - While the tab is visible, it refreshes every 5 seconds. It stops after
 *   2 minutes without a change in `version`, so an idle tab doesn't poll
 *   forever. Focus, a visible tab or pointer movement on the page starts it
 *   again.
 * - While the tab is hidden, it does nothing.
 *
 * `version` is a short value from the server data, such as the prompt count.
 * When it changes, the 2 minutes start again.
 */
export function AutoRefresh({
  version,
  intervalMs = POLL_INTERVAL_MS,
  windowMs = POLL_WINDOW_MS,
}: {
  version: string;
  intervalMs?: number;
  windowMs?: number;
}) {
  const router = useRouter();
  const deadline = useRef(0);

  // New data means the user is active: keep polling for another window.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on purpose when version changes.
  useEffect(() => {
    deadline.current = Date.now() + windowMs;
  }, [version, windowMs]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastRefresh = 0;

    const isVisible = () => document.visibilityState === "visible";
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh < MIN_GAP_MS) return;
      lastRefresh = now;
      router.refresh();
    };
    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };
    const tick = () => {
      if (!isVisible() || Date.now() > deadline.current) {
        stop();
        return;
      }
      refresh();
    };
    const start = () => {
      deadline.current = Date.now() + windowMs;
      if (timer === undefined) timer = setInterval(tick, intervalMs);
    };
    const wake = () => {
      if (!isVisible()) {
        stop();
        return;
      }
      refresh();
      start();
    };
    const onPointerMove = () => {
      if (timer === undefined) wake();
    };

    // The page was just rendered with fresh data, so no refresh yet.
    if (isVisible()) start();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      stop();
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, [router, intervalMs, windowMs]);

  return null;
}
