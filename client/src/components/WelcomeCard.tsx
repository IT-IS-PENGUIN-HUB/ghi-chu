import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Sparkles, X } from "lucide-react";
import { store } from "@/core/store";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "welcome-dismissed";

const STEPS = [
  "Chọn nhóm: Công việc hay Cá nhân",
  "Gõ việc vào ô bên dưới rồi bấm Enter",
  "Xong việc thì tick vào ô vuông bên trái",
];

/**
 * Shown only while the app is completely empty, which is exactly when someone
 * is looking at it for the first time and cannot tell where to start. It
 * disappears on its own once a task exists, so it never becomes clutter.
 */
export function WelcomeCard() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1"
  );

  if (dismissed) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Ẩn hướng dẫn"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <h2 className="pr-8 text-base font-semibold">Bắt đầu trong 3 bước</h2>

      <ol className="mt-3 space-y-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                "mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
                "bg-primary text-xs font-bold text-primary-foreground"
              )}
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            // Seeing one real row teaches more than any text: it shows the
            // checkbox, the day code, the age badge and the ⋮ menu at once.
            store.addTask({
              title: "Việc mẫu — tick ô vuông khi xong, bấm ⋮ để sửa hoặc xoá",
              category: "WRK",
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-transform active:scale-95"
        >
          <Sparkles className="size-4" />
          Thêm một việc mẫu để xem thử
        </button>
        <Link
          href="/huong-dan"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <BookOpen className="size-4" />
          Hướng dẫn đầy đủ
        </Link>
      </div>
    </section>
  );
}
