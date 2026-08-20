/**
 * Local-first store.
 *
 * IndexedDB holds the repo's files verbatim, keyed by path — the same unit
 * GitHub sync pushes and pulls, which keeps merging honest. The parsed model is
 * derived from those files in memory on boot and kept in step by every
 * mutation, so reads are synchronous and the UI never waits on the network.
 *
 * Every mutation is: change the model -> re-serialise the files it touched ->
 * mark them dirty -> notify React. Persisting to IndexedDB and pushing to
 * GitHub both happen after the fact, off the interaction path.
 */
import { openDB, type IDBPDatabase } from "idb";
import { allocateTaskId } from "./codes";
import {
  codeFromProjectPath,
  dateFromDayPath,
  extractTags,
  parseContactsFile,
  parseDayNote,
  parseFieldsFile,
  parseProjectFile,
  parseProjectsFile,
  parseRecurringFile,
  paths,
  serializeContactsFile,
  serializeFieldsFile,
  serializeDayNote,
  serializeProjectFile,
  serializeProjectsFile,
  serializeRecurringFile,
  type ProjectFile,
} from "./markdown";
import {
  defaultProjectFor,
  toStamp,
  type Category,
  type Contact,
  type DayNote,
  type Field,
  type Project,
  type RecurringRule,
  type Task,
} from "./model";

const DB_NAME = "ghi-chu";
const DB_VERSION = 1;

export interface StoredFile {
  path: string;
  content: string;
  /** Blob SHA from the last successful sync. null = never pushed. */
  sha: string | null;
  /**
   * Content as of the last successful sync. Kept so a conflict can be resolved
   * as a real three-way merge instead of a coin flip between two versions.
   */
  base: string | null;
  /** Local edits not yet pushed. */
  dirty: boolean;
  /** Tombstone: file was deleted locally, deletion not yet pushed. */
  deleted: boolean;
}

export interface Settings {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  /** Push automatically after edits, vs. only when the user asks. */
  autoSync: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  owner: "",
  repo: "",
  branch: "main",
  token: "",
  autoSync: true,
};

export interface Snapshot {
  ready: boolean;
  fields: Field[];
  projects: Project[];
  tasks: Task[];
  days: DayNote[];
  contacts: Contact[];
  recurring: RecurringRule[];
  settings: Settings;
  /** Number of files with unpushed changes. Drives the sync indicator. */
  pending: number;
  syncState: SyncState;
}

export type SyncState =
  | { status: "idle"; lastSync: number | null }
  | { status: "syncing" }
  | { status: "error"; message: string };

const EMPTY: Snapshot = {
  ready: false,
  fields: [],
  projects: [],
  tasks: [],
  days: [],
  contacts: [],
  recurring: [],
  settings: DEFAULT_SETTINGS,
  pending: 0,
  syncState: { status: "idle", lastSync: null },
};

// --------------------------------------------------------------------------

export class Store {
  private db: IDBPDatabase | null = null;
  private files = new Map<string, StoredFile>();
  /** Per-project parse result, so `extra` lines survive a round trip. */
  private projectFiles = new Map<string, ProjectFile>();
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = EMPTY;
  private initPromise: Promise<void> | null = null;

  // ------------------------------------------------------------ lifecycle --

  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("files", { keyPath: "path" });
        db.createObjectStore("meta");
      },
    });

    for (const file of await this.db.getAll("files")) {
      this.files.set(file.path, file as StoredFile);
    }
    const settings = (await this.db.get("meta", "settings")) as Settings | undefined;
    const lastSync = (await this.db.get("meta", "lastSync")) as number | undefined;

    this.rebuild({
      settings: { ...DEFAULT_SETTINGS, ...settings },
      syncState: { status: "idle", lastSync: lastSync ?? null },
      ready: true,
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Snapshot => this.snapshot;

  private emit(): void {
    for (const l of this.listeners) l();
  }

  // ------------------------------------------------------------- internals --

  /** Re-derives the whole model from `this.files`. Cheap; a year is ~400 files. */
  private rebuild(patch: Partial<Snapshot> = {}): void {
    const fields = parseFieldsFile(this.read(paths.fields) ?? "");
    const fieldByCode = new Map(fields.map((f) => [f.code, f]));

    const registry = new Map<string, Project>();
    for (const p of parseProjectsFile(this.read(paths.projects) ?? "")) {
      registry.set(p.code, p);
    }

    this.projectFiles.clear();
    const tasks: Task[] = [];

    for (const [path, file] of this.files) {
      if (file.deleted || !path.startsWith("data/tasks/")) continue;
      const code = codeFromProjectPath(path);
      if (!code) continue;

      const parsed = parseProjectFile(file.content, code);
      this.projectFiles.set(code, parsed);

      // The project file's own frontmatter wins on `next`: it sits next to the
      // ids it hands out, so it cannot lag behind them.
      const known = registry.get(code);
      const merged: Project = {
        ...parsed.project,
        ...(known ? { name: known.name, archived: known.archived } : {}),
        ...(known?.field ? { field: known.field } : {}),
        next: Math.max(parsed.project.next, known?.next ?? 1),
      };

      // A field owns the category, so moving a field between groups carries its
      // projects with it rather than leaving them stranded.
      const field = merged.field ? fieldByCode.get(merged.field) : undefined;
      if (merged.field && !field) delete merged.field; // field was removed
      if (field) merged.category = field.category;
      registry.set(code, merged);

      // Category lives on the project, not the task line, so a task always
      // reflects the bucket its project currently sits in.
      for (const t of parsed.tasks) tasks.push({ ...t, category: merged.category });
    }

    const days: DayNote[] = [];
    for (const [path, file] of this.files) {
      if (file.deleted || !path.startsWith("data/days/")) continue;
      const date = dateFromDayPath(path);
      if (date) days.push(parseDayNote(file.content, date));
    }
    days.sort((a, b) => b.date.localeCompare(a.date));

    let pending = 0;
    for (const f of this.files.values()) if (f.dirty || f.deleted) pending++;

    this.snapshot = {
      ...this.snapshot,
      fields: fields.sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order),
      projects: [...registry.values()].sort((a, b) => a.code.localeCompare(b.code)),
      tasks,
      days,
      contacts: parseContactsFile(this.read(paths.contacts) ?? ""),
      recurring: parseRecurringFile(this.read(paths.recurring) ?? ""),
      pending,
      ...patch,
    };
    this.emit();
  }

  private read(path: string): string | null {
    const f = this.files.get(path);
    return f && !f.deleted ? f.content : null;
  }

  /** Stages file writes, marks them dirty, persists, then rebuilds the model. */
  private write(entries: Array<{ path: string; content: string }>): void {
    for (const { path, content } of entries) {
      const existing = this.files.get(path);
      if (existing && existing.content === content && !existing.deleted) continue;
      this.files.set(path, {
        path,
        content,
        sha: existing?.sha ?? null,
        base: existing?.base ?? null,
        dirty: true,
        deleted: false,
      });
    }
    this.persist(entries.map((e) => e.path));
    this.rebuild();
  }

  private remove(path: string): void {
    const existing = this.files.get(path);
    if (!existing) return;
    if (existing.sha === null) {
      // Never pushed, so there is nothing on the remote to delete.
      this.files.delete(path);
      void this.db?.delete("files", path);
    } else {
      this.files.set(path, { ...existing, dirty: true, deleted: true, content: "" });
      this.persist([path]);
    }
    this.rebuild();
  }

  private persist(changed: string[]): void {
    if (!this.db) return;
    const db = this.db;
    void (async () => {
      const tx = db.transaction("files", "readwrite");
      for (const path of changed) {
        const file = this.files.get(path);
        if (file) await tx.store.put(file);
      }
      await tx.done;
    })();
  }

  /** Serialises a project back to Markdown, keeping unrecognised lines. */
  private projectFileContent(project: Project, tasks: Task[]): string {
    const previous = this.projectFiles.get(project.code);
    return serializeProjectFile({
      project,
      tasks,
      extra: previous?.extra ?? [],
    });
  }

  private tasksOf(code: string): Task[] {
    return this.snapshot.tasks.filter((t) => t.project === code);
  }

  private projectOf(code: string): Project | undefined {
    return this.snapshot.projects.find((p) => p.code === code);
  }

  /** Rewrites projects.md plus the given project files in one batch. */
  private writeProjects(projects: Project[], projectFiles: Array<{ project: Project; tasks: Task[] }>): void {
    const merged = new Map(this.snapshot.projects.map((p) => [p.code, p]));
    for (const p of projects) merged.set(p.code, p);

    this.write([
      { path: paths.projects, content: serializeProjectsFile([...merged.values()]) },
      ...projectFiles.map(({ project, tasks }) => ({
        path: paths.project(project.code),
        content: this.projectFileContent(project, tasks),
      })),
    ]);
  }

  // ------------------------------------------------------------- mutations --

  createField(name: string, code: string, category: Category): Field {
    const fields = this.snapshot.fields;
    const field: Field = {
      code: code.toUpperCase(),
      name: name.trim() || code.toUpperCase(),
      category,
      order: fields.filter((f) => f.category === category).length + 1,
    };
    this.write([
      { path: paths.fields, content: serializeFieldsFile([...fields, field]) },
    ]);
    return field;
  }

  updateField(code: string, patch: Partial<Omit<Field, "code">>): void {
    const fields = this.snapshot.fields.map((f) =>
      f.code === code ? { ...f, ...patch } : f
    );
    const changed = fields.find((f) => f.code === code);
    if (!changed) return;

    // Moving a field to the other group moves its projects too, so the tree
    // never ends up with a work project hanging under a personal field.
    const affected = this.snapshot.projects.filter((p) => p.field === code);
    const updated = affected.map((p) => ({ ...p, category: changed.category }));

    this.write([{ path: paths.fields, content: serializeFieldsFile(fields) }]);
    if (updated.length) {
      this.writeProjects(
        updated,
        updated.map((project) => ({ project, tasks: this.tasksOf(project.code) }))
      );
    }
  }

  /**
   * Removes a field. Its projects are kept and simply become unassigned —
   * deleting a label must never delete the work filed under it.
   */
  deleteField(code: string): void {
    const fields = this.snapshot.fields.filter((f) => f.code !== code);
    const orphaned = this.snapshot.projects
      .filter((p) => p.field === code)
      .map((p) => {
        const next = { ...p };
        delete next.field;
        return next;
      });

    this.write([{ path: paths.fields, content: serializeFieldsFile(fields) }]);
    if (orphaned.length) {
      this.writeProjects(
        orphaned,
        orphaned.map((project) => ({ project, tasks: this.tasksOf(project.code) }))
      );
    }
  }

  reorderFields(category: Category, orderedCodes: string[]): void {
    const rank = new Map(orderedCodes.map((c, i) => [c, i + 1]));
    const fields = this.snapshot.fields.map((f) =>
      f.category === category && rank.has(f.code) ? { ...f, order: rank.get(f.code)! } : f
    );
    this.write([{ path: paths.fields, content: serializeFieldsFile(fields) }]);
  }

  /**
   * Changes a project's code, rewriting every task id under it.
   *
   * The code is the prefix of every id in the project and the name of its
   * file, so this touches four things at once: the registry row, the file
   * path, each task id, and any recurring rule pointing at the old code.
   *
   * Ids are rewritten rather than left alone — `data/tasks/BETA.md` full of
   * `BET-0042` would be its own kind of confusing — which does mean a code you
   * quoted somewhere else changes. That is the trade for being able to fix a
   * typo, and the dialog says so before you confirm.
   */
  renameProjectCode(oldCode: string, newCode: string): { ok: boolean; reason?: string } {
    const from = oldCode.toUpperCase();
    const to = newCode.toUpperCase();
    if (from === to) return { ok: true };

    const project = this.projectOf(from);
    if (!project) return { ok: false, reason: "Không tìm thấy dự án." };
    if (this.projectOf(to)) return { ok: false, reason: `Mã ${to} đã được dùng.` };

    const renamed: Project = { ...project, code: to };
    const tasks = this.tasksOf(from).map((t) => ({
      ...t,
      id: `${to}-${t.id.split("-")[1] ?? "0001"}`,
      project: to,
    }));

    const registry = this.snapshot.projects
      .filter((p) => p.code !== from)
      .concat(renamed);

    const writes = [
      { path: paths.projects, content: serializeProjectsFile(registry) },
      {
        path: paths.project(to),
        content: serializeProjectFile({
          project: renamed,
          tasks,
          extra: this.projectFiles.get(from)?.extra ?? [],
        }),
      },
    ];

    const rules = this.snapshot.recurring;
    if (rules.some((r) => r.project === from)) {
      writes.push({
        path: paths.recurring,
        content: serializeRecurringFile(
          rules.map((r) => (r.project === from ? { ...r, project: to } : r))
        ),
      });
    }

    // Drop the old file first: otherwise the rebuild in between would see both
    // files and resurrect the old project into the registry.
    this.remove(paths.project(from));
    this.write(writes);
    return { ok: true };
  }

  /** Changes a field's code, repointing every project that referenced it. */
  renameFieldCode(oldCode: string, newCode: string): { ok: boolean; reason?: string } {
    const from = oldCode.toUpperCase();
    const to = newCode.toUpperCase();
    if (from === to) return { ok: true };

    const field = this.snapshot.fields.find((f) => f.code === from);
    if (!field) return { ok: false, reason: "Không tìm thấy lĩnh vực." };
    if (this.snapshot.fields.some((f) => f.code === to)) {
      return { ok: false, reason: `Mã ${to} đã được dùng.` };
    }

    const fields = this.snapshot.fields.map((f) =>
      f.code === from ? { ...f, code: to } : f
    );
    const moved = this.snapshot.projects
      .filter((p) => p.field === from)
      .map((p) => ({ ...p, field: to }));

    this.write([{ path: paths.fields, content: serializeFieldsFile(fields) }]);
    if (moved.length) {
      this.writeProjects(
        moved,
        moved.map((project) => ({ project, tasks: this.tasksOf(project.code) }))
      );
    }
    return { ok: true };
  }

  createProject(
    name: string,
    code: string,
    category: Category,
    field?: string
  ): Project {
    // The field decides the group when one is given — that is the whole point
    // of the extra level.
    const owner = field ? this.snapshot.fields.find((f) => f.code === field) : undefined;
    const project: Project = {
      code: code.toUpperCase(),
      name: name.trim() || code.toUpperCase(),
      category: owner?.category ?? category,
      ...(owner ? { field: owner.code } : {}),
      next: 1,
      archived: false,
    };
    this.writeProjects([project], [{ project, tasks: [] }]);
    return project;
  }

  updateProject(code: string, patch: Partial<Omit<Project, "code" | "next">>): void {
    const project = this.projectOf(code);
    if (!project) return;

    const updated: Project = { ...project, ...patch };
    if (patch.field === undefined && "field" in patch) delete updated.field;

    const owner = updated.field
      ? this.snapshot.fields.find((f) => f.code === updated.field)
      : undefined;
    if (owner) updated.category = owner.category;

    this.writeProjects([updated], [{ project: updated, tasks: this.tasksOf(code) }]);
  }

  addTask(input: {
    title: string;
    project?: string;
    category?: Category;
    tags?: string[];
    starred?: boolean;
  }): Task | null {
    // Tags typed inline ("Gọi khách #Alpha") are lifted out of the title, so
    // the stored title stays clean and the tag is not written back twice.
    const { title, tags } = extractTags(input.title.trim());
    if (!title) return null;
    const allTags = [...new Set([...tags, ...(input.tags ?? [])])];

    const category = input.category ?? "WRK";
    const code = (input.project || defaultProjectFor(category)).toUpperCase();
    const project = this.projectOf(code) ?? this.createProject(code, code, category);

    const { id, project: advanced } = allocateTaskId(project);
    const task: Task = {
      id,
      project: advanced.code,
      // A project belongs to exactly one group, so filing a task decides its
      // category. Passing both is a request to file it under that project.
      category: advanced.category,
      title,
      done: false,
      created: toStamp(new Date()),
      ...(input.starred ? { starred: true } : {}),
      ...(allTags.length ? { tags: allTags } : {}),
    };

    this.writeProjects([advanced], [
      { project: advanced, tasks: [...this.tasksOf(advanced.code), task] },
    ]);
    return task;
  }

  updateTask(id: string, patch: Partial<Pick<Task, "title" | "starred" | "tags">>): void {
    this.mutateTask(id, (t) => {
      if (patch.title === undefined) return { ...t, ...patch };
      // Editing a title can introduce or remove inline #tags; keep the two in
      // step rather than letting them drift apart.
      const { title, tags } = extractTags(patch.title);
      const merged = [...new Set([...(patch.tags ?? t.tags ?? []), ...tags])];
      const next: Task = { ...t, ...patch, title };
      if (merged.length) next.tags = merged;
      else delete next.tags;
      return next;
    });
  }

  toggleTask(id: string): void {
    this.mutateTask(id, (t) => {
      const done = !t.done;
      const next: Task = { ...t, done };
      if (done) next.completed = toStamp(new Date());
      else delete next.completed;
      return next;
    });
  }

  deleteTask(id: string): void {
    const task = this.snapshot.tasks.find((t) => t.id === id);
    const project = task && this.projectOf(task.project);
    if (!task || !project) return;

    // The counter is not rolled back: reusing a freed id would break every
    // reference to it, which is the exact defect of the old numbering scheme.
    this.writeProjects([], [
      { project, tasks: this.tasksOf(project.code).filter((t) => t.id !== id) },
    ]);
  }

  /**
   * Re-marks a task done with a specific stamp — the undo path for an
   * accidental reopen, which would otherwise silently discard the original
   * completion time.
   */
  markDone(id: string, completed: string): void {
    this.mutateTask(id, (t) => ({ ...t, done: true, completed }));
  }

  /**
   * Removes a project outright — allowed only while it holds no tasks, so a
   * typo project can be cleaned up but real work can never vanish with it.
   */
  deleteProject(code: string): { ok: boolean; reason?: string } {
    const project = this.projectOf(code.toUpperCase());
    if (!project) return { ok: false, reason: "Không tìm thấy dự án." };
    if (this.tasksOf(project.code).length > 0) {
      return { ok: false, reason: "Dự án còn việc — chỉ xoá được dự án rỗng." };
    }

    const registry = this.snapshot.projects.filter((p) => p.code !== project.code);
    this.remove(paths.project(project.code));
    this.write([{ path: paths.projects, content: serializeProjectsFile(registry) }]);
    return { ok: true };
  }

  /**
   * Puts a deleted task back, exactly as it was.
   *
   * Exists so that deleting can be undone from a toast instead of guarded by a
   * confirm dialog — one accidental tap should never cost real work. Safe to
   * call late: the id was allocated before the delete and counters never roll
   * back, so the restored id can never collide with a newer task.
   */
  restoreTask(task: Task): void {
    if (this.snapshot.tasks.some((t) => t.id === task.id)) return; // already back
    const project = this.projectOf(task.project);
    if (!project) return; // project itself was removed meanwhile

    this.writeProjects([], [
      { project, tasks: [...this.tasksOf(project.code), task] },
    ]);
  }

  /** Moves a task to another project. The permanent id stays, like a ticket key. */
  moveTask(id: string, toCode: string): void {
    const task = this.snapshot.tasks.find((t) => t.id === id);
    const from = task && this.projectOf(task.project);
    const to = this.projectOf(toCode.toUpperCase());
    if (!task || !from || !to || from.code === to.code) return;

    const moved: Task = { ...task, project: to.code, category: to.category };
    this.writeProjects([], [
      { project: from, tasks: this.tasksOf(from.code).filter((t) => t.id !== id) },
      { project: to, tasks: [...this.tasksOf(to.code), moved] },
    ]);
  }

  private mutateTask(id: string, fn: (task: Task) => Task): void {
    const task = this.snapshot.tasks.find((t) => t.id === id);
    const project = task && this.projectOf(task.project);
    if (!task || !project) return;

    this.writeProjects([], [
      {
        project,
        tasks: this.tasksOf(project.code).map((t) => (t.id === id ? fn(t) : t)),
      },
    ]);
  }

  /** Writes a day's free-form note. An empty body deletes the file. */
  setDayNote(date: string, body: string): void {
    const path = paths.day(date);
    if (!body.trim()) this.remove(path);
    else this.write([{ path, content: serializeDayNote({ date, body }) }]);
  }

  setContacts(contacts: Contact[]): void {
    this.write([{ path: paths.contacts, content: serializeContactsFile(contacts) }]);
  }

  setRecurring(rules: RecurringRule[]): void {
    this.write([{ path: paths.recurring, content: serializeRecurringFile(rules) }]);
  }

  // -------------------------------------------------------------- settings --

  async setSettings(patch: Partial<Settings>): Promise<void> {
    const settings = { ...this.snapshot.settings, ...patch };
    await this.db?.put("meta", settings, "settings");
    this.snapshot = { ...this.snapshot, settings };
    this.emit();
  }

  // ------------------------------------------------------------ sync hooks --

  /** Files the sync layer needs to push. */
  dirtyFiles(): StoredFile[] {
    return [...this.files.values()].filter((f) => f.dirty || f.deleted);
  }

  allFiles(): StoredFile[] {
    return [...this.files.values()];
  }

  /** Records a successful push: clears dirty, stores the new blob SHA. */
  markPushed(results: Array<{ path: string; sha: string | null }>): void {
    for (const { path, sha } of results) {
      const file = this.files.get(path);
      if (!file) continue;
      if (sha === null) {
        this.files.delete(path);
        void this.db?.delete("files", path);
      } else {
        // What we just pushed becomes the shared base for the next merge.
        this.files.set(path, { ...file, sha, base: file.content, dirty: false });
      }
    }
    this.persist(results.map((r) => r.path));
    this.rebuild();
  }

  /** Applies files fetched from the remote, overwriting local copies. */
  applyRemote(files: Array<{ path: string; content: string; sha: string }>): void {
    for (const { path, content, sha } of files) {
      this.files.set(path, {
        path,
        content,
        sha,
        base: content,
        dirty: false,
        deleted: false,
      });
    }
    this.persist(files.map((f) => f.path));
    this.rebuild();
  }

  /**
   * Stores the result of a merge: the content is new locally (so it still has
   * to be pushed) but its base is the remote version it was reconciled against.
   */
  applyMerged(
    files: Array<{ path: string; content: string; sha: string; base: string }>
  ): void {
    for (const { path, content, sha, base } of files) {
      this.files.set(path, { path, content, sha, base, dirty: true, deleted: false });
    }
    this.persist(files.map((f) => f.path));
    this.rebuild();
  }

  /** Drops local files the remote no longer has. */
  dropMissing(keepPaths: Set<string>): void {
    const removed: string[] = [];
    for (const [path, file] of this.files) {
      if (keepPaths.has(path) || file.dirty || file.deleted) continue;
      this.files.delete(path);
      removed.push(path);
    }
    if (!removed.length) return;
    void (async () => {
      const db = this.db;
      if (!db) return;
      const tx = db.transaction("files", "readwrite");
      for (const path of removed) await tx.store.delete(path);
      await tx.done;
    })();
    this.rebuild();
  }

  setSyncState(state: SyncState): void {
    this.snapshot = { ...this.snapshot, syncState: state };
    if (state.status === "idle" && state.lastSync) {
      void this.db?.put("meta", state.lastSync, "lastSync");
    }
    this.emit();
  }

  /**
   * Lays down first-run files. They are staged as unpushed, so once GitHub is
   * connected the starting data is uploaded rather than silently stranded on
   * this device.
   */
  seed(files: Array<{ path: string; content: string }>): void {
    this.write(files);
  }

  /** Test seam: load files without touching IndexedDB. */
  loadForTest(files: Array<{ path: string; content: string }>): void {
    for (const { path, content } of files) {
      this.files.set(path, {
        path,
        content,
        sha: "seed",
        base: content,
        dirty: false,
        deleted: false,
      });
    }
    this.rebuild({ ready: true });
  }
}

export const store = new Store();
