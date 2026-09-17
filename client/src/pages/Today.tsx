import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClockAlert,
  ListTodo,
  NotebookPen,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskRow } from "@/components/TaskRow";
import { DayNoteEditor } from "@/components/DayNoteEditor";
import {
  HelpButton,
  HelpPanel,
  useScreenHelp,
  type HelpItem,
} from "@/components/ScreenHelp";
import { WelcomeCard } from "@/components/WelcomeCard";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { buildDailyList, type DailyEntry, type SortMode } from "@/core/codes";
import { ageInDays, toDateKey, type Category, type Task } from "@/core/model";
import { store } from "@/core/store";
import { deleteTaskWithUndo, toggleTaskWithUndo } from "@/lib/taskActions";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

/** "ALL" merges both phạm trù into one list; the two real ones filter to it. */
type View = Category | "ALL";

const SORT_LABEL: Record<SortMode, string> = {
  age: "Cũ nhất trước",
  recent: "Mới nhất trước",
  project: "Theo phân nhánh",
};

const WEEKDAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const VIEW_LABEL: Record<View, string> = {
  WRK: "Công việc",
  PER: "Cá nhân",
  ALL: "Tất cả",
};

const HELP: HelpItem[] = [
  {
    label: "Công việc · Cá nhân · Tất cả",
    text: "hai phạm trù việc riêng, bấm để chuyển. “Tất cả” gộp cả hai vào một danh sách — viền màu bên trái mỗi việc cho biết nó thuộc phạm trù nào.",
  },
  {
    label: "Thêm việc mới",
    text: "gõ rồi bấm Enter. Chọn nơi cất việc theo hai bước: “Dự án” rồi “Phân nhánh” trong dự án đó; chưa có thì bấm “＋ Tạo … mới” ngay tại đó.",
  },
  {
    label: "Ô vuông bên trái mỗi việc",
    text: "tick khi xong. Trên điện thoại: vuốt sang phải = xong, vuốt sang trái = xoá. Lỡ tay thì bấm Hoàn tác.",
  },
  {
    label: "WORK_01 / HOME_01",
    text: (
      <>
        số thứ tự trong danh sách <b>hôm nay</b>, tự đánh lại mỗi sáng. Mã cố
        định để tra cứu lâu dài (kiểu{" "}
        <code className="font-mono">ALP-0042</code>) nằm trong menu ⋮ → Sao chép
        mã.
      </>
    ),
  },
  {
    label: "+3 ngày",
    text: "việc đã nằm trong danh sách bao lâu. Đỏ là quá 7 ngày — nên làm hoặc xoá.",
  },
  {
    label: "Nút ⋮ cuối dòng",
    text: "sửa nội dung, đánh dấu ưu tiên, chuyển sang phân nhánh khác, sao chép mã, xoá.",
  },
  {
    label: "Ghi chú hôm nay",
    text: "sổ tay tự do của ngày (khác checklist): nội dung họp, số liệu, ý tưởng. Ngày cũ có ghi chú hiện ở “Ghi chú gần đây” ngay dưới, hoặc tìm bằng Tìm kiếm / màn Lịch sử.",
  },
];

/** First line of a note body, flattened, for the recent-notes preview. */
function noteExcerpt(body: string): string {
  return body.trim().replace(/\s+/g, " ").slice(0, 100);
}

/** Reorders a merged (multi-category) list without disturbing daily labels. */
function sortMerged(entries: DailyEntry[], sort: SortMode): DailyEntry[] {
  const cmp: Record<SortMode, (a: DailyEntry, b: DailyEntry) => number> = {
    age: (a, b) => a.task.created.localeCompare(b.task.created),
    recent: (a, b) => b.task.created.localeCompare(a.task.created),
    project: (a, b) =>
      a.task.project.localeCompare(b.task.project) ||
      a.task.created.localeCompare(b.task.created),
  };
  return [...entries].sort((a, b) => {
    if (Boolean(a.task.starred) !== Boolean(b.task.starred))
      return a.task.starred ? -1 : 1;
    return cmp[sort](a, b);
  });
}

export default function Today() {
  const { tasks, projects, fields, days, ready } = useStore();
  const help = useScreenHelp("today");
  // Default to the combined list: most days you want to see everything, and
  // the coloured edge already tells the two phạm trù apart.
  const [view, setView] = useState<View>("ALL");
  const [sort, setSort] = useState<SortMode>("age");
  const [selected, setSelected] = useState<string | null>(null);

  const today = toDateKey(new Date());
  const projectByCode = useMemo(
    () => new Map(projects.map(p => [p.code, p])),
    [projects]
  );
  // project code -> the name of the dự án it sits in, for the row's "dự án › dự
  // án" tag. Undefined for a project not filed under any dự án.
  const fieldNameByProject = useMemo(() => {
    const byCode = new Map(fields.map(f => [f.code, f.name]));
    return new Map(
      projects.map(p => [p.code, p.field ? byCode.get(p.field) : undefined])
    );
  }, [projects, fields]);

  const open = useMemo(() => {
    if (view === "ALL") {
      return sortMerged(
        [
          ...buildDailyList(tasks, "WRK", sort),
          ...buildDailyList(tasks, "PER", sort),
        ],
        sort
      );
    }
    return buildDailyList(tasks, view, sort);
  }, [tasks, view, sort]);

  // Only work finished today — yesterday's completions belong to the archive,
  // not to a list you are trying to clear.
  const doneToday = useMemo(
    () =>
      tasks
        .filter(
          t =>
            t.done &&
            (view === "ALL" || t.category === view) &&
            t.completed?.slice(0, 10).replace(/\./g, "-") === today
        )
        .sort((a, b) => (b.completed ?? "").localeCompare(a.completed ?? "")),
    [tasks, view, today]
  );

  const note = days.find(d => d.date === today)?.body ?? "";
  // Past days that have a note, most recent first — surfaced on the main screen
  // so a note written weeks ago is not lost behind the History calendar.
  const recentNotes = useMemo(
    () => days.filter(d => d.date !== today && d.body.trim()).slice(0, 4),
    [days, today]
  );
  const stale = open.filter(e => ageInDays(e.task.created) >= 7).length;
  const totalOpen = tasks.filter(t => !t.done).length;

  const onToggle = useCallback((id: string) => toggleTaskWithUndo(id), []);
  const onRename = useCallback(
    (id: string, title: string) => store.updateTask(id, { title }),
    []
  );
  const onStar = useCallback(
    (id: string, starred: boolean) => store.updateTask(id, { starred }),
    []
  );
  const onDelete = useCallback((id: string) => deleteTaskWithUndo(id), []);
  const onMove = useCallback(
    (id: string, project: string) => store.moveTask(id, project),
    []
  );
  const onAdd = useCallback(
    (input: { title: string; project: string; starred: boolean }) => {
      const added = store.addTask(input);
      if (!added) return;
      // With oldest-first sort the new row lands at the bottom — off-screen on
      // a phone. Ring it and bring it into view so the add visibly worked.
      setSelected(added.id);
      setTimeout(() => {
        document
          .querySelector(`[data-task-id="${added.id}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 80);
    },
    []
  );

  // A small reward for clearing the list — Things 3 and TickTick both mark the
  // moment, and it is the single cheapest piece of positive feedback an app
  // can give. Fires only on the transition, never on load.
  const prevOpen = useRef<number | null>(null);
  useEffect(() => {
    if (
      prevOpen.current !== null &&
      prevOpen.current > 0 &&
      open.length === 0 &&
      doneToday.length > 0
    ) {
      toast.success("🎉 Xong hết việc rồi. Làm tốt lắm!", {
        duration: 4000,
      });
    }
    prevOpen.current = open.length;
  }, [open.length, doneToday.length]);

  useKeyboardShortcuts({ open, selected, setSelected, onToggle });

  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Đang mở dữ liệu…
      </div>
    );
  }

  const now = new Date();
  const progress = open.length + doneToday.length;
  const percent =
    progress === 0 ? 0 : Math.round((doneToday.length / progress) * 100);
  const openCount = (v: View) =>
    v === "ALL"
      ? totalOpen
      : tasks.filter(t => !t.done && t.category === v).length;
  // The floating add button and quick-add default to Công việc while in ALL.
  const addTone =
    view === "PER" ? "bg-per" : view === "WRK" ? "bg-wrk" : "bg-primary";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hôm nay</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {WEEKDAYS[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1}/
            {now.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {progress > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-done">
                  {percent}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {doneToday.length}/{progress} xong · {VIEW_LABEL[view]}
                </div>
              </div>
              <div className="h-11 w-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="w-full rounded-full bg-done transition-all"
                  style={{
                    height: `${percent}%`,
                    marginTop: `${100 - percent}%`,
                  }}
                />
              </div>
            </div>
          )}
          <HelpButton {...help} />
        </div>
      </header>

      <HelpPanel {...help} items={HELP} />

      {totalOpen === 0 && doneToday.length === 0 && <WelcomeCard />}

      {/* View switch — big, coloured, unmistakably a switch. */}
      <div className="grid grid-cols-3 gap-2">
        {(["WRK", "PER", "ALL"] as View[]).map(v => {
          const active = view === v;
          const activeTone =
            v === "WRK"
              ? "border-wrk bg-wrk text-white shadow-sm"
              : v === "PER"
                ? "border-per bg-per text-white shadow-sm"
                : "border-primary bg-primary text-primary-foreground shadow-sm";
          const badgeTone = active
            ? "bg-white/25 text-white"
            : v === "WRK"
              ? "bg-wrk-soft text-wrk"
              : v === "PER"
                ? "bg-per-soft text-per"
                : "bg-primary/15 text-primary";
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-2.5 text-sm font-medium transition-all sm:text-base",
                active
                  ? activeTone
                  : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground"
              )}
            >
              {VIEW_LABEL[v]}
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 text-xs font-bold tabular-nums",
                  badgeTone
                )}
              >
                {openCount(v)}
              </span>
            </button>
          );
        })}
      </div>

      <QuickAdd
        projects={projects}
        fields={fields}
        category={view}
        onAdd={onAdd}
      />

      {stale > 0 && (
        <button
          type="button"
          onClick={() => setSort("age")}
          className="flex w-full items-center gap-2 rounded-xl border-2 border-destructive/25 bg-destructive/5 px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <ClockAlert className="size-4 shrink-0" />
          <span className="flex-1">{stale} việc đã tồn quá 7 ngày</span>
          <span className="text-xs font-normal opacity-80">
            bấm để xếp lên đầu
          </span>
        </button>
      )}

      {/* Two columns on a wide screen: the checklist is the work, the note sits
          beside it instead of being buried below a long list. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ListTodo className="size-4 text-muted-foreground" />
              Việc cần làm
              <span className="text-muted-foreground">({open.length})</span>
            </h2>
            {open.length > 1 && (
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortMode)}
                aria-label="Sắp xếp"
                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
              >
                {(Object.keys(SORT_LABEL) as SortMode[]).map(mode => (
                  <option key={mode} value={mode}>
                    {SORT_LABEL[mode]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {open.length === 0 ? (
            <EmptyState
              label={VIEW_LABEL[view]}
              hasAny={
                view === "ALL"
                  ? tasks.length > 0
                  : tasks.some(t => t.category === view)
              }
            />
          ) : (
            <ul className="space-y-2">
              {open.map(({ task, daily }) => (
                <li key={task.id}>
                  <TaskRow
                    task={task}
                    label={daily}
                    project={projectByCode.get(task.project)}
                    fieldName={fieldNameByProject.get(task.project)}
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
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 pt-2 text-sm font-semibold text-done">
                <ChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
                <CheckCircle2 className="size-4" />
                Đã xong hôm nay ({doneToday.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ul className="space-y-2">
                  {doneToday.map(task => (
                    <li key={task.id}>
                      <TaskRow
                        task={task}
                        label={task.id}
                        project={projectByCode.get(task.project)}
                        fieldName={fieldNameByProject.get(task.project)}
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
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <DayNoteEditor
            date={today}
            value={note}
            onChange={body => store.setDayNote(today, body)}
          />

          {recentNotes.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <NotebookPen className="size-4" />
                Ghi chú gần đây
              </h3>
              <ul className="space-y-2">
                {/* Styled as its own coloured bar — a third hue, distinct from
                    the WRK/PER task rows — so an old note reads as something to
                    open, not a caption to skim past. */}
                {recentNotes.map(n => (
                  <li key={n.date}>
                    <Link
                      href={`/lich-su/${n.date}`}
                      className="flex items-start gap-2 rounded-xl border border-note/40 bg-note/10 px-3 py-2.5 shadow-sm transition-colors hover:bg-note/20"
                    >
                      <NotebookPen className="mt-0.5 size-4 shrink-0 text-note" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold tabular-nums text-note">
                          {n.date}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm leading-snug">
                          {noteExcerpt(n.body)}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-note/60" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      {/* Mobile-only floating add button. The quick-add box scrolls away on a
          long list; one thumb-reach tap brings it back with the keyboard up. */}
      <button
        type="button"
        onClick={() => {
          const input = document.getElementById(
            "quick-add-input"
          ) as HTMLInputElement | null;
          input?.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => input?.focus({ preventScroll: true }), 350);
        }}
        aria-label="Thêm việc mới"
        className={cn(
          "fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 sm:hidden",
          addTone
        )}
      >
        <Plus className="size-7 stroke-[2.5]" />
      </button>
    </div>
  );
}

function EmptyState({ label, hasAny }: { label: string; hasAny: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed py-8 text-center",
        hasAny ? "border-done/40 bg-done-soft/30" : "border-border"
      )}
    >
      {hasAny ? (
        <>
          <CheckCircle2 className="mx-auto mb-2 size-7 text-done" />
          <p className="text-sm font-semibold text-done">Xong hết rồi</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Không còn việc {label.toLowerCase()} nào đang tồn.
          </p>
        </>
      ) : (
        <>
          <ArrowUp className="mx-auto mb-2 size-6 animate-bounce text-muted-foreground" />
          <p className="text-sm font-medium">Chưa có việc nào</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gõ vào ô{" "}
            <span className="font-medium text-foreground">“Thêm việc mới”</span>{" "}
            phía trên rồi bấm Enter.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Desktop keyboard navigation. Bound on the window rather than per row so it
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

      const index = open.findIndex(e2 => e2.task.id === selected);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(
          open[Math.min(index + 1, open.length - 1)]?.task.id ?? null
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(open[Math.max(index - 1, 0)]?.task.id ?? null);
      } else if (e.key === " " && selected) {
        e.preventDefault();
        onToggle(selected);
      } else if (e.key === "n") {
        e.preventDefault();
        (
          document.getElementById("quick-add-input") as HTMLInputElement | null
        )?.focus();
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selected, setSelected, onToggle]);
}
