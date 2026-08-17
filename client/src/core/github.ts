/**
 * GitHub as the sync backend.
 *
 * Pushes go through the Git Data API rather than the Contents API: a batch of
 * edits becomes one commit with one tree, so the repo history reads like "what
 * I did at 14:48" instead of eleven separate file commits. Pulls use the tree
 * endpoint, which returns the whole file list plus blob SHAs in one request —
 * a year of notes costs one round trip to check, not four hundred.
 *
 * Merge unit is the file, and conflicts inside a project file are resolved
 * line-by-line on the permanent task id, which is stable precisely so this
 * works.
 */
import { type StoredFile } from "./store";

const API = "https://api.github.com";

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface RemoteFile {
  path: string;
  sha: string;
  content: string;
}

// ------------------------------------------------------------------ base64 --

/** UTF-8 safe base64, because titles are Vietnamese and Japanese. */
function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ------------------------------------------------------------------- fetch --

async function api<T>(
  config: RepoConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubError(describeFailure(res.status, body), res.status);
  }
  return res.json() as Promise<T>;
}

/** Turns GitHub's failure modes into something actionable in Vietnamese. */
function describeFailure(status: number, body: string): string {
  switch (status) {
    case 401:
      return "Token không hợp lệ hoặc đã hết hạn.";
    case 403:
      return body.includes("rate limit")
        ? "Đã chạm giới hạn số lần gọi GitHub, thử lại sau ít phút."
        : "Token thiếu quyền Contents: Read and write trên repo này.";
    case 404:
      return "Không tìm thấy repo hoặc nhánh. Kiểm tra lại chủ repo, tên repo và nhánh.";
    case 409:
      return "Repo còn rỗng — tạo một file bất kỳ (ví dụ README) rồi thử lại.";
    case 422:
      return "GitHub từ chối dữ liệu gửi lên.";
    default:
      return `Lỗi GitHub ${status}.`;
  }
}

// -------------------------------------------------------------------- read --

interface RefResponse {
  object: { sha: string };
}
interface CommitResponse {
  sha: string;
  tree: { sha: string };
}
interface TreeResponse {
  tree: Array<{ path: string; type: string; sha: string }>;
  truncated: boolean;
}
interface BlobResponse {
  content: string;
  encoding: string;
}

export async function verifyAccess(config: RepoConfig): Promise<{ defaultBranch: string }> {
  const repo = await api<{ default_branch: string; permissions?: { push?: boolean } }>(
    config,
    `/repos/${config.owner}/${config.repo}`
  );
  if (repo.permissions && repo.permissions.push === false) {
    throw new GitHubError("Token chỉ có quyền đọc — cần quyền ghi để đồng bộ.");
  }
  return { defaultBranch: repo.default_branch };
}

async function headCommit(config: RepoConfig): Promise<{ commit: string; tree: string }> {
  const ref = await api<RefResponse>(
    config,
    `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`
  );
  const commit = await api<CommitResponse>(
    config,
    `/repos/${config.owner}/${config.repo}/git/commits/${ref.object.sha}`
  );
  return { commit: commit.sha, tree: commit.tree.sha };
}

/** Lists every `data/**.md` blob with its SHA, in one request. */
export async function listRemote(
  config: RepoConfig
): Promise<{ commit: string; files: Array<{ path: string; sha: string }> }> {
  const head = await headCommit(config);
  const tree = await api<TreeResponse>(
    config,
    `/repos/${config.owner}/${config.repo}/git/trees/${head.tree}?recursive=1`
  );

  if (tree.truncated) {
    throw new GitHubError("Cây thư mục quá lớn để đọc một lần — repo này không hợp lệ cho app.");
  }

  return {
    commit: head.commit,
    files: tree.tree
      .filter((e) => e.type === "blob" && e.path.startsWith("data/") && e.path.endsWith(".md"))
      .map((e) => ({ path: e.path, sha: e.sha })),
  };
}

export async function fetchBlob(config: RepoConfig, sha: string): Promise<string> {
  const blob = await api<BlobResponse>(
    config,
    `/repos/${config.owner}/${config.repo}/git/blobs/${sha}`
  );
  return blob.encoding === "base64" ? decodeBase64(blob.content) : blob.content;
}

// ------------------------------------------------------------------- write --

export interface PushResult {
  /** Blob SHA per pushed path; null means the file was deleted. */
  files: Array<{ path: string; sha: string | null }>;
  commit: string;
}

/**
 * Commits a batch of changes as a single commit.
 *
 * Returns null when the remote has moved since `expectedCommit`, so the caller
 * can pull and merge instead of overwriting someone else's edit — the "two
 * devices offline at once" case.
 */
export async function push(
  config: RepoConfig,
  changes: StoredFile[],
  expectedCommit: string | null,
  message: string
): Promise<PushResult | null> {
  const head = await headCommit(config);
  if (expectedCommit && head.commit !== expectedCommit) return null;

  const writes = changes.filter((f) => !f.deleted);
  const deletes = changes.filter((f) => f.deleted);

  // Blobs first so the tree can reference them by SHA.
  const blobs = await Promise.all(
    writes.map(async (file) => {
      const blob = await api<{ sha: string }>(
        config,
        `/repos/${config.owner}/${config.repo}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({ content: encodeBase64(file.content), encoding: "base64" }),
        }
      );
      return { path: file.path, sha: blob.sha };
    })
  );

  const tree = await api<{ sha: string }>(
    config,
    `/repos/${config.owner}/${config.repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: head.tree,
        tree: [
          ...blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
          // A null sha removes the path from the tree.
          ...deletes.map((d) => ({ path: d.path, mode: "100644", type: "blob", sha: null })),
        ],
      }),
    }
  );

  const commit = await api<{ sha: string }>(
    config,
    `/repos/${config.owner}/${config.repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [head.commit] }),
    }
  );

  await api(
    config,
    `/repos/${config.owner}/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) }
  );

  return {
    commit: commit.sha,
    files: [
      ...blobs.map((b) => ({ path: b.path, sha: b.sha })),
      ...deletes.map((d) => ({ path: d.path, sha: null })),
    ],
  };
}

/** Human-readable commit subject, e.g. "3 thay đổi từ Ghi chú". */
export function commitMessage(changes: StoredFile[]): string {
  if (changes.length === 1) {
    const file = changes[0];
    return `${file.deleted ? "Xoá" : "Cập nhật"} ${file.path}`;
  }
  return `${changes.length} thay đổi từ Ghi chú`;
}
