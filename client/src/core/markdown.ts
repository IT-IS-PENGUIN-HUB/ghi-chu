/**
 * Markdown <-> model, for every file kept in the data repo.
 *
 * Design rules, in priority order:
 *
 * 1. **Never lose data.** A line the parser does not recognise is kept verbatim
 *    and written back out, so hand-editing on github.com can at worst confuse
 *    the app's rendering — it can never silently delete work.
 * 2. **Readable on github.com.** Tasks are real `- [ ]` list items so GitHub
 *    renders them as checkboxes; metadata rides in backticks, not HTML
 *    comments, so nothing is hidden from a human reader.
 * 3. **Round-trip stable.** parse -> serialize of an app-written file must
 *    reproduce it byte for byte, which the tests assert.
 */
import {
  type Category,
  type Contact,
  type DayNote,
  type Field,
  type Project,
  type RecurrenceKind,
  type RecurringRule,
  type Task,
  CATEGORIES,
  CODE_PATTERN,
  CODE_RE,
  DEFAULT_PROJECT,
} from "./model";

const HEADING_OPEN = "## Đang tồn";
const HEADING_DONE = "## Đã xong";

/**
 * Placeholders written when a section is empty. They have to be recognised on
 * the way back in, otherwise they fall through to `extra` and get re-emitted
 * alongside a freshly generated copy — one extra line per save, forever.
 */
const EMPTY_OPEN = "_Không còn việc nào._";
const EMPTY_DONE = "_Chưa có việc nào._";
const PLACEHOLDERS = new Set([EMPTY_OPEN, EMPTY_DONE]);

/** Task ids look like `ALP-0042`: project prefix, hyphen, four digits. */
export const TASK_ID_RE = new RegExp(`^${CODE_PATTERN}-\\d{4}$`);

/** Stamps look like `2026.08.10_09.12`. */
const STAMP = "\\d{4}\\.\\d{2}\\.\\d{2}_\\d{2}\\.\\d{2}";

/**
 * A task line:
 *   - [ ] `ALP-0042` ★ Kiểm tra khối lượng #Alpha `2026.08.10_09.12`
 *   - [x] `ALP-0041` Gửi bản vẽ `2026.08.09_08.30` → `2026.08.11_16.05`
 */
const TASK_LINE_RE = new RegExp(
  "^- \\[([ xX])\\] " + // checkbox
    "`(" + CODE_PATTERN + "-\\d{4})` " + // permanent id
    "(★ )?" + // optional star
    "(.*?)" + // title (lazy, so the stamps below win)
    " `(" +
    STAMP +
    ")`" + // created
    "(?: → `(" +
    STAMP +
    ")`)?" + // optional completed
    "\\s*$"
);

// -------------------------------------------------------------- frontmatter --

export interface Frontmatter {
  [key: string]: string;
}

/** Splits `---\nkey: value\n---\n\nbody` into its two halves. */
export function splitFrontmatter(text: string): {
  data: Frontmatter;
  body: string;
} {
  const normalised = text.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) return { data: {}, body: normalised };

  const end = normalised.indexOf("\n---\n", 3);
  if (end === -1) return { data: {}, body: normalised };

  const data: Frontmatter = {};
  for (const line of normalised.slice(4, end).split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body: normalised.slice(end + 5) };
}

function buildFrontmatter(data: Frontmatter): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

// -------------------------------------------------------------- task lines --

/** Pulls `#tag` tokens out of a title, returning the cleaned title. */
export function extractTags(title: string): { title: string; tags: string[] } {
  const tags = new Set<string>();
  const cleaned = title
    .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_m, lead: string, tag: string) => {
      tags.add(tag);
      return lead;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  return { title: cleaned, tags: [...tags] };
}

function formatTaskLine(task: Task): string {
  const box = task.done ? "x" : " ";
  const star = task.starred ? "★ " : "";
  // The title is stored tag-free, so re-appending a deduped set keeps a
  // round trip from growing "#gấp #gấp" on every save.
  const unique = [...new Set(task.tags ?? [])];
  const tags = unique.length ? " " + unique.map((t) => `#${t}`).join(" ") : "";
  const done = task.completed ? ` → \`${task.completed}\`` : "";
  return `- [${box}] \`${task.id}\` ${star}${task.title}${tags} \`${task.created}\`${done}`;
}

/**
 * Parses one task line. Returns null for anything that is not a task.
 *
 * `project` is the file the line was found in, which is authoritative — a task
 * moved between projects keeps its original id (like a ticket key), so the id
 * prefix says where it was born, not where it lives now.
 */
export function parseTaskLine(
  line: string,
  project: string,
  category: Category
): Task | null {
  const m = TASK_LINE_RE.exec(line);
  if (!m) return null;

  const [, box, id, star, rawTitle, created, completed] = m;
  const { title, tags } = extractTags(rawTitle.trim());
  const done = box.toLowerCase() === "x";

  return {
    id,
    project,
    category,
    title,
    done,
    created,
    // A line can be checked by hand on github.com without a completion stamp;
    // treat the stamp as optional metadata rather than as the source of truth.
    ...(done && completed ? { completed } : {}),
    ...(star ? { starred: true } : {}),
    ...(tags.length ? { tags } : {}),
  };
}

// ------------------------------------------------------------ project file --

export interface ProjectFile {
  project: Project;
  tasks: Task[];
  /** Lines the parser did not understand, preserved so nothing is ever lost. */
  extra: string[];
}

export function parseProjectFile(text: string, codeFromPath: string): ProjectFile {
  const { data, body } = splitFrontmatter(text);
  const code = (data.project || codeFromPath).toUpperCase();
  const category = CATEGORIES.includes(data.category as Category)
    ? (data.category as Category)
    : "WRK";

  const project: Project = {
    code,
    name: data.name || code,
    category,
    ...(data.field ? { field: data.field.toUpperCase() } : {}),
    next: Number.parseInt(data.next ?? "1", 10) || 1,
    archived: data.archived === "true",
  };

  const tasks: Task[] = [];
  const extra: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed === HEADING_OPEN ||
      trimmed === HEADING_DONE ||
      PLACEHOLDERS.has(trimmed)
    ) {
      continue;
    }

    const task = parseTaskLine(line, code, category);
    if (task) tasks.push(task);
    else extra.push(line);
  }

  // Self-heal a counter that a hand edit left behind the highest id in use,
  // otherwise the next task would collide with an existing one.
  const highest = tasks.reduce((max, t) => {
    const n = Number.parseInt(t.id.split("-")[1] ?? "0", 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  project.next = Math.max(project.next, highest + 1);

  return { project, tasks, extra };
}

export function serializeProjectFile(file: ProjectFile): string {
  const { project, tasks, extra } = file;
  const fm = buildFrontmatter({
    project: project.code,
    name: project.name,
    category: project.category,
    ...(project.field ? { field: project.field } : {}),
    next: String(project.next),
    ...(project.archived ? { archived: "true" } : {}),
  });

  // Newest first within each section: what you added last is what you are
  // most likely looking for when you open the file.
  const byNewest = (a: Task, b: Task) => b.created.localeCompare(a.created);
  const open = tasks.filter((t) => !t.done).sort(byNewest);
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.completed ?? b.created).localeCompare(a.completed ?? a.created));

  const out = [fm, ""];
  out.push(HEADING_OPEN, "");
  out.push(...(open.length ? open.map(formatTaskLine) : [EMPTY_OPEN]));
  out.push("");
  out.push(HEADING_DONE, "");
  out.push(...(done.length ? done.map(formatTaskLine) : [EMPTY_DONE]));

  if (extra.length) out.push("", ...extra);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// --------------------------------------------------------- projects registry --

/**
 * `data/projects.md` — a Markdown table, so github.com renders it as a table
 * and a human can add a row by hand without knowing any syntax.
 */
export function parseProjectsFile(text: string): Project[] {
  const { body } = splitFrontmatter(text);
  const projects: Project[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = splitRow(trimmed);
    if (cells.length < 5) continue;

    const code = cells[0].replace(/`/g, "").toUpperCase();
    // Skip the header row and the |---|---| separator.
    if (!CODE_RE.test(code)) continue;

    const field = cells[3].replace(/`/g, "").toUpperCase();
    projects.push({
      code,
      name: cells[1] || code,
      category: CATEGORIES.includes(cells[2] as Category) ? (cells[2] as Category) : "WRK",
      ...(field && field !== "—" ? { field } : {}),
      next: Number.parseInt(cells[4], 10) || 1,
      archived: (cells[5] ?? "").toLowerCase().startsWith("l"),
    });
  }
  return projects;
}

export function serializeProjectsFile(projects: Project[]): string {
  const rows = [...projects]
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.code.localeCompare(b.code))
    .map(
      (p) =>
        `| ${p.code} | ${p.name} | ${p.category} | ${p.field ?? "—"} | ${p.next} | ${p.archived ? "lưu trữ" : "đang dùng"} |`
    );

  return [
    "# Dự án",
    "",
    "| Mã | Tên | Nhóm | Lĩnh vực | Số kế tiếp | Trạng thái |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- fields --

/**
 * `data/fields.md` — the layer between category and project: 分野A, 分野B,
 * Cuộc sống, Học tập. Names are written as typed so Japanese survives intact.
 */
export function parseFieldsFile(text: string): Field[] {
  const { body } = splitFrontmatter(text);
  const fields: Field[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = splitRow(trimmed);
    if (cells.length < 3) continue;

    const code = cells[0].replace(/`/g, "").toUpperCase();
    if (!CODE_RE.test(code)) continue;

    fields.push({
      code,
      name: cells[1] || code,
      category: CATEGORIES.includes(cells[2] as Category) ? (cells[2] as Category) : "WRK",
      order: Number.parseInt(cells[3] ?? "", 10) || fields.length + 1,
    });
  }
  return fields;
}

export function serializeFieldsFile(fields: Field[]): string {
  const rows = [...fields]
    .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order)
    .map((f) => `| ${f.code} | ${f.name} | ${f.category} | ${f.order} |`);

  return [
    "# Lĩnh vực",
    "",
    "Tầng giữa Nhóm và Dự án. Thêm, sửa, xoá thoải mái.",
    "",
    "| Mã | Tên | Nhóm | Thứ tự |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** Splits a Markdown table row into trimmed cells. */
function splitRow(line: string): string[] {
  return line
    .slice(1, line.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((c) => c.trim());
}

// -------------------------------------------------------------- day note --

export function parseDayNote(text: string, dateFromPath: string): DayNote {
  const { data, body } = splitFrontmatter(text);
  return { date: data.date || dateFromPath, body: body.trim() };
}

export function serializeDayNote(note: DayNote): string {
  return `${buildFrontmatter({ date: note.date })}\n${note.body.trim()}\n`;
}

// --------------------------------------------------------------- contacts --

/**
 * `data/contacts.md`:
 *
 *   ## Alpha
 *   - Văn phòng Tokyo · `03-1234-5678` · Phòng kinh doanh
 */
export function parseContactsFile(text: string): Contact[] {
  const { body } = splitFrontmatter(text);
  const contacts: Contact[] = [];
  let group = "Khác";

  for (const line of body.split("\n")) {
    const trimmed = line.trim();

    const heading = /^#{1,3}\s+(.+)$/.exec(trimmed);
    if (heading) {
      group = heading[1].trim();
      continue;
    }

    if (!trimmed.startsWith("- ")) continue;
    const parts = trimmed.slice(2).split("·").map((p) => p.trim());
    const phoneIdx = parts.findIndex((p) => p.startsWith("`") && p.endsWith("`"));
    if (phoneIdx === -1) continue;

    contacts.push({
      group,
      label: parts.slice(0, phoneIdx).join(" · ") || group,
      phone: parts[phoneIdx].replace(/`/g, "").trim(),
      ...(parts.length > phoneIdx + 1
        ? { note: parts.slice(phoneIdx + 1).join(" · ") }
        : {}),
    });
  }
  return contacts;
}

export function serializeContactsFile(contacts: Contact[]): string {
  const groups = new Map<string, Contact[]>();
  for (const c of contacts) {
    const list = groups.get(c.group);
    if (list) list.push(c);
    else groups.set(c.group, [c]);
  }

  const out = ["# Danh bạ", ""];
  for (const [group, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(`## ${group}`, "");
    for (const c of list) {
      out.push(`- ${c.label} · \`${c.phone}\`${c.note ? ` · ${c.note}` : ""}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

// -------------------------------------------------------------- recurring --

const KINDS: RecurrenceKind[] = ["daily", "weekly", "weekdays"];

const KIND_LABEL: Record<RecurrenceKind, string> = {
  daily: "hằng ngày",
  weekly: "hằng tuần",
  weekdays: "thứ trong tuần",
};

const LABEL_KIND = new Map<string, RecurrenceKind>(
  KINDS.map((k) => [KIND_LABEL[k], k])
);

export function parseRecurringFile(text: string): RecurringRule[] {
  const { body } = splitFrontmatter(text);
  const rules: RecurringRule[] = [];

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
    if (cells.length < 6) continue;

    const id = cells[0].replace(/`/g, "");
    if (!/^R\d+$/.test(id)) continue;

    const kindCell = cells[4];
    const kind = LABEL_KIND.get(kindCell) ?? (KINDS.includes(kindCell as RecurrenceKind) ? (kindCell as RecurrenceKind) : "daily");

    rules.push({
      id,
      title: cells[1],
      project: (cells[2] || DEFAULT_PROJECT).toUpperCase(),
      category: CATEGORIES.includes(cells[3] as Category) ? (cells[3] as Category) : "WRK",
      kind,
      days: (cells[5] || "")
        .split(",")
        .map((d) => Number.parseInt(d.trim(), 10))
        .filter((d) => d >= 1 && d <= 7),
      ...(cells[6] ? { lastRun: cells[6] } : {}),
    });
  }
  return rules;
}

export function serializeRecurringFile(rules: RecurringRule[]): string {
  const rows = rules.map(
    (r) =>
      `| ${r.id} | ${r.title} | ${r.project} | ${r.category} | ${KIND_LABEL[r.kind]} | ${r.days.join(",")} | ${r.lastRun ?? ""} |`
  );

  return [
    "# Việc lặp lại",
    "",
    "Cột `Ngày`: 1 = Thứ Hai … 7 = Chủ Nhật. Bỏ trống nếu lặp hằng ngày.",
    "",
    "| Mã | Nội dung | Dự án | Nhóm | Lặp | Ngày | Lần cuối |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

// ------------------------------------------------------------------ paths --

export const paths = {
  fields: "data/fields.md",
  projects: "data/projects.md",
  contacts: "data/contacts.md",
  recurring: "data/recurring.md",
  project: (code: string) => `data/tasks/${code.toUpperCase()}.md`,
  day: (date: string) => `data/days/${date.slice(0, 4)}/${date}.md`,
};

/** "data/days/2026/2026-08-17.md" -> "2026-08-17" */
export function dateFromDayPath(path: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})\.md$/.exec(path);
  return m ? m[1] : null;
}

/** "data/tasks/ALP.md" -> "ALP" */
export function codeFromProjectPath(path: string): string | null {
  const m = new RegExp(`/(${CODE_PATTERN})\\.md$`).exec(path);
  return m ? m[1] : null;
}
