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

  let finished: DuplicateHit | null = null;
  for (const task of tasks) {
    if (task.project !== project) continue;
    if (key(task.title) !== needle) continue;

    if (!task.done) return { task, state: "open", daysAgo: 0 };

    const daysAgo = ageInDays(task.completed ?? task.created, now);
    if (daysAgo <= RECENT_DAYS && (!finished || daysAgo < finished.daysAgo)) {
      finished = { task, state: "done", daysAgo };
    }
  }
  return finished;
}

/** "đang còn trong danh sách" / "đã xong hôm qua" — said the way people say it. */
export function describeDuplicate(hit: DuplicateHit): string {
  if (hit.state === "open") return "đang còn trong danh sách";
  if (hit.daysAgo === 0) return "đã xong hôm nay";
  if (hit.daysAgo === 1) return "đã xong hôm qua";
  return `đã xong ${hit.daysAgo} ngày trước`;
}
