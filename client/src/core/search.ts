/**
 * Full-history search.
 *
 * The hard requirement is Vietnamese: typing "khoi luong" on a phone keyboard
 * must find "khối lượng", because nobody types tone marks when they are trying
 * to recall a task from a year ago. Both the index and the query therefore run
 * through the same fold: NFD-decompose, drop combining marks, map đ/Đ (which is
 * a distinct letter, not a decorated d), lowercase.
 *
 * On top of that MiniSearch runs with prefix + fuzzy matching, so a half-typed
 * or slightly misremembered word still hits.
 */
import MiniSearch, { type SearchResult } from "minisearch";
import { type Contact, type DayNote, type Task } from "./model";

const COMBINING = /[̀-ͯ]/g;

/** Diacritic- and case-insensitive fold, shared by indexing and querying. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export type Hit =
  | { kind: "task"; task: Task; score: number }
  | { kind: "note"; note: DayNote; excerpt: string; score: number }
  | { kind: "contact"; contact: Contact; score: number };

interface Doc {
  id: string;
  kind: "task" | "note" | "contact";
  /** Folded text that MiniSearch actually indexes. */
  text: string;
  /** Secondary field, weighted lower — project names, tags, phone numbers. */
  meta: string;
}

function makeIndex(): MiniSearch<Doc> {
  return new MiniSearch<Doc>({
    fields: ["text", "meta"],
    storeFields: ["kind"],
    // Terms are already folded when the doc is built; fold again so a caller
    // that indexes raw text still behaves.
    processTerm: (term) => (term.length > 1 || /\d/.test(term) ? fold(term) : null),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { text: 2 },
      combineWith: "AND",
    },
  });
}

export class SearchIndex {
  private index = makeIndex();
  private tasks = new Map<string, Task>();
  private notes = new Map<string, DayNote>();
  private contacts = new Map<string, Contact>();

  rebuild(data: { tasks: Task[]; notes: DayNote[]; contacts: Contact[] }): void {
    this.index = makeIndex();
    this.tasks.clear();
    this.notes.clear();
    this.contacts.clear();

    const docs: Doc[] = [];

    for (const task of data.tasks) {
      const id = `t:${task.id}`;
      this.tasks.set(id, task);
      docs.push({
        id,
        kind: "task",
        text: fold(task.title),
        meta: fold([task.id, task.project, task.category, ...(task.tags ?? [])].join(" ")),
      });
    }

    for (const note of data.notes) {
      if (!note.body.trim()) continue;
      const id = `n:${note.date}`;
      this.notes.set(id, note);
      docs.push({ id, kind: "note", text: fold(note.body), meta: note.date });
    }

    for (const [i, contact] of data.contacts.entries()) {
      const id = `c:${i}`;
      this.contacts.set(id, contact);
      docs.push({
        id,
        kind: "contact",
        text: fold(`${contact.label} ${contact.group} ${contact.note ?? ""}`),
        // Index the phone both as typed and stripped, so "0312345678" and
        // "03-1234-5678" both match.
        meta: `${contact.phone} ${contact.phone.replace(/\D/g, "")}`,
      });
    }

    this.index.addAll(docs);
  }

  search(query: string, limit = 50): Hit[] {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const results = this.index.search(fold(trimmed)) as SearchResult[];
    const hits: Hit[] = [];

    for (const r of results) {
      const id = String(r.id);
      const task = this.tasks.get(id);
      if (task) {
        hits.push({ kind: "task", task, score: r.score });
        continue;
      }
      const note = this.notes.get(id);
      if (note) {
        hits.push({
          kind: "note",
          note,
          excerpt: excerpt(note.body, trimmed),
          score: r.score,
        });
        continue;
      }
      const contact = this.contacts.get(id);
      if (contact) hits.push({ kind: "contact", contact, score: r.score });
    }

    return hits.slice(0, limit);
  }
}

/** Pulls the window of text around the first matching word, for result rows. */
export function excerpt(body: string, query: string, radius = 60): string {
  const foldedBody = fold(body);
  const words = fold(query).split(/\s+/).filter((w) => w.length > 1);

  let at = -1;
  for (const w of words) {
    const i = foldedBody.indexOf(w);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return body.slice(0, radius * 2).trim();

  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + radius);
  return (start > 0 ? "…" : "") + body.slice(start, end).trim() + (end < body.length ? "…" : "");
}

/**
 * Splits `text` into alternating non-match / match segments for highlighting.
 * Matching happens on the folded form but the slices come from the original,
 * so the rendered text keeps its tone marks.
 */
export function highlightRanges(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const words = [...new Set(fold(query).split(/\s+/).filter((w) => w.length > 1))];
  if (!words.length) return [{ text, hit: false }];

  const folded = fold(text);
  // fold() is length-preserving for Vietnamese (NFD marks are dropped, đ->d is
  // 1:1), so indices in the folded string map straight back to the original.
  const marks = new Array<boolean>(text.length).fill(false);

  for (const w of words) {
    let from = 0;
    for (;;) {
      const i = folded.indexOf(w, from);
      if (i === -1) break;
      for (let j = i; j < i + w.length && j < marks.length; j++) marks[j] = true;
      from = i + w.length;
    }
  }

  const out: Array<{ text: string; hit: boolean }> = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      out.push({ text: text.slice(start, i), hit: marks[start] });
      start = i;
    }
  }
  return out;
}
