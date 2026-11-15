"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectDevice } from "@/app/device-actions";
import { Button } from "@/components/ui";

type Status =
  | "connecting"
  | "connected"
  | "no_extension"
  | "too_many_devices"
  | "failed";

type Reply = { ok?: boolean } | undefined;

type ChromeRuntime = {
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (reply: Reply) => void,
  ) => void;
  lastError?: unknown;
};

/** Sends a message to the extension. Resolves to null if it isn't there. */
function sendToExtension(
  extensionId: string,
  message: unknown,
): Promise<Reply | null> {
  const runtime = (window as { chrome?: { runtime?: ChromeRuntime } }).chrome
    ?.runtime;
  const send = runtime?.sendMessage;
  if (!runtime || !send) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      send(extensionId, message, (reply) => {
        resolve(runtime.lastError ? null : (reply ?? null));
      });
    } catch {
      resolve(null);
    }
  });
}

const TEXT: Record<Status, string> = {
  connecting: "Connecting…",
  connected: "Connected. You can close this tab.",
  no_extension:
    "The TripleKeel extension isn't installed in this browser. Install it, then try again.",
  too_many_devices:
    "You have too many connected devices. Revoke one, then try again.",
  failed: "Couldn't connect. Try again.",
};

export function ConnectExtension({ extensionId }: { extensionId: string }) {
  const [status, setStatus] = useState<Status>("connecting");
  const started = useRef(false);

  const connect = useCallback(async () => {
    setStatus("connecting");
    // Check the extension is there before creating a device.
    const ping = await sendToExtension(extensionId, {
      type: "triplekeel.ping",
    });
    if (!ping?.ok) return setStatus("no_extension");

    const device = await connectDevice().catch(() => null);
    if (!device?.ok) {
      return setStatus(
        device?.error === "too_many_devices" ? "too_many_devices" : "failed",
      );
    }
    // The token goes to the extension once. It isn't kept or logged here.
    const reply = await sendToExtension(extensionId, {
      type: "triplekeel.connect",
      token: device.token,
    });
    setStatus(reply?.ok ? "connected" : "failed");
  }, [extensionId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void connect();
  }, [connect]);

  return (
    <div className="grid justify-items-start gap-4">
      <p aria-live="polite">{TEXT[status]}</p>
      {status !== "connecting" && status !== "connected" ? (
        <Button onPress={() => void connect()}>Try again</Button>
      ) : null}
    </div>
  );
}
