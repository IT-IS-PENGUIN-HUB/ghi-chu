import { useEffect, useState } from "react";
import { Power } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isAutostartEnabled, isDesktop, setAutostart } from "@/lib/tauri";

/**
 * "Start with Windows" — desktop app only.
 *
 * Renders nothing in the browser/PWA, where the OS launcher does not exist.
 * When on, Windows launches the app minimised straight to the tray, so the
 * floating note is a shortcut away every login without a window popping up.
 */
export function AutostartToggle() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    isAutostartEnabled()
      .then(v => setEnabled(v))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!isDesktop()) return null;

  const toggle = async (next: boolean) => {
    try {
      await setAutostart(next);
      setEnabled(next);
      toast.success(
        next
          ? "Sẽ khởi động cùng Windows, ẩn sẵn trong khay"
          : "Đã tắt khởi động cùng Windows",
        { duration: 2500 }
      );
    } catch {
      toast.error("Không đổi được thiết lập khởi động");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Power className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Ứng dụng desktop</h2>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <div className="pr-3">
          <Label htmlFor="autostart" className="font-normal">
            Khởi động cùng Windows
          </Label>
          <p className="text-xs text-muted-foreground">
            Bật máy là app tự chạy, <b>ẩn sẵn trong khay hệ thống</b> — bấm icon
            khay hoặc phím tắt để mở ra.
          </p>
        </div>
        <Switch
          id="autostart"
          checked={enabled}
          disabled={!ready}
          onCheckedChange={v => void toggle(v)}
        />
      </div>
    </section>
  );
}
