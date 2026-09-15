import { useCallback, useState, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HelpItem {
  label: ReactNode;
  text: ReactNode;
}

/**
 * A "what does this screen do" panel, one per page.
 *
 * Exists because a checklist app is used in bursts: after three weeks away
 * the labels are gone from memory and every icon looks the same. The panel is
 * off by default so it never nags, and its open state sticks per screen so
 * someone relearning the app can leave it up for a day.
 */
export function useScreenHelp(id: string) {
  const key = `help-open-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setOpen(o => {
      const next = !o;
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Private mode — the panel still works, it just does not remember.
      }
      return next;
    });
  }, [key]);

  return { open, toggle };
}

export function HelpButton({
  open,
  toggle,
}: {
  open: boolean;
  toggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={open}
      aria-label="Giải thích màn hình này"
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-medium transition-colors",
        open
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
      )}
    >
      <CircleHelp className="size-4" />
      {open ? "Ẩn giải thích" : "Giải thích"}
    </button>
  );
}

export function HelpPanel({
  open,
  toggle,
  items,
  children,
}: {
  open: boolean;
  toggle: () => void;
  items: HelpItem[];
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <section className="relative rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 pr-11">
      <button
        type="button"
        onClick={toggle}
        aria-label="Ẩn giải thích"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      {children}
      <ul className="space-y-2 text-sm leading-relaxed">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>
              <b>{item.label}</b> — {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
