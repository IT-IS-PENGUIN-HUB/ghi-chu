/**
 * Three-way merge, for the case where the phone and the PC were both edited
 * offline.
 *
 * Everything here keys off the permanent task id (`ALP-0042`) and the registry
 * codes — identifiers that never change once issued, which is what makes an
 * automatic merge safe rather than a guess. The base version is the content at
 * the last successful sync, kept alongside each file for exactly this purpose.
 *
 * The rule everywhere: if only one side moved, take that side. If both moved,
 * prefer the change that cannot be recovered by redoing an action — a task
 * marked done, a line that still exists — and never drop a row silently.
 */
import {
  parseContactsFile,
  parseFieldsFile,
  parseProjectFile,
  parseProjectsFile,
  parseRecurringFile,
  serializeContactsFile,
  serializeFieldsFile,
  serializeProjectFile,
  serializeProjectsFile,
  serializeRecurringFile,
} from "./markdown";
import { parseStamp, type Task } from "./model";

export interface MergeInput {
  path: string;
  /** Content at the last successful sync. null when this device never had it. */
  base: string | null;
  local: string;
  remote: string;
}

export interface MergeOutput {
  content: string;
  /** True when both sides changed and the result is a genuine reconciliation. */
  merged: boolean;
}

export function mergeFile(input: MergeInput): MergeOutput {
  const { path, base, local, remote } = input;

  if (local === remote) return { content: local, merged: false };
  if (base !== null && local === base) return { content: remote, merged: false };
  if (base !== null && remote === base) return { content: local, merged: false };

  if (path.startsWith("data/tasks/")) return mergeProject(input);
  if (path.startsWith("data/days/")) return mergeNote(input);
  if (path.endsWith("/projects.md")) return mergeProjects(input);
  if (path.endsWith("/fields.md")) return mergeFields(input);
  if (path.endsWith("/contacts.md")) return mergeContacts(input);
  if (path.endsWith("/recurring.md")) return mergeRecurring(input);

  // Unknown file: keep both rather than pick a winner.
  return { content: `${local}\n${CONFLICT_MARKER}\n${remote}\n`, merged: true };
}

const CONFLICT_MARKER =
  "\n<!-- ↑ bản trên máy này · ↓ bản trên GitHub — sửa lại rồi xoá dòng này -->\n";

// ------------------------------------------------------------ project file --

function mergeProject({ base, local, remote, path }: MergeInput): MergeOutput {
  const code = /\/([A-Z][A-Z0-9]{1,4})\.md$/.exec(path)?.[1] ?? "ETC";
  const baseFile = base === null ? null : parseProjectFile(base, code);
  const localFile = parseProjectFile(local, code);
  const remoteFile = parseProjectFile(remote, code);

  const baseTasks = new Map((baseFile?.tasks ?? []).map((t) => [t.id, t]));
  const localTasks = new Map(localFile.tasks.map((t) => [t.id, t]));
  const remoteTasks = new Map(remoteFile.tasks.map((t) => [t.id, t]));

  const merged: Task[] = [];
  for (const id of new Set([...localTasks.keys(), ...remoteTasks.keys()])) {
    const b = baseTasks.get(id);
    const l = localTasks.get(id);
    const r = remoteTasks.get(id);

    // Deleted on one side, untouched on the other: honour the delete.
    if (!l && r) {
      if (b && same(b, r)) continue;
      merged.push(r);
      continue;
    }
    if (l && !r) {
      if (b && same(b, l)) continue;
      merged.push(l);
      continue;
    }
    if (!l || !r) continue;

    if (same(l, r)) merged.push(l);
    else if (b && same(b, l)) merged.push(r);
    else if (b && same(b, r)) merged.push(l);
    else merged.push(reconcile(l, r));
  }

  // The counter must clear the highest id either side ever handed out, or the
  // next task would collide with one that already exists on the other device.
  const highest = merged.reduce((max, t) => {
    const n = Number.parseInt(t.id.split("-")[1] ?? "0", 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

  return {
    content: serializeProjectFile({
      project: {
        ...localFile.project,
        next: Math.max(localFile.project.next, remoteFile.project.next, highest + 1),
      },
      tasks: merged,
      extra: [...new Set([...localFile.extra, ...remoteFile.extra])],
    }),
    merged: true,
  };
}

function same(a: Task, b: Task): boolean {
  return (
    a.title === b.title &&
    a.done === b.done &&
    a.completed === b.completed &&
    Boolean(a.starred) === Boolean(b.starred) &&
    (a.tags ?? []).join() === (b.tags ?? []).join()
  );
}

/** Both sides edited the same task. */
function reconcile(local: Task, remote: Task): Task {
  // Finishing something is the change worth keeping: if either device marked it
  // done, it is done. Un-ticking a box is one tap to redo; losing the record
  // that the work was finished is not.
  if (local.done !== remote.done) {
    const done = local.done ? local : remote;
    const other = local.done ? remote : local;
    return { ...done, title: newerTitle(done, other) };
  }
  // Same status, different text: keep the later edit by completion stamp, else
  // prefer the local one the user is looking at right now.
  return { ...local, title: newerTitle(local, remote) };
}

function newerTitle(a: Task, b: Task): string {
  const at = parseStamp(a.completed ?? a.created)?.getTime() ?? 0;
  const bt = parseStamp(b.completed ?? b.created)?.getTime() ?? 0;
  if (a.title === b.title) return a.title;
  return bt > at ? b.title : a.title;
}

// ---------------------------------------------------------------- day note --

function mergeNote({ local, remote }: MergeInput): MergeOutput {
  // Prose has no stable keys, so there is nothing to merge on. Both versions
  // are kept and the user reconciles — better than picking a loser.
  const body = `${local.trimEnd()}\n${CONFLICT_MARKER}\n${remote.trimEnd()}\n`;
  return { content: body, merged: true };
}

// ---------------------------------------------------------------- registries --

/** Union by key; on a genuine conflict the local row wins. */
function mergeKeyed<T>(
  base: T[] | null,
  local: T[],
  remote: T[],
  key: (row: T) => string,
  equal: (a: T, b: T) => boolean
): T[] {
  const baseMap = new Map((base ?? []).map((r) => [key(r), r]));
  const localMap = new Map(local.map((r) => [key(r), r]));
  const remoteMap = new Map(remote.map((r) => [key(r), r]));

  const out: T[] = [];
  for (const k of new Set([...localMap.keys(), ...remoteMap.keys()])) {
    const b = baseMap.get(k);
    const l = localMap.get(k);
    const r = remoteMap.get(k);

    if (!l && r) {
      if (!(b && equal(b, r))) out.push(r);
      continue;
    }
    if (l && !r) {
      if (!(b && equal(b, l))) out.push(l);
      continue;
    }
    if (!l || !r) continue;

    if (equal(l, r)) out.push(l);
    else if (b && equal(b, l)) out.push(r);
    else out.push(l);
  }
  return out;
}

function mergeProjects({ base, local, remote }: MergeInput): MergeOutput {
  const rows = mergeKeyed(
    base === null ? null : parseProjectsFile(base),
    parseProjectsFile(local),
    parseProjectsFile(remote),
    (p) => p.code,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  );

  // Counters only ever move forward, so take the higher of the two.
  const remoteNext = new Map(parseProjectsFile(remote).map((p) => [p.code, p.next]));
  return {
    content: serializeProjectsFile(
      rows.map((p) => ({ ...p, next: Math.max(p.next, remoteNext.get(p.code) ?? 1) }))
    ),
    merged: true,
  };
}

function mergeFields({ base, local, remote }: MergeInput): MergeOutput {
  return {
    content: serializeFieldsFile(
      mergeKeyed(
        base === null ? null : parseFieldsFile(base),
        parseFieldsFile(local),
        parseFieldsFile(remote),
        (f) => f.code,
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
      )
    ),
    merged: true,
  };
}

function mergeContacts({ base, local, remote }: MergeInput): MergeOutput {
  return {
    content: serializeContactsFile(
      mergeKeyed(
        base === null ? null : parseContactsFile(base),
        parseContactsFile(local),
        parseContactsFile(remote),
        (c) => `${c.group}|${c.phone}`,
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
      )
    ),
    merged: true,
  };
}

function mergeRecurring({ base, local, remote }: MergeInput): MergeOutput {
  const rows = mergeKeyed(
    base === null ? null : parseRecurringFile(base),
    parseRecurringFile(local),
    parseRecurringFile(remote),
    (r) => r.id,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  );

  // Keep the later run date so a rule cannot fire twice for the same day.
  const remoteRuns = new Map(parseRecurringFile(remote).map((r) => [r.id, r.lastRun]));
  return {
    content: serializeRecurringFile(
      rows.map((r) => {
        const other = remoteRuns.get(r.id);
        return other && (!r.lastRun || other > r.lastRun) ? { ...r, lastRun: other } : r;
      })
    ),
    merged: true,
  };
}
