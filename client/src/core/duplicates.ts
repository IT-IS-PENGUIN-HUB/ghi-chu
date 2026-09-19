/**
 * "Việc này thêm rồi" — the check that catches the same chore being written
 * down twice.
 *
 * Scoped to one phân nhánh on purpose. The same sentence in two different
 * 案件 — "kiểm tra bản vẽ" on each of three gói — is normal work, and warning
 * about it would be the kind of alarm that goes off so often nobody reads it.
 * The same sentence twice in the same place is almost always a slip.
 */
import { ageInDays, type Task } from "./model";
import { fold } from "./search";

/** How long a finished task still counts as "you have just done this". */
const RECENT_DAYS = 7;

export interface DuplicateHit {
  task: Task;
  /** Still on the list, or finished within the last few days. */
  state: "open" | "done";
  /** Days since it was finished. Only meaningful when state is "done". */
  daysAgo: number;
  /** In the phân nhánh being added to, or somewhere else. */
  sameProject: boolean;
}

/** Trimmed, single-spaced and folded, so tone marks and spacing do not matter. */
function key(title: string): string {
  return fold(title.trim().replace(/\s+/g, " "));
}

/**
 * Finds a task in `project` that says the same thing as `title`.
 *
 * Folded through the search fold, so "giat ghe" typed in a hurry matches
 * "giặt ghế" written properly — which is the case that actually happens,
 * because nobody types tone marks the same way twice. A task still on the
 * list wins over a finished one: "it is already sitting there" is the more
 * useful thing to say.
 */
export function findDuplicateTask(
  tasks: Task[],
  title: string,
  project: string,
  now = new Date()
): DuplicateHit | null {
  const needle = key(title);
  if (!needle) return null;

  let best: DuplicateHit | null = null;
  for (const task of tasks) {
    if (key(task.title) !== needle) continue;

    const sameProject = task.project === project;
    const daysAgo = task.done
      ? ageInDays(task.completed ?? task.created, now)
      : 0;
    if (task.done && daysAgo > RECENT_DAYS) continue;

    const hit: DuplicateHit = {
      task,
      state: task.done ? "done" : "open",
      daysAgo,
      sameProject,
    };
    if (!best || rank(hit) < rank(best)) best = hit;
  }
  return best;
}

/**
 * Which match to show when there are several.
 *
 * "Still on your list, right here" is the most useful thing to say, then the
 * same sentence filed somewhere else — that one is often legitimate (the same
 * step on three different gói), so it is named rather than assumed to be a
 * mistake, and it never hides a match in the phân nhánh you are typing into.
 */
function rank(hit: DuplicateHit): number {
  if (hit.state === "open") return hit.sameProject ? 0 : 1;
  return hit.sameProject ? 2 : 3;
}

/** "đang còn trong danh sách" / "đã xong hôm qua" — said the way people say it. */
export function describeDuplicate(hit: DuplicateHit): string {
  if (hit.state === "open") return "đang còn trong danh sách";
  if (hit.daysAgo === 0) return "đã xong hôm nay";
  if (hit.daysAgo === 1) return "đã xong hôm qua";
  return `đã xong ${hit.daysAgo} ngày trước`;
}
