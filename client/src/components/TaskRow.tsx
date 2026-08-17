import { memo, useEffect, useState } from "react";
import { Check, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useComposition } from "@/hooks/useComposition";
import { ageInDays, type Project, type Task } from "@/core/model";
import { cn } from "@/lib/utils";

export interface TaskRowProps {
  task: Task;
  /** "WRK_01" — today's position, or the permanent id on archive screens. */
  label: string;
  project?: Project;
  projects?: Project[];
  selected?: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onStar: (id: string, starred: boolean) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, project: string) => void;
  onFocus?: (id: string) => void;
}

/**
 * One task.
 *
 * Declared at module scope and memoised on purpose: the previous version
 * defined this inside the list component, so every keystroke remounted the row
 * and the edit field lost focus after a single character on iOS.
 */
function TaskRowInner({
  task,
  label,
  project,
  projects,
  selected,
  onToggle,
  onRename,
  onStar,
  onDelete,
  onMove,
  onFocus,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  useEffect(() => {
    if (editing) setDraft(task.title);
  }, [editing, task.title]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== task.title) onRename(task.id, next);
    setEditing(false);
  };

  // Vietnamese and Japanese input methods fire Enter to accept a candidate
  // word; without this guard that Enter would commit a half-typed title.
  const { isComposing: _isComposing, ...compositionHandlers } = useComposition<HTMLInputElement>({
    onKeyDown: (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") setEditing(false);
    },
  });
  void _isComposing;

  const age = ageInDays(task.created);

  // The left edge colour is set inline rather than with a `border-l-<colour>`
  // class: tailwind-merge does not know `wrk`/`per`/`done` are colours, so it
  // treats that class as conflicting with `border-l-4` and silently drops it.
  const edge = task.done ? "var(--done)" : task.category === "WRK" ? "var(--wrk)" : "var(--per)";

  return (
    <div
      data-task-id={task.id}
      style={{ borderLeftColor: edge }}
      className={cn(
        // A coloured left edge tells you the group at a glance without reading
        // anything, which is what makes a long mixed list scannable.
        "group flex items-start gap-3 rounded-xl border border-l-4 px-3 py-2.5 shadow-sm transition-colors no-tap-highlight",
        task.done
          ? "border-border/60 bg-done-soft/50"
          : task.category === "WRK"
            ? "border-border bg-card hover:border-wrk/50"
            : "border-border bg-card hover:border-per/50",
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-background"
      )}
      onClick={() => onFocus?.(task.id)}
    >
      <Checkbox
        checked={task.done}
        onCheckedChange={() => onToggle(task.id)}
        aria-label={task.done ? "Bỏ đánh dấu hoàn thành" : "Đánh dấu hoàn thành"}
        className="mt-0.5 size-5 shrink-0"
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            {...compositionHandlers}
            className="h-9"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                  task.done
                    ? "bg-muted text-muted-foreground"
                    : task.category === "WRK"
                      ? "bg-wrk-soft text-wrk"
                      : "bg-per-soft text-per"
                )}
              >
                {label}
              </span>
              {task.starred && !task.done && (
                <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
              )}
              <span
                className={cn(
                  "min-w-0 break-words text-[15px] leading-snug",
                  task.done && "text-muted-foreground line-through"
                )}
              >
                {task.title}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {project && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                  {project.name}
                </span>
              )}
              <span className="font-mono tabular-nums">{task.id}</span>
              {task.done ? (
                <span className="tabular-nums text-done">
                  ✓ xong {task.completed?.slice(0, 10) ?? ""}
                </span>
              ) : (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-medium tabular-nums",
                    // Three steps, because "how long has this been sitting
                    // there" is the question the timestamp exists to answer.
                    age === 0
                      ? "bg-done-soft text-done"
                      : age < 7
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/10 text-destructive"
                  )}
                  title={`Thêm lúc ${task.created}`}
                >
                  {age === 0 ? "hôm nay" : `+${age} ngày`}
                </span>
              )}
              {task.tags?.map((tag) => (
                <span key={tag} className="text-muted-foreground/80">
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {!editing && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Tuỳ chọn"
            className="tap -mr-1 flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="mr-2 size-4" /> Sửa nội dung
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStar(task.id, !task.starred)}>
              <Star className="mr-2 size-4" />
              {task.starred ? "Bỏ ưu tiên" : "Đánh dấu ưu tiên"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggle(task.id)}>
              <Check className="mr-2 size-4" />
              {task.done ? "Mở lại" : "Đánh dấu xong"}
            </DropdownMenuItem>

            {onMove && projects && projects.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Chuyển dự án</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    {projects
                      .filter((p) => !p.archived && p.code !== task.project)
                      .map((p) => (
                        <DropdownMenuItem key={p.code} onClick={() => onMove(task.id, p.code)}>
                          <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                            {p.code}
                          </span>
                          {p.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(task.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" /> Xoá
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export const TaskRow = memo(TaskRowInner);
