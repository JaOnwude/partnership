"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/app/(app)/account/push-actions";
import { btn, btnGhost } from "./ui";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "install-first" | "blocked" | "off" | "on";

export function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iPhones only allow notifications once the app is added to the home screen.
        setState(ios && !standalone ? "install-first" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      setState("on");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-sm text-foreground/60">Checking…</p>;
  if (state === "unsupported") return <p className="text-sm">This browser can&apos;t show notifications.</p>;
  if (state === "install-first") {
    return (
      <p className="text-sm">
        On iPhone, first tap the Share button <span aria-hidden>⎋</span> then <strong>Add to Home Screen</strong>. Open
        Partnership from your home screen and turn notifications on here.
      </p>
    );
  }
  if (state === "blocked") {
    return <p className="text-sm">Notifications are blocked. Allow them for this site in your phone&apos;s browser settings.</p>;
  }

  return state === "on" ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-green-800">Notifications are on for this phone.</span>
      <button type="button" className={btnGhost} disabled={busy} onClick={turnOff}>Turn off</button>
      <button
        type="button"
        className={btnGhost}
        onClick={async () => {
          await sendTestNotification();
          setTested(true);
        }}
      >
        {tested ? "Test sent" : "Send a test"}
      </button>
    </div>
  ) : (
    <div className="space-y-2">
      <p className="text-sm">Get a notification when your payment is confirmed, your payout is sent, or there&apos;s news.</p>
      <button type="button" className={btn} disabled={busy} onClick={turnOn}>Turn on notifications</button>
    </div>
  );
}
