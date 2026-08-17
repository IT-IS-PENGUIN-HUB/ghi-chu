import { Link } from "wouter";
import { Check, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

/**
 * Sync status in one glyph. Says something useful in every state, including
 * "GitHub not set up yet", which is how the app starts.
 */
export function SyncBadge() {
  const { settings, pending, syncState } = useStore();
  const configured = Boolean(settings.owner && settings.repo && settings.token);

  if (!configured) {
    return (
      <Link
        href="/cai-dat"
        aria-label="Chưa kết nối GitHub — dữ liệu chỉ nằm trên máy này"
        title="Chưa kết nối GitHub — dữ liệu chỉ nằm trên máy này"
        className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        <CloudOff className="size-[1.125rem]" />
      </Link>
    );
  }

  if (syncState.status === "syncing") {
    return (
      <span
        aria-label="Đang đồng bộ"
        title="Đang đồng bộ"
        className="tap flex items-center justify-center text-muted-foreground"
      >
        <RefreshCw className="size-[1.125rem] animate-spin" />
      </span>
    );
  }

  if (syncState.status === "error") {
    return (
      <Link
        href="/cai-dat"
        aria-label={`Lỗi đồng bộ: ${syncState.message}`}
        title={`Lỗi đồng bộ: ${syncState.message}`}
        className="tap flex items-center justify-center rounded-lg text-destructive"
      >
        <TriangleAlert className="size-[1.125rem]" />
      </Link>
    );
  }

  return (
    <span
      aria-label={pending > 0 ? `${pending} thay đổi chờ đẩy lên` : "Đã đồng bộ"}
      title={pending > 0 ? `${pending} thay đổi chờ đẩy lên` : "Đã đồng bộ"}
      className={cn(
        "tap flex items-center justify-center",
        pending > 0 ? "text-amber-500" : "text-done"
      )}
    >
      {pending > 0 ? (
        <span className="relative flex size-[1.125rem] items-center justify-center">
          <RefreshCw className="size-[1.125rem]" />
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-500" />
        </span>
      ) : (
        <Check className="size-[1.125rem]" />
      )}
    </span>
  );
}
