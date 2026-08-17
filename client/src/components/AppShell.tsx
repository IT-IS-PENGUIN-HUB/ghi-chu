import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
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
 * Bottom bar on phones (thumb reach), top bar on desktop.
 *
 * The content column is wide enough to use a large monitor properly — the
 * earlier 768px cap left most of the screen empty — while still capping line
 * length so the note editor stays readable.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Desktop / tablet header */}
      <header className="pt-safe sticky top-0 z-40 hidden border-b border-border bg-background/85 backdrop-blur-md sm:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-5">
          <Link href="/" className="mr-4 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare className="size-4 stroke-[2.5]" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">Ghi chú</span>
          </Link>

          {NAV.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(path)
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}

          <div className="ml-auto flex items-center gap-0.5">
            <IconLink href="/tim-kiem" label="Tìm kiếm" icon={Search} active={isActive("/tim-kiem")} />
            <IconLink href="/huong-dan" label="Hướng dẫn" icon={BookOpen} active={isActive("/huong-dan")} />
            <SyncBadge />
            <ThemeToggle />
            <IconLink href="/cai-dat" label="Cài đặt" icon={Settings} active={isActive("/cai-dat")} />
          </div>
        </div>
      </header>

      {/* Mobile header — only the controls that cannot live in the bottom bar. */}
      <header className="pt-safe sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md sm:hidden">
        <div className="flex h-13 items-center gap-1 px-3 py-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare className="size-3.5 stroke-[2.5]" />
            </span>
            <span className="font-bold tracking-tight">Ghi chú</span>
          </Link>
          <div className="ml-auto flex items-center gap-0.5">
            <IconLink href="/tim-kiem" label="Tìm kiếm" icon={Search} active={isActive("/tim-kiem")} />
            <IconLink href="/huong-dan" label="Hướng dẫn" icon={BookOpen} active={isActive("/huong-dan")} />
            <SyncBadge />
            <ThemeToggle />
            <IconLink href="/cai-dat" label="Cài đặt" icon={Settings} active={isActive("/cai-dat")} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 sm:px-5 sm:pb-10">
        {children}
      </main>

      {/* Mobile bottom bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md sm:hidden">
        <div className="flex">
          {NAV.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              aria-current={isActive(path) ? "page" : undefined}
              className={cn(
                "no-tap-highlight flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                isActive(path) ? "font-semibold text-primary" : "text-muted-foreground"
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
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-[18px]" />
    </Link>
  );
}
