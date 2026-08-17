import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayNoteEditor } from "@/components/DayNoteEditor";
import { Markdown } from "@/components/Markdown";
import { toDateKey, type Task } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

/** "2026.08.17_14.48" -> "2026-08-17" */
const dayOf = (stamp: string) => stamp.slice(0, 10).replace(/\./g, "-");

export default function History() {
  const [, params] = useRoute("/lich-su/:date");
  const { tasks, days, projects } = useStore();
  const today = toDateKey(new Date());

  const [selected, setSelected] = useState(params?.date ?? today);
  const [cursor, setCursor] = useState(() => {
    const base = params?.date ?? today;
    return new Date(Number(base.slice(0, 4)), Number(base.slice(5, 7)) - 1, 1);
  });

  const projectName = useMemo(() => new Map(projects.map((p) => [p.code, p.name])), [projects]);

  // Per-day activity, used for the heatmap and the day panel.
  const activity = useMemo(() => {
    const map = new Map<string, { created: Task[]; done: Task[] }>();
    const bucket = (key: string) => {
      let entry = map.get(key);
      if (!entry) map.set(key, (entry = { created: [], done: [] }));
      return entry;
    };
    for (const t of tasks) {
      bucket(dayOf(t.created)).created.push(t);
      if (t.done && t.completed) bucket(dayOf(t.completed)).done.push(t);
    }
    return map;
  }, [tasks]);

  const noteByDate = useMemo(() => new Map(days.map((d) => [d.date, d.body])), [days]);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const detail = activity.get(selected);
  const note = noteByDate.get(selected) ?? "";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Lịch sử</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ô càng đậm càng nhiều việc xong. Bấm vào ngày để xem lại.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Tháng trước"
            className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Tháng sau"
            className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_HEADS.map((d) => (
            <div key={d} className="pb-1 text-[0.625rem] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {grid.map((cell, i) =>
            cell === null ? (
              <div key={`pad-${i}`} />
            ) : (
              <DayCell
                key={cell}
                date={cell}
                today={cell === today}
                selected={cell === selected}
                doneCount={activity.get(cell)?.done.length ?? 0}
                hasNote={noteByDate.has(cell)}
                onSelect={setSelected}
              />
            )
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          {selected === today ? "Hôm nay" : selected}
          {selected !== today && (
            <button
              type="button"
              onClick={() => {
                setSelected(today);
                setCursor(new Date());
              }}
              className="ml-2 text-xs font-normal text-primary hover:underline"
            >
              về hôm nay
            </button>
          )}
        </h2>

        {!detail?.done.length && !detail?.created.length && !note ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Ngày này không có hoạt động nào được ghi lại.
          </p>
        ) : (
          <>
            {detail?.done.length ? (
              <DayList title="Đã xong" tasks={detail.done} projectName={projectName} done />
            ) : null}
            {detail?.created.length ? (
              <DayList title="Được thêm vào" tasks={detail.created} projectName={projectName} />
            ) : null}
          </>
        )}

        {selected === today ? (
          <DayNoteEditor
            date={today}
            value={note}
            onChange={(body) => store.setDayNote(today, body)}
          />
        ) : note ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Ghi chú</h3>
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <Markdown source={note} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DayCell({
  date,
  today,
  selected,
  doneCount,
  hasNote,
  onSelect,
}: {
  date: string;
  today: boolean;
  selected: boolean;
  doneCount: number;
  hasNote: boolean;
  onSelect: (date: string) => void;
}) {
  // Four steps is enough to read at a glance; more just becomes noise.
  const level = doneCount === 0 ? 0 : doneCount <= 2 ? 1 : doneCount <= 5 ? 2 : 3;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={`${date}, ${doneCount} việc xong`}
      aria-pressed={selected}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-colors",
        level === 0 && "text-muted-foreground hover:bg-accent",
        level === 1 && "bg-done/25 text-foreground",
        level === 2 && "bg-done/50 text-foreground",
        level === 3 && "bg-done/80 text-white",
        today && "font-bold ring-1 ring-primary",
        selected && "ring-2 ring-ring"
      )}
    >
      {Number(date.slice(8, 10))}
      {hasNote && (
        <span className="absolute bottom-0.5 size-1 rounded-full bg-primary" aria-hidden />
      )}
    </button>
  );
}

function DayList({
  title,
  tasks,
  projectName,
  done,
}: {
  title: string;
  tasks: Task[];
  projectName: Map<string, string>;
  done?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title} ({tasks.length})
      </h3>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li
            key={`${t.id}-${title}`}
            className="flex items-baseline gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{t.id}</span>
            <span className={cn("min-w-0 flex-1", done && "text-muted-foreground")}>{t.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {projectName.get(t.project) ?? t.project}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Month grid padded so the first column is always Monday. */
function buildMonthGrid(cursor: Date): Array<string | null> {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  const cells: Array<string | null> = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateKey(new Date(year, month, d)));
  }
  return cells;
}
