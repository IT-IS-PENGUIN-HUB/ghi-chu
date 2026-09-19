import { beforeEach, describe, expect, it, vi } from "vitest";

const listRemote = vi.fn();
const fetchBlob = vi.fn();
const push = vi.fn();

vi.mock("./github", () => ({
  listRemote: (...a: unknown[]) => listRemote(...a),
  fetchBlob: (...a: unknown[]) => fetchBlob(...a),
  push: (...a: unknown[]) => push(...a),
  commitMessage: () => "test",
}));

const { store } = await import("./store");
const { syncNow, resetSyncState } = await import("./sync");

const NOTE = "data/days/2026/2026-09-19.md";

beforeEach(async () => {
  vi.clearAllMocks();
  resetSyncState();
  store.loadForTest([{ path: NOTE, content: "ghi chú cũ\n" }]);
  await store.setSettings({
    owner: "o",
    repo: "r",
    token: "t",
    branch: "main",
  });
  push.mockResolvedValue({ commit: "c2", files: [] });
});

describe("BUG 2 — typing while the pull is in flight", () => {
  it("does not throw away what was typed during the download", async () => {
    listRemote.mockResolvedValue({
      commit: "c1",
      files: [{ path: NOTE, sha: "sha-remote" }],
    });
    // The user types while the blob is on its way.
    fetchBlob.mockImplementation(async () => {
      store.setDayNote("2026-09-19", "ghi chú cũ\nDÒNG VỪA GÕ\n");
      return "ghi chú trên GitHub\n";
    });

    await syncNow();

    const file = store.allFiles().find(f => f.path === NOTE)!;
    expect(file.content).toContain("DÒNG VỪA GÕ");
    expect(store.getSnapshot().pending).toBeGreaterThan(0);
  });
});

describe("BUG 3 — a pull cut off halfway", () => {
  it("pulls again next time instead of trusting the commit it never finished", async () => {
    listRemote.mockResolvedValue({
      commit: "c1",
      files: [{ path: NOTE, sha: "sha-remote" }],
    });
    fetchBlob.mockRejectedValueOnce(new Error("mạng rớt"));

    await syncNow();
    expect(store.getSnapshot().syncState.status).toBe("error");

    fetchBlob.mockResolvedValue("ghi chú trên GitHub\n");
    await syncNow();

    // The second run must actually download, not skip on a head it only saw.
    expect(fetchBlob).toHaveBeenCalledTimes(2);
    expect(store.allFiles().find(f => f.path === NOTE)!.content).toContain(
      "GitHub"
    );
  });
});

describe("khi máy khác vừa đẩy lên trước", () => {
  it("kéo về rồi đẩy lại, thay vì báo lỗi và bỏ cuộc", async () => {
    listRemote.mockResolvedValue({ commit: "c1", files: [] });
    store.setDayNote("2026-09-19", "ghi chú mới\n");
    expect(store.getSnapshot().pending).toBeGreaterThan(0);

    // Lần đầu thua cuộc đua (GitHub: "not a fast forward"), lần sau được.
    const sent = store.allFiles().find(f => f.path === NOTE)!.content;
    push.mockResolvedValueOnce(null);
    push.mockResolvedValue({
      commit: "c2",
      files: [{ path: NOTE, sha: "sha-new", content: sent }],
    });

    await syncNow();

    expect(push).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().syncState.status).toBe("idle");
    expect(store.getSnapshot().pending).toBe(0);
  });

  it("thua mãi thì nói rõ là chưa gửi được, chứ không im lặng", async () => {
    listRemote.mockResolvedValue({ commit: "c1", files: [] });
    store.setDayNote("2026-09-19", "ghi chú mới\n");
    push.mockResolvedValue(null);

    await syncNow();

    const state = store.getSnapshot().syncState;
    expect(state.status).toBe("error");
    expect(state.status === "error" && state.message).toContain("Máy khác");
    // Quan trọng: thay đổi vẫn còn nguyên, không bị coi là đã gửi.
    expect(store.getSnapshot().pending).toBeGreaterThan(0);
  });
});
