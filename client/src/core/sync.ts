/**
 * Sync scheduling.
 *
 * The design constraint is that this thing sits on the desktop all day, so it
 * must cost nothing while idle. There is no polling timer anywhere: a push is
 * scheduled only by an edit, and a pull happens only when the window is
 * brought back to the front or the network returns. An untouched app makes
 * zero requests and burns no CPU.
 */
import { commitMessage, fetchBlob, listRemote, push, type RepoConfig } from "./github";
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
export async function syncNow(options: { force?: boolean } = {}): Promise<void> {
  const repo = config();
  if (!repo) return;
  if (running) return running;

  running = (async () => {
    store.setSyncState({ status: "syncing" });
    try {
      await pull(repo, options.force ?? false);
      await pushPending(repo);
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

async function pull(repo: RepoConfig, force: boolean): Promise<void> {
  const { commit, files: remoteList } = await listRemote(repo);

  // A matching head means nothing changed upstream — no blobs to fetch.
  if (!force && commit === knownCommit) return;
  knownCommit = commit;

  const local = new Map(store.allFiles().map((f) => [f.path, f]));
  const remotePaths = new Set(remoteList.map((f) => f.path));

  const fresh: Array<{ path: string; content: string; sha: string }> = [];
  const merged: Array<{ path: string; content: string; sha: string; base: string }> = [];

  for (const entry of remoteList) {
    const mine = local.get(entry.path);
    // Same blob SHA means byte-identical content; skip the download.
    if (mine && mine.sha === entry.sha && !mine.dirty) continue;

    const content = await fetchBlob(repo, entry.sha);

    if (!mine || (!mine.dirty && !mine.deleted)) {
      fresh.push({ path: entry.path, content, sha: entry.sha });
      continue;
    }

    if (mine.deleted) {
      // Deleted here, still present there: the delete is pending and wins on
      // the next push, so leave the tombstone alone.
      continue;
    }

    const result = mergeFile({
      path: entry.path,
      base: mine.base,
      local: mine.content,
      remote: content,
    });
    merged.push({ path: entry.path, content: result.content, sha: entry.sha, base: content });
  }

  if (fresh.length) store.applyRemote(fresh);
  if (merged.length) store.applyMerged(merged);

  // Files the remote no longer has and that we have not edited were deleted
  // elsewhere; mirror that rather than silently resurrecting them on push.
  store.dropMissing(remotePaths);
}

async function pushPending(repo: RepoConfig): Promise<void> {
  const dirty = store.dirtyFiles();
  if (!dirty.length) return;

  const result = await push(repo, dirty, knownCommit, commitMessage(dirty));

  if (result === null) {
    // Someone committed between our pull and our push. Re-pull and merge; the
    // next scheduled push carries the reconciled version.
    knownCommit = null;
    await pull(repo, true);
    const retry = await push(repo, store.dirtyFiles(), knownCommit, commitMessage(store.dirtyFiles()));
    if (retry) {
      knownCommit = retry.commit;
      store.markPushed(retry.files);
    }
    return;
  }

  knownCommit = result.commit;
  store.markPushed(result.files);
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
