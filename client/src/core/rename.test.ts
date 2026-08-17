import { beforeEach, describe, expect, it } from "vitest";
import { parseTaskLine, paths } from "./markdown";
import { CODE_RE, normaliseCode } from "./model";
import { buildFixtureFiles } from "./__tests__/fixtures";
import { Store } from "./store";

describe("code rules", () => {
  it("accepts letters, digits and underscores", () => {
    for (const code of ["AB", "SNK", "ALP1", "DU_AN", "A_1", "ABCDEFGH"]) {
      expect(CODE_RE.test(code)).toBe(true);
    }
  });

  it("rejects codes that would break a filename or a task id", () => {
    for (const code of [
      "A", // too short to be distinctive
      "ABCDEFGHI", // over 8
      "1AB", // must start with a letter
      "A-B", // the hyphen separates the id: ALP-0042
      "A.B", // collides with the .md extension when reading a path
      ".AB", // hidden file
      "A/B", // path separator
      "snk", // lower case: same file as SNK on Windows
      "Ạ", // non-ASCII
    ]) {
      expect(CODE_RE.test(code)).toBe(false);
    }
  });

  it("normalises free typing into a usable code", () => {
    expect(normaliseCode("dự án")).toBe("DUAN");
    expect(normaliseCode("du_an 01")).toBe("DU_AN01");
    expect(normaliseCode("a-b.c")).toBe("ABC");
    expect(normaliseCode("abcdefghijk")).toHaveLength(8);
  });

  it("still parses a task line whose project code has an underscore", () => {
    const task = parseTaskLine(
      "- [ ] `DU_AN-0042` Việc gì đó `2026.08.10_09.12`",
      "DU_AN",
      "WRK"
    );
    expect(task).toMatchObject({ id: "DU_AN-0042", title: "Việc gì đó" });
  });
});

describe("renaming a project code", () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
    store.loadForTest(buildFixtureFiles(new Date("2026-08-17T10:00:00")));
  });

  it("rewrites every task id and keeps the numbers", () => {
    const before = store.getSnapshot().tasks.filter((t) => t.project === "ALP");
    expect(before.length).toBeGreaterThan(0);

    expect(store.renameProjectCode("ALP", "ALPHA")).toEqual({ ok: true });

    const after = store.getSnapshot().tasks.filter((t) => t.project === "ALPHA");
    expect(after).toHaveLength(before.length);
    expect(after.map((t) => t.id).sort()).toEqual(
      before.map((t) => t.id.replace("ALP-", "ALPHA-")).sort()
    );
    // Nothing is left behind under the old code.
    expect(store.getSnapshot().tasks.some((t) => t.project === "ALP")).toBe(false);
  });

  it("loses no task at all", () => {
    const total = store.getSnapshot().tasks.length;
    store.renameProjectCode("ALP", "NEWCODE");
    expect(store.getSnapshot().tasks).toHaveLength(total);
  });

  it("keeps titles, status and timestamps untouched", () => {
    const before = store
      .getSnapshot()
      .tasks.filter((t) => t.project === "ALP")
      .map(({ title, done, created }) => ({ title, done, created }));

    store.renameProjectCode("ALP", "ZZ");

    expect(
      store
        .getSnapshot()
        .tasks.filter((t) => t.project === "ZZ")
        .map(({ title, done, created }) => ({ title, done, created }))
    ).toEqual(before);
  });

  it("renames the file on disk and removes the old one", () => {
    store.renameProjectCode("ALP", "ZZ");
    const live = store.allFiles().filter((f) => !f.deleted).map((f) => f.path);

    expect(live).toContain(paths.project("ZZ"));
    expect(live).not.toContain(paths.project("ALP"));
  });

  it("carries the counter over so ids never collide", () => {
    const before = store.getSnapshot().projects.find((p) => p.code === "ALP")!.next;
    store.renameProjectCode("ALP", "ZZ");

    const after = store.getSnapshot().projects.find((p) => p.code === "ZZ")!;
    expect(after.next).toBe(before);

    const added = store.addTask({ title: "Sau khi đổi mã", project: "ZZ" })!;
    expect(added.id).toBe(`ZZ-${String(before).padStart(4, "0")}`);
    expect(store.getSnapshot().tasks.filter((t) => t.id === added.id)).toHaveLength(1);
  });

  it("repoints recurring rules at the new code", () => {
    store.setRecurring([
      { id: "R1", title: "Nộp báo cáo", project: "ALP", category: "WRK", kind: "daily", days: [] },
    ]);
    store.renameProjectCode("ALP", "ZZ");

    expect(store.getSnapshot().recurring[0].project).toBe("ZZ");
  });

  it("refuses a code already in use", () => {
    const result = store.renameProjectCode("ALP", "BET");
    expect(result.ok).toBe(false);
    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")).toBeDefined();
    expect(store.getSnapshot().projects.find((p) => p.code === "BET")).toBeDefined();
  });

  it("is a no-op when the code does not change", () => {
    const before = store.getSnapshot().tasks.length;
    expect(store.renameProjectCode("ALP", "ALP")).toEqual({ ok: true });
    expect(store.getSnapshot().tasks).toHaveLength(before);
  });
});

describe("renaming a field code", () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
    store.loadForTest(buildFixtureFiles(new Date("2026-08-17T10:00:00")));
  });

  it("repoints its projects at the new code", () => {
    store.updateProject("ALP", { field: "SEK" });
    expect(store.renameFieldCode("SEK", "SEKISAN")).toEqual({ ok: true });

    expect(store.getSnapshot().fields.find((f) => f.code === "SEKISAN")).toBeDefined();
    expect(store.getSnapshot().fields.find((f) => f.code === "SEK")).toBeUndefined();
    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")?.field).toBe("SEKISAN");
  });

  it("does not touch task ids", () => {
    store.updateProject("ALP", { field: "SEK" });
    const before = store.getSnapshot().tasks.map((t) => t.id).sort();

    store.renameFieldCode("SEK", "XYZ");

    expect(store.getSnapshot().tasks.map((t) => t.id).sort()).toEqual(before);
  });

  it("refuses a code already in use", () => {
    expect(store.renameFieldCode("SEK", "SKS").ok).toBe(false);
  });
});
