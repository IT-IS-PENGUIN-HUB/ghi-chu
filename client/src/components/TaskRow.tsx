import { memo, useEffect, useRef, useState } from "react";
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

  // ------------------------------------------------------------- swipe -----
  // Swipe right = done, swipe left = delete — the pattern every major todo
  // app trained people on. `touch-action: pan-y` leaves vertical scrolling to
  // the browser, so only a clearly horizontal drag reaches this code, and the
  // delete side is safe because deletes go through an undo toast.
  const SWIPE_TRIGGER = 72;
  const [dragX, setDragX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const touchRef = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (editing) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, locked: null };
    setSnapping(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const start = touchRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Decide once, after ~10px of movement, whether this is a swipe or a scroll.
    if (start.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      start.locked = Math.abs(dx) > Math.abs(dy);
    }
    if (start.locked) setDragX(Math.max(-112, Math.min(112, dx)));
  };

  const onTouchEnd = () => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start?.locked) return setDragX(0);
    setSnapping(true);
    if (dragX >= SWIPE_TRIGGER) {
      navigator.vibrate?.(10);
      onToggle(task.id);
    } else if (dragX <= -SWIPE_TRIGGER) onDelete(task.id);
    setDragX(0);
  };

  return (
    <div className="relative">
      {/* Layer revealed behind the card while swiping. */}
      {dragX !== 0 && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center justify-between rounded-xl px-5",
            dragX > 0 ? "bg-done/85" : "bg-destructive/85"
          )}
        >
          <Check className={cn("size-5 text-white", dragX <= 0 && "opacity-0")} />
          <Trash2 className={cn("size-5 text-white", dragX >= 0 && "opacity-0")} />
        </div>
      )}

      <div
        data-task-id={task.id}
        style={{
          borderLeftColor: edge,
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          touchAction: "pan-y",
        }}
        className={cn(
          // A coloured left edge tells you the group at a glance without reading
          // anything, which is what makes a long mixed list scannable.
          "group flex items-start gap-2 rounded-xl border border-l-4 py-2.5 pl-1 pr-3 shadow-sm transition-colors no-tap-highlight",
          snapping && "transition-transform duration-200",
          task.done
            ? "border-border/60 bg-done-soft/50"
            : task.category === "WRK"
              ? "border-border bg-card hover:border-wrk/50"
              : "border-border bg-card hover:border-per/50",
          selected && "ring-2 ring-ring ring-offset-1 ring-offset-background"
        )}
        onClick={() => onFocus?.(task.id)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* The checkbox is the most-used control in the app, so it gets a
            finger-sized (44px) hit area; the visible box stays modest. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.vibrate?.(10);
            onToggle(task.id);
          }}
          aria-label={task.done ? "Bỏ đánh dấu hoàn thành" : "Đánh dấu hoàn thành"}
          className="tap flex shrink-0 items-start justify-center pt-0.5"
        >
          <Checkbox
            checked={task.done}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none size-6"
          />
        </button>

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
                title={
                  label.includes("-")
                    ? "Mã việc cố định — dùng để tra cứu lâu dài"
                    : "Số thứ tự hôm nay — tự đánh lại mỗi ngày"
                }
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
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
                onDoubleClick={() => !task.done && setEditing(true)}
                title={task.done ? undefined : "Bấm đúp để sửa"}
                className={cn(
                  "min-w-0 break-words text-base leading-snug",
                  task.done && "text-muted-foreground line-through"
                )}
              >
                {task.title}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {project && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                  {project.name}
                </span>
              )}
              <span className="font-mono tabular-nums" title="Mã việc cố định — dùng để tra cứu lâu dài">{task.id}</span>
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
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
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
    </div>
  );
}

export const TaskRow = memo(TaskRowInner);
