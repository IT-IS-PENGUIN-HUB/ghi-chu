/**
 * Sync scheduling.
 *
 * The design constraint is that this thing sits on the desktop all day, so it
 * must cost nothing while idle. There is no polling timer anywhere: a push is
 * scheduled only by an edit, and a pull happens only when the window is
 * brought back to the front or the network returns. An untouched app makes
 * zero requests and burns no CPU.
 */
import {
  commitMessage,
  fetchBlob,
  listRemote,
  push,
  type RepoConfig,
} from "./github";
import { mergeFile } from "./merge";
import { store } from "./store";

/** Long enough to batch a sentence of typing, short enough to feel immediate. */
const PUSH_DEBOUNCE_MS = 4000;
/** A pull this recent is treated as current, so tab-switching is free. */
const PULL_FRESHNESS_MS = 60_000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let lastPullAt = 0;
/** Head commit as of the last time we looked; lets a push detect a race. */
let knownCommit: string | null = null;

function config(): RepoConfig | null {
  const { owner, repo, branch, token } = store.getSnapshot().settings;
  if (!owner || !repo || !token) return null;
  return { owner, repo, branch: branch || "main", token };
}

export function isConfigured(): boolean {
  return config() !== null;
}

/** Forgets cached sync state — call after the repo or token changes. */
export function resetSyncState(): void {
  knownCommit = null;
  lastPullAt = 0;
}

/**
 * Pulls, merges anything that moved on both sides, then pushes what is left.
 *
 * Runs as a single sequence so a merge is always computed against the version
 * the push is about to overwrite.
 */
export async function syncNow(
  options: { force?: boolean } = {}
): Promise<void> {
  const repo = config();
  if (!repo) return;
  if (running) return running;

  running = (async () => {
    store.setSyncState({ status: "syncing" });
    try {
      await step("Tải về", () => pull(repo, options.force ?? false));
      await step("Đẩy lên", () => pushPending(repo));
      lastPullAt = Date.now();
      store.setSyncState({ status: "idle", lastSync: Date.now() });
    } catch (error) {
      store.setSyncState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = null;
    }
  })();

  return running;
}

/**
 * Names the half of the sync that failed.
 *
 * "Lỗi GitHub 422" on its own says nothing about what to check; "Đẩy lên: …"
 * versus "Tải về: …" is the difference between a token that cannot write and a
 * repo that cannot be read.
 */
async function step<T>(phase: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${phase}: ${message}`);
  }
}

async function pull(repo: RepoConfig, force: boolean): Promise<void> {
  const { commit, files: remoteList } = await listRemote(repo);

  // A matching head means nothing changed upstream — no blobs to fetch.
  if (!force && commit === knownCommit) return;

  const before = new Map(store.allFiles().map(f => [f.path, f]));
  const remotePaths = new Set(remoteList.map(f => f.path));

  // --- download first, decide nothing yet -------------------------------
  //
  // Every await below is a window in which the person can keep typing. The
  // old code chose "take the remote version" *before* that window and applied
  // it after, so a sentence written while a blob was in flight was overwritten
  // by the download and the file was marked clean — the edit was gone and the
  // app no longer even showed it as unsaved.
  const fetched: Array<{ path: string; content: string; sha: string }> = [];
  for (const entry of remoteList) {
    const mine = before.get(entry.path);
    // Same blob SHA means byte-identical content; skip the download.
    if (mine && mine.sha === entry.sha && !mine.dirty) continue;

    // Deleted here, still present there: the delete is pending and wins on
    // the next push. Asked before the download, because fetching a file we are
    // about to remove is a request that can only cost time and fail.
    if (mine?.deleted) continue;

    fetched.push({
      path: entry.path,
      content: await fetchBlob(repo, entry.sha),
      sha: entry.sha,
    });
  }

  // --- then decide and apply, against what the files look like *now* ----
  //
  // No await from here to the end, so nothing can change underneath: whatever
  // was typed during the download is seen, and a file that turned dirty in the
  // meantime goes through a three-way merge instead of being replaced.
  const current = new Map(store.allFiles().map(f => [f.path, f]));

  const fresh: Array<{ path: string; content: string; sha: string }> = [];
  const merged: Array<{
    path: string;
    content: string;
    sha: string;
    base: string;
  }> = [];

  for (const blob of fetched) {
    const mine = current.get(blob.path);
    if (mine?.deleted) continue;

    if (!mine || !mine.dirty) {
      fresh.push(blob);
      continue;
    }

    const result = mergeFile({
      path: blob.path,
      base: mine.base,
      local: mine.content,
      remote: blob.content,
    });
    merged.push({
      path: blob.path,
      content: result.content,
      sha: blob.sha,
      base: blob.content,
    });
  }

  if (fresh.length) store.applyRemote(fresh);
  if (merged.length) store.applyMerged(merged);

  // Files the remote no longer has and that we have not edited were deleted
  // elsewhere; mirror that rather than silently resurrecting them on push.
  store.dropMissing(remotePaths);

  // Only now. Recording the head before the downloads meant that a pull cut
  // off by a dropped connection still counted as done: the next sync saw a
  // matching head, skipped the pull entirely, and pushed the stale local copy
  // straight over the newer one on GitHub.
  knownCommit = commit;
}

/** Enough to outlast another device's burst, few enough to end. */
const PUSH_ATTEMPTS = 3;

async function pushPending(repo: RepoConfig): Promise<void> {
  for (let attempt = 1; attempt <= PUSH_ATTEMPTS; attempt++) {
    const dirty = store.dirtyFiles();
    if (!dirty.length) return;

    const result = await push(repo, dirty, knownCommit, commitMessage(dirty));
    if (result) {
      knownCommit = result.commit;
      store.markPushed(result.files);
      return;
    }

    // Someone committed between our pull and our push. Re-pull, merge, and go
    // again with the reconciled version. The old code tried exactly once and
    // then went quiet, which on a repo two devices both write to meant the
    // push could fail for good while the app still looked idle.
    knownCommit = null;
    await pull(repo, true);
  }

  throw new Error(
    "Máy khác đẩy lên liên tục nên lần này chưa gửi được. " +
      "Thay đổi vẫn nằm nguyên trên máy, sẽ tự gửi lại ở lần sau."
  );
}

/** Called after every mutation; collapses a burst of edits into one commit. */
export function schedulePush(): void {
  if (!isConfigured() || !store.getSnapshot().settings.autoSync) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Called when the window regains focus. Skips the request entirely if we
 * looked recently, so alt-tabbing around does not hammer the API.
 */
export function pullIfStale(): void {
  if (!isConfigured()) return;
  if (Date.now() - lastPullAt < PULL_FRESHNESS_MS) return;
  void syncNow();
}

/** Pushes immediately, ignoring the debounce — used when the tab is closing. */
export function flushPush(): void {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  void syncNow();
}
