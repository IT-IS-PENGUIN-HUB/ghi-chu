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
  core: { invoke<T = unknown>(cmd: string): Promise<T> };
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

// Start-with-Windows, via the autostart plugin's commands. Called through the
// global core.invoke so the web build still imports no Tauri npm package.
export async function isAutostartEnabled(): Promise<boolean> {
  return (
    (await window.__TAURI__?.core.invoke<boolean>(
      "plugin:autostart|is_enabled"
    )) ?? false
  );
}

export async function setAutostart(on: boolean): Promise<void> {
  await window.__TAURI__?.core.invoke(
    on ? "plugin:autostart|enable" : "plugin:autostart|disable"
  );
}
