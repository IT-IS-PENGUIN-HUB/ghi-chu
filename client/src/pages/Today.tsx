import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ClockAlert, ListTodo, Sparkles } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskRow } from "@/components/TaskRow";
import { DayNoteEditor } from "@/components/DayNoteEditor";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildDailyList, type SortMode } from "@/core/codes";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  toDateKey,
  type Category,
  type Task,
} from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

const SORT_LABEL: Record<SortMode, string> = {
  age: "Cũ nhất trước",
  recent: "Mới nhất trước",
  project: "Theo dự án",
};

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export default function Today() {
  const { tasks, projects, fields, days, ready } = useStore();
  const [category, setCategory] = useState<Category>("WRK");
  const [sort, setSort] = useState<SortMode>("age");
  const [selected, setSelected] = useState<string | null>(null);

  const today = toDateKey(new Date());
  const projectByCode = useMemo(
    () => new Map(projects.map((p) => [p.code, p])),
    [projects]
  );

  const open = useMemo(() => buildDailyList(tasks, category, sort), [tasks, category, sort]);

  // Only work finished today — yesterday's completions belong to the archive,
  // not to a list you are trying to clear.
  const doneToday = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.done &&
            t.category === category &&
            t.completed?.slice(0, 10).replace(/\./g, "-") === today
        )
        .sort((a, b) => (b.completed ?? "").localeCompare(a.completed ?? "")),
    [tasks, category, today]
  );

  const note = days.find((d) => d.date === today)?.body ?? "";

  const onToggle = useCallback((id: string) => store.toggleTask(id), []);
  const onRename = useCallback((id: string, title: string) => store.updateTask(id, { title }), []);
  const onStar = useCallback((id: string, starred: boolean) => store.updateTask(id, { starred }), []);
  const onDelete = useCallback((id: string) => store.deleteTask(id), []);
  const onMove = useCallback((id: string, project: string) => store.moveTask(id, project), []);
  const onAdd = useCallback(
    (input: { title: string; project: string; starred: boolean }) => store.addTask(input),
    []
  );

  useKeyboardShortcuts({ open, selected, setSelected, onToggle });

  if (!ready) {
    return <div className="py-16 text-center text-muted-foreground">Đang mở dữ liệu…</div>;
  }

  const now = new Date();
  const stale = open.filter((e) => isStale(e.task)).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hôm nay</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {WEEKDAYS[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1}/{now.getFullYear()}
          {" · "}
          {open.length} việc còn lại
          {doneToday.length > 0 && ` · ${doneToday.length} đã xong`}
        </p>
      </header>

      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="grid w-full grid-cols-2">
          {CATEGORIES.map((c) => {
            const count = tasks.filter((t) => !t.done && t.category === c).length;
            return (
              <TabsTrigger key={c} value={c} className="gap-1.5">
                {CATEGORY_LABEL[c]}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    c === "WRK" ? "bg-wrk-soft text-wrk" : "bg-per-soft text-per"
                  )}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <QuickAdd projects={projects} fields={fields} category={category} onAdd={onAdd} />

      {stale > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <ClockAlert className="size-4 shrink-0" />
          {stale} việc đã tồn quá 7 ngày
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Việc cần làm</h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Sắp xếp"
          className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground"
        >
          {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {SORT_LABEL[mode]}
            </option>
          ))}
        </select>
      </div>

      {open.length === 0 ? (
        <EmptyState category={category} hasAny={tasks.some((t) => t.category === category)} />
      ) : (
        <ul className="space-y-2">
          {open.map(({ task, daily }) => (
            <li key={task.id}>
              <TaskRow
                task={task}
                label={daily}
                project={projectByCode.get(task.project)}
                projects={projects}
                selected={selected === task.id}
                onToggle={onToggle}
                onRename={onRename}
                onStar={onStar}
                onDelete={onDelete}
                onMove={onMove}
                onFocus={setSelected}
              />
            </li>
          ))}
        </ul>
      )}

      {doneToday.length > 0 && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
            Đã xong hôm nay ({doneToday.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ul className="space-y-2">
              {doneToday.map((task) => (
                <li key={task.id}>
                  <TaskRow
                    task={task}
                    label={task.id}
                    project={projectByCode.get(task.project)}
                    projects={projects}
                    onToggle={onToggle}
                    onRename={onRename}
                    onStar={onStar}
                    onDelete={onDelete}
                    onMove={onMove}
                  />
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      <DayNoteEditor
        date={today}
        value={note}
        onChange={(body) => store.setDayNote(today, body)}
      />
    </div>
  );
}

function isStale(task: Task): boolean {
  const created = new Date(
    Number(task.created.slice(0, 4)),
    Number(task.created.slice(5, 7)) - 1,
    Number(task.created.slice(8, 10))
  );
  return (Date.now() - created.getTime()) / 86_400_000 >= 7;
}

function EmptyState({ category, hasAny }: { category: Category; hasAny: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-10 text-center">
      {hasAny ? (
        <>
          <Sparkles className="mx-auto mb-2 size-6 text-done" />
          <p className="text-sm font-medium">Xong hết rồi</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Không còn việc {CATEGORY_LABEL[category].toLowerCase()} nào đang tồn.
          </p>
        </>
      ) : (
        <>
          <ListTodo className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Chưa có việc nào. Gõ vào ô phía trên để thêm.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Desktop keyboard navigation. Bound on the window rather than per-row so it
 * works without clicking into the list first, and disabled while a field has
 * focus so typing never triggers an action.
 */
function useKeyboardShortcuts({
  open,
  selected,
  setSelected,
  onToggle,
}: {
  open: Array<{ task: Task }>;
  selected: string | null;
  setSelected: (id: string | null) => void;
  onToggle: (id: string) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const index = open.findIndex((e2) => e2.task.id === selected);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(open[Math.min(index + 1, open.length - 1)]?.task.id ?? null);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(open[Math.max(index - 1, 0)]?.task.id ?? null);
      } else if (e.key === " " && selected) {
        e.preventDefault();
        onToggle(selected);
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selected, setSelected, onToggle]);
}
