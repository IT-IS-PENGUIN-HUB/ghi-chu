/**
 * The two identifier schemes.
 *
 * `ALP-0042` — permanent, project-scoped, allocated once and frozen. This is
 * what you quote in an email a year later, and what sync uses as a merge key.
 *
 * `WRK_01` — position in today's list, computed from order at render time.
 * Storing it would be a bug: deleting a task would leave a hole, and the number
 * has to change every morning anyway when unfinished work rolls over.
 */
import { type Category, type Project, type Task } from "./model";

/** Formats a permanent id from a project code and a sequence number. */
export function formatTaskId(projectCode: string, seq: number): string {
  return `${projectCode.toUpperCase()}-${String(seq).padStart(4, "0")}`;
}

/**
 * Hands out the next id for a project and returns the advanced project record.
 *
 * The counter only ever moves forward — an id belonging to a deleted task is
 * never reissued, which is exactly the bug the old MySQL `length + 1` scheme
 * had (delete C2, add a task, get a second C2).
 */
export function allocateTaskId(project: Project): {
  id: string;
  project: Project;
} {
  return {
    id: formatTaskId(project.code, project.next),
    project: { ...project, next: project.next + 1 },
  };
}

/** Formats today's positional code, e.g. index 0 in WRK -> "WRK_01". */
export function formatDailyCode(category: Category, index: number): string {
  return `${category}_${String(index + 1).padStart(2, "0")}`;
}

/**
 * Derives a project code from a free-text project name: "Alpha" -> "ALP".
 *
 * Prefers consonants so the result stays pronounceable and distinct, then
 * disambiguates against codes already in use.
 */
export function suggestProjectCode(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((c) => c.toUpperCase()));

  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "");

  const words = ascii.split(/\s+/).filter(Boolean);
  const candidates: string[] = [];

  if (words.length > 1) candidates.push(words.map((w) => w[0]).join("").slice(0, 5));
  if (words.length) {
    const first = words[0];
    const consonants = first.replace(/[AEIOU]/g, "");
    candidates.push((consonants.length >= 2 ? consonants : first).slice(0, 3));
    candidates.push(first.slice(0, 3));
    candidates.push(first.slice(0, 4));
  }
  candidates.push("P");

  for (const raw of candidates) {
    const base = raw.replace(/^[^A-Z]/, "P");
    if (base.length >= 2 && base.length <= 5 && !used.has(base)) return base;
  }

  // Everything sensible is taken — fall back to a numbered variant.
  const stem = (candidates[0] || "P").slice(0, 3).padEnd(2, "X");
  for (let n = 2; n < 100; n++) {
    const code = `${stem}${n}`.slice(0, 5);
    if (!used.has(code)) return code;
  }
  return `P${Date.now() % 1000}`;
}

// -------------------------------------------------------------- today view --

export type SortMode = "age" | "recent" | "project";

export interface DailyEntry {
  task: Task;
  /** "WRK_01" — position in today's list for this category. */
  daily: string;
}

/**
 * Builds today's list: every open task, grouped by category and numbered.
 *
 * Carry-over is implicit — a task stays in the list until it is done, and gets
 * a fresh number each day simply because the number comes from its position.
 */
export function buildDailyList(
  tasks: Iterable<Task>,
  category: Category,
  sort: SortMode = "age"
): DailyEntry[] {
  const open = [...tasks].filter((t) => !t.done && t.category === category);

  const comparators: Record<SortMode, (a: Task, b: Task) => number> = {
    // Oldest first: the point of the creation stamp is to surface stale work.
    age: (a, b) => a.created.localeCompare(b.created),
    recent: (a, b) => b.created.localeCompare(a.created),
    project: (a, b) => a.project.localeCompare(b.project) || a.created.localeCompare(b.created),
  };

  open.sort((a, b) => {
    // Starred work floats to the top regardless of the chosen sort.
    if (Boolean(a.starred) !== Boolean(b.starred)) return a.starred ? -1 : 1;
    return comparators[sort](a, b);
  });

  return open.map((task, i) => ({ task, daily: formatDailyCode(category, i) }));
}
