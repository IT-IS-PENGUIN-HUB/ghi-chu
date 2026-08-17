/**
 * Domain model.
 *
 * Storage layout in the (private) data repo:
 *
 *   data/projects.md              registry of projects + per-project counter
 *   data/contacts.md              customer phone book
 *   data/recurring.md             recurring task rules
 *   data/tasks/<CODE>.md          one file per project: every task, ever
 *   data/days/<YYYY>/<DATE>.md    free-form note — only created when written
 *
 * Two distinct identifiers, deliberately shaped so they can never be confused:
 *
 *   `ALP-0042`  permanent task id. Assigned once, frozen for life. Scoped to a
 *               project, which is what makes long-term retrieval possible.
 *   `WRK_01`    position in *today's* list. Derived from order at render time,
 *               never stored, so it renumbers itself every day and can never
 *               drift out of sync with the file.
 */

/** Top-level bucket. Independent of the project — it is its own column. */
export type Category = "WRK" | "PER";

export const CATEGORIES: Category[] = ["WRK", "PER"];

export const CATEGORY_LABEL: Record<Category, string> = {
  WRK: "Công việc",
  PER: "Cá nhân",
};

/**
 * Catch-all project per category, for tasks not filed under a real project.
 *
 * One per category rather than a single shared bucket: a project belongs to
 * exactly one group, which is what makes `data/tasks/ALP.md` unambiguous — open
 * it and everything inside is work.
 */
export const DEFAULT_PROJECTS: Record<Category, string> = {
  WRK: "ETC",
  PER: "CN",
};

export const DEFAULT_PROJECT = DEFAULT_PROJECTS.WRK;

export function defaultProjectFor(category: Category): string {
  return DEFAULT_PROJECTS[category];
}

/**
 * A field of work sitting between the category and the project — 分野A,
 * 分野B, Cuộc sống, Học tập. Free to add, rename and remove: the set is
 * expected to grow as new lines of work appear.
 */
export interface Field {
  /** 2–6 uppercase chars, unique within the app. */
  code: string;
  /** Display name. Kept as typed, so Japanese and Vietnamese both work. */
  name: string;
  category: Category;
  /** Manual ordering in the sidebar; ties fall back to name. */
  order: number;
}

export interface Project {
  /** 2–5 uppercase chars, unique. Forms the prefix of every task id. */
  code: string;
  name: string;
  /** Default category applied to new tasks filed here. */
  category: Category;
  /**
   * Field this project belongs to. Optional on purpose — filing can wait, and
   * an unassigned project still works everywhere.
   */
  field?: string;
  /** Next sequence number to hand out. Monotonic — never reused after delete. */
  next: number;
  archived: boolean;
}

export interface Task {
  /** Permanent id, e.g. "ALP-0042". Stable across projects moves. */
  id: string;
  /** Project file this task currently lives in. */
  project: string;
  category: Category;
  title: string;
  done: boolean;
  /** "2026.08.10_09.12" — when the task was first written down. */
  created: string;
  /** "2026.08.11_16.05" — set when done, cleared when reopened. */
  completed?: string;
  /** User-flagged as important. Rendered with a marker, sorts first. */
  starred?: boolean;
  /** Free-form labels typed inline as #tag. */
  tags?: string[];
}

export interface DayNote {
  /** "2026-08-17" */
  date: string;
  /** Markdown body. Empty means the file should not exist. */
  body: string;
}

export interface Contact {
  /** Group heading, usually the customer or office name. */
  group: string;
  label: string;
  phone: string;
  note?: string;
}

export type RecurrenceKind = "daily" | "weekly" | "weekdays";

export interface RecurringRule {
  id: string;
  title: string;
  project: string;
  category: Category;
  kind: RecurrenceKind;
  /** For "weekly": 1 = Monday … 7 = Sunday. For "weekdays": the set of days. */
  days: number[];
  /** "2026-08-14" — last date this rule produced a task, to avoid duplicates. */
  lastRun?: string;
}

// ------------------------------------------------------------------- dates --

/** Local calendar date as "YYYY-MM-DD". Never use toISOString — that is UTC. */
export function toDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Timestamp as "YYYY.MM.DD_HH.mm" — the age marker shown next to each task. */
export function toStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}_${p(d.getHours())}.${p(d.getMinutes())}`;
}

/** Parses "YYYY.MM.DD_HH.mm" back to a Date. Returns null if malformed. */
export function parseStamp(stamp: string): Date | null {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})_(\d{2})\.(\d{2})$/.exec(stamp);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The "YYYY-MM-DD" a stamp falls on, for grouping tasks by creation day. */
export function stampToDateKey(stamp: string): string {
  return stamp.slice(0, 10).replace(/\./g, "-");
}

/** Whole days between a task's creation stamp and `now`. Used for age badges. */
export function ageInDays(created: string, now = new Date()): number {
  const then = parseStamp(created);
  if (!then) return 0;
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}
