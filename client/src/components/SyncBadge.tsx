import { type ReactNode } from "react";
import { Link } from "wouter";
import { Check, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

/**
 * Sync status in one glyph, plus the words on a wide screen.
 *
 * Says something useful in every state, including "GitHub not set up yet",
 * which is how the app starts. The text exists because a crossed-out cloud
 * turned out to mean nothing to anyone — "Chưa kết nối" does.
 */
export function SyncBadge() {
  const { settings, pending, syncState } = useStore();
  const configured = Boolean(settings.owner && settings.repo && settings.token);

  let icon: ReactNode;
  let text: string;
  let title: string;
  let tone: string;
  let href: string | null = null;

  if (!configured) {
    icon = <CloudOff className="size-[1.125rem]" />;
    text = "Chưa kết nối";
    title =
      "Chưa kết nối GitHub — dữ liệu chỉ nằm trên máy này. Bấm để vào Cài đặt.";
    tone = "text-muted-foreground hover:bg-accent hover:text-foreground";
    href = "/cai-dat";
  } else if (syncState.status === "syncing") {
    icon = <RefreshCw className="size-[1.125rem] animate-spin" />;
    text = "Đang đồng bộ";
    title = "Đang đồng bộ với GitHub";
    tone = "text-muted-foreground";
  } else if (syncState.status === "error") {
    icon = <TriangleAlert className="size-[1.125rem]" />;
    text = "Lỗi đồng bộ";
    title = `Lỗi đồng bộ: ${syncState.message}. Bấm để xem trong Cài đặt.`;
    tone = "text-destructive hover:bg-accent";
    href = "/cai-dat";
  } else if (pending > 0) {
    icon = (
      <span className="relative flex size-[1.125rem] items-center justify-center">
        <RefreshCw className="size-[1.125rem]" />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-500" />
      </span>
    );
    text = `${pending} chờ đẩy lên`;
    title = `${pending} thay đổi chờ đẩy lên GitHub — tự đẩy sau vài giây`;
    tone = "text-amber-500";
  } else {
    icon = <Check className="size-[1.125rem]" />;
    text = "Đã đồng bộ";
    title = "Đã đồng bộ với GitHub";
    tone = "text-done";
  }

  const className = cn(
    "tap flex items-center justify-center gap-1.5 rounded-lg transition-colors lg:px-2.5",
    tone
  );
  const body = (
    <>
      {icon}
      <span className="hidden whitespace-nowrap text-sm lg:inline">{text}</span>
    </>
  );

  return href ? (
    <Link href={href} aria-label={title} title={title} className={className}>
      {body}
    </Link>
  ) : (
    <span aria-label={title} title={title} className={className}>
      {body}
    </span>
  );
}
