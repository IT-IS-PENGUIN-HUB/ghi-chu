/**
 * Bridge to the desktop shell.
 *
 * The web build stays byte-identical whether it runs in a browser or inside
 * Tauri: no Tauri npm packages are imported. When the desktop shell hosts the
 * page (`withGlobalTauri`), it injects `window.__TAURI__`, and these helpers
 * light up; in a browser they report "not desktop" and the UI hides itself.
 */

interface TauriWindow {
  setAlwaysOnTop(onTop: boolean): Promise<void>;
}

interface TauriGlobal {
  window: { getCurrentWindow(): TauriWindow };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function setAlwaysOnTop(onTop: boolean): Promise<void> {
  await window.__TAURI__?.window.getCurrentWindow().setAlwaysOnTop(onTop);
}
