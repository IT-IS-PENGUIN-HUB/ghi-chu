import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarDays,
  CheckSquare,
  FolderTree,
  Phone,
  Search,
  Settings,
} from "lucide-react";
import { SyncBadge } from "@/components/SyncBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/", label: "Hôm nay", icon: CheckSquare },
  { path: "/du-an", label: "Dự án", icon: FolderTree },
  { path: "/lich-su", label: "Lịch sử", icon: CalendarDays },
  { path: "/danh-ba", label: "Danh bạ", icon: Phone },
] as const;

/**
 * Bottom bar on phones (thumb reach), top bar on desktop. No collapsible
 * sidebar: with four destinations it would be chrome for its own sake, and it
 * was the single largest piece of the old layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Desktop / tablet header */}
      <header className="pt-safe sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur sm:block">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-4">
          <span className="mr-3 font-semibold tracking-tight">Ghi chú</span>
          {NAV.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                isActive(path)
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <IconLink href="/tim-kiem" label="Tìm kiếm" icon={Search} active={isActive("/tim-kiem")} />
            <SyncBadge />
            <ThemeToggle />
            <IconLink href="/cai-dat" label="Cài đặt" icon={Settings} active={isActive("/cai-dat")} />
          </div>
        </div>
      </header>

      {/* Mobile header — compact, only the controls that cannot live in the
          bottom bar. */}
      <header className="pt-safe sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur sm:hidden">
        <div className="flex h-12 items-center gap-1 px-3">
          <span className="font-semibold tracking-tight">Ghi chú</span>
          <div className="ml-auto flex items-center gap-0.5">
            <IconLink href="/tim-kiem" label="Tìm kiếm" icon={Search} active={isActive("/tim-kiem")} />
            <SyncBadge />
            <ThemeToggle />
            <IconLink href="/cai-dat" label="Cài đặt" icon={Settings} active={isActive("/cai-dat")} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-28 sm:pb-10">
        {children}
      </main>

      {/* Mobile bottom bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <div className="flex">
          {NAV.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              aria-current={isActive(path) ? "page" : undefined}
              className={cn(
                "no-tap-highlight flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                isActive(path) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("size-5", isActive(path) && "stroke-[2.5]")} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function IconLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Search;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "tap flex items-center justify-center rounded-lg transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-[18px]" />
    </Link>
  );
}
