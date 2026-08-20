import { useMemo, useRef, useState } from "react";
import { CornerDownLeft, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useComposition } from "@/hooks/useComposition";
import { extractTags } from "@/core/markdown";
import { CATEGORY_LABEL, type Category, type Field, type Project } from "@/core/model";
import { cn } from "@/lib/utils";

const LAST_PROJECT_KEY = "quickadd-last-project";

export interface QuickAddProps {
  projects: Project[];
  fields: Field[];
  category: Category;
  onAdd: (input: { title: string; project: string; starred: boolean }) => void;
}

/**
 * The primary action of the whole app, so it is styled as one: a titled panel
 * with a filled button that says "Thêm", not a bare input with a plus icon.
 *
 * The earlier version sat unlabelled between two cards and people could not
 * tell it was where you type. Everything else here — remembering the last
 * project, accepting #tags inline, keeping focus after submit — exists to make
 * entering several tasks in a row cost nothing.
 */
export function QuickAdd({ projects, fields, category, onAdd }: QuickAddProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [starred, setStarred] = useState(false);

  const available = useMemo(
    () => projects.filter((p) => !p.archived && p.category === category),
    [projects, category]
  );

  const [project, setProject] = useState(
    () => localStorage.getItem(`${LAST_PROJECT_KEY}-${category}`) ?? ""
  );

  const effective =
    available.find((p) => p.code === project)?.code ??
    available.find((p) => p.code === (category === "WRK" ? "ETC" : "CN"))?.code ??
    available[0]?.code ??
    "";

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || !effective) return;
    onAdd({ title: trimmed, project: effective, starred });
    setTitle("");
    setStarred(false);
    localStorage.setItem(`${LAST_PROJECT_KEY}-${category}`, effective);
    // Keep the keyboard up so the next task can go straight in.
    inputRef.current?.focus();
  };

  const { isComposing: _isComposing, ...compositionHandlers } = useComposition<HTMLInputElement>({
    onKeyDown: (e) => {
      if (e.key === "Enter") submit();
    },
  });
  void _isComposing;

  const preview = extractTags(title);

  // Group the picker by field so a long project list stays navigable.
  const grouped = useMemo(() => {
    const byField = new Map<string, Project[]>();
    for (const p of available) {
      byField.set(p.field ?? "", [...(byField.get(p.field ?? "") ?? []), p]);
    }
    return [...byField.entries()].sort(([a], [b]) =>
      a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)
    );
  }, [available]);

  return (
    <section
      className={cn(
        "rounded-2xl border-2 p-4 shadow-sm transition-colors",
        category === "WRK"
          ? "border-wrk/35 bg-wrk-soft/40"
          : "border-per/35 bg-per-soft/40"
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-white",
            category === "WRK" ? "bg-wrk" : "bg-per"
          )}
        >
          <Plus className="size-4 stroke-[3]" />
        </span>
        <h2 className="text-base font-semibold">Thêm việc mới</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            category === "WRK" ? "bg-wrk/15 text-wrk" : "bg-per/15 text-per"
          )}
        >
          {CATEGORY_LABEL[category]}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="quick-add-input"
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          {...compositionHandlers}
          placeholder="Gõ việc cần làm rồi bấm Enter…"
          aria-label="Nội dung công việc mới"
          className="h-12 flex-1 border-2 bg-background text-base shadow-none focus-visible:ring-2"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
        />
        <Button
          onClick={submit}
          disabled={!title.trim() || !effective}
          size="lg"
          className={cn(
            "h-12 gap-2 px-6 text-base font-semibold text-white shadow-sm",
            category === "WRK" ? "bg-wrk hover:bg-wrk/90" : "bg-per hover:bg-per/90"
          )}
        >
          <Plus className="size-5 stroke-[2.5]" />
          Thêm
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Thuộc dự án</span>
        <Select value={effective} onValueChange={setProject}>
          <SelectTrigger
            className="h-9 w-auto min-w-[10rem] gap-1.5 border-2 bg-background text-sm"
            aria-label="Chọn dự án cho việc mới"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {grouped.map(([fieldCode, list]) => (
              <SelectGroup key={fieldCode || "none"}>
                <SelectLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  {fields.find((f) => f.code === fieldCode)?.name ?? "Chưa gán lĩnh vực"}
                </SelectLabel>
                {list.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setStarred((s) => !s)}
          aria-pressed={starred}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg border-2 px-3 text-sm transition-colors",
            starred
              ? "border-amber-400 bg-amber-400/15 font-medium text-amber-700 dark:text-amber-300"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className={cn("size-4", starred && "fill-current")} />
          Ưu tiên
        </button>

        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <CornerDownLeft className="size-3.5" />
          Enter để thêm nhanh
        </span>
      </div>

      {preview.tags.length > 0 && (
        <p className={cn("mt-2 text-xs", category === "WRK" ? "text-wrk" : "text-per")}>
          Sẽ gắn nhãn: {preview.tags.map((t) => `#${t}`).join(" ")}
        </p>
      )}
    </section>
  );
}
