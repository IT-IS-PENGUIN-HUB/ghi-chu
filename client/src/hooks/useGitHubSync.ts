import { useEffect, useRef } from "react";
import { pullIfStale, schedulePush, syncNow } from "@/core/sync";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";

/**
 * Wires the sync engine to the window's lifecycle.
 *
 * No interval timer by design: an app left open on the desktop with nothing
 * happening issues no requests at all. Work is triggered only by an edit, by
 * the window coming back to the front, or by the network returning.
 */
export function useGitHubSync(): void {
  const { pending, settings, ready } = useStore();
  const configured = Boolean(settings.owner && settings.repo && settings.token);
  const bootstrapped = useRef(false);

  // One pull on launch, so a device that was closed yesterday catches up.
  useEffect(() => {
    if (!ready || !configured || bootstrapped.current) return;
    bootstrapped.current = true;
    void syncNow();
  }, [ready, configured]);

  // Unpushed work exists -> schedule a debounced push.
  useEffect(() => {
    if (!configured || pending === 0) return;
    schedulePush();
  }, [configured, pending]);

  useEffect(() => {
    if (!configured) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") pullIfStale();
    };
    const onOnline = () => void syncNow();
    const onHide = () => {
      // Best effort: if the tab is being closed with edits queued, try to get
      // them out now. Data is safe in IndexedDB either way.
      if (document.visibilityState === "hidden" && store.getSnapshot().pending > 0) {
        void syncNow();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
    };
  }, [configured]);
}
