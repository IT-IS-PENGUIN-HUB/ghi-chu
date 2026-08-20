import { useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { isDesktop, setAlwaysOnTop } from "@/lib/tauri";
import { cn } from "@/lib/utils";

/**
 * The "floating note" switch — desktop app only.
 *
 * Pinned, the window stays above every other application: the checklist sits
 * beside your CAD/Excel window like a paper sticky note. Rendered nowhere in
 * the browser, where the capability does not exist.
 */
export function PinToggle() {
  const [pinned, setPinned] = useState(false);

  if (!isDesktop()) return null;

  const toggle = async () => {
    const next = !pinned;
    try {
      await setAlwaysOnTop(next);
      setPinned(next);
      toast.success(next ? "Đã ghim — cửa sổ luôn nổi trên cùng" : "Đã bỏ ghim", {
        duration: 2000,
      });
    } catch {
      toast.error("Không ghim được cửa sổ");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={pinned}
      aria-label={pinned ? "Bỏ ghim cửa sổ" : "Ghim cửa sổ luôn nổi trên cùng"}
      title={pinned ? "Bỏ ghim" : "Ghim nổi trên cùng"}
      className={cn(
        "tap flex items-center justify-center rounded-lg transition-colors",
        pinned
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {pinned ? <Pin className="size-[1.125rem]" /> : <PinOff className="size-[1.125rem]" />}
    </button>
  );
}
