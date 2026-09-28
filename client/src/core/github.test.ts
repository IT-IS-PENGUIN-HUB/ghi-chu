import { afterEach, describe, expect, it, vi } from "vitest";
import { listRemote, push } from "./github";

const REPO = { owner: "o", repo: "r", branch: "main", token: "t" };

function reply(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

/**
 * GitHub answers with "Cache-Control: max-age=60". If the browser is allowed
 * to reuse that, "where is main?" is answered from a minute ago, every push in
 * that minute is built on the wrong parent, and GitHub refuses them all as
 * "not a fast forward" — which is the exact error the app kept showing.
 */
describe("mọi câu hỏi gửi GitHub đều phải hỏi thật, không dùng đáp án cũ", () => {
  it("đọc cây thư mục không qua bộ nhớ đệm", async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes("/git/ref/")) return reply({ object: { sha: "c1" } });
      if (url.includes("/git/commits/"))
        return reply({ sha: "c1", tree: { sha: "t1" } });
      return reply({ tree: [], truncated: false });
    });
    vi.stubGlobal("fetch", fetchMock);

    await listRemote(REPO);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of fetchMock.mock.calls as Array<
      [string, RequestInit]
    >) {
      expect(init.cache).toBe("no-store");
    }
  });

  it("đẩy lên cũng không qua bộ nhớ đệm, kể cả bước đọc head", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/git/ref/")) return reply({ object: { sha: "c1" } });
      if (url.includes("/git/commits/") && !init?.method)
        return reply({ sha: "c1", tree: { sha: "t1" } });
      if (url.endsWith("/git/blobs")) return reply({ sha: "b1" });
      if (url.endsWith("/git/trees")) return reply({ sha: "t2" });
      if (url.endsWith("/git/commits")) return reply({ sha: "c2" });
      return reply({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await push(
      REPO,
      [
        {
          path: "data/x.md",
          content: "x",
          sha: null,
          base: null,
          dirty: true,
          deleted: false,
        },
      ],
      "c1",
      "test"
    );

    for (const [, init] of fetchMock.mock.calls as Array<
      [string, RequestInit]
    >) {
      expect(init.cache).toBe("no-store");
    }
  });

  it("GitHub từ chối vì nhánh đã nhích thì coi là thua cuộc đua, không phải lỗi", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/git/ref/")) return reply({ object: { sha: "c1" } });
      if (url.includes("/git/commits/") && !init?.method)
        return reply({ sha: "c1", tree: { sha: "t1" } });
      if (url.endsWith("/git/blobs")) return reply({ sha: "b1" });
      if (url.endsWith("/git/trees")) return reply({ sha: "t2" });
      if (url.endsWith("/git/commits")) return reply({ sha: "c2" });
      if (init?.method === "PATCH")
        return reply({ message: "Update is not a fast forward" }, 422);
      return reply({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await push(
      REPO,
      [
        {
          path: "data/x.md",
          content: "x",
          sha: null,
          base: null,
          dirty: true,
          deleted: false,
        },
      ],
      "c1",
      "test"
    );
    expect(result).toBeNull();
  });
});
