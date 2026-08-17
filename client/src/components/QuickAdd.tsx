import { useMemo, useRef, useState } from "react";
import { Plus, Star } from "lucide-react";
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
 * The single most-used control, so it is tuned for one-handed phone use:
 * remembers the last project, accepts `#tag` inline, and never blocks on
 * anything. Enter adds and keeps focus so several tasks can go in a row.
 */
export function QuickAdd({ projects, fields, category, onAdd }: QuickAddProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [starred, setStarred] = useState(false);

  const available = useMemo(
    () => projects.filter((p) => !p.archived && p.category === category),
    [projects, category]
  );

  // Remembering the last project makes the common case — several tasks for the
  // job you are already looking at — zero extra taps.
  const [project, setProject] = useState(() => {
    const remembered = localStorage.getItem(`${LAST_PROJECT_KEY}-${category}`);
    return remembered ?? "";
  });

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
    // Keep the keyboard up so the next task can be typed straight away.
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
      const key = p.field ?? "";
      byField.set(key, [...(byField.get(key) ?? []), p]);
    }
    return [...byField.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [available]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          {...compositionHandlers}
          placeholder={`Thêm việc ${CATEGORY_LABEL[category].toLowerCase()}… (gõ #nhãn nếu cần)`}
          aria-label="Nội dung công việc mới"
          className="h-11 flex-1"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
        />
        <Button
          onClick={submit}
          disabled={!title.trim() || !effective}
          className="tap h-11 px-4"
          aria-label="Thêm công việc"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={effective} onValueChange={setProject}>
          <SelectTrigger className="h-9 w-auto min-w-[9rem] gap-1.5 text-sm" aria-label="Dự án">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {grouped.map(([fieldCode, list]) => (
              <SelectGroup key={fieldCode || "none"}>
                <SelectLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
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
          aria-label="Đánh dấu ưu tiên"
          className={cn(
            "tap flex items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors",
            starred
              ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className={cn("size-4", starred && "fill-current")} />
          Ưu tiên
        </button>

        {preview.tags.length > 0 && (
          <span className="text-xs text-muted-foreground">
            nhãn: {preview.tags.map((t) => `#${t}`).join(" ")}
          </span>
        )}
      </div>
    </div>
  );
}
