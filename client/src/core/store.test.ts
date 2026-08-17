import { beforeEach, describe, expect, it } from "vitest";
import { parseProjectFile, paths } from "./markdown";
import { buildFixtureFiles } from "./__tests__/fixtures";
import { Store } from "./store";

function seeded(): Store {
  const store = new Store();
  store.loadForTest(buildFixtureFiles(new Date("2026-08-17T10:00:00")));
  return store;
}

describe("loading a populated repo", () => {
  let store: Store;
  beforeEach(() => {
    store = seeded();
  });

  it("loads every task", () => {
    expect(store.getSnapshot().tasks).toHaveLength(11);
  });

  it("splits tasks across both groups", () => {
    const { tasks } = store.getSnapshot();
    expect(tasks.filter((t) => t.category === "WRK")).toHaveLength(7);
    expect(tasks.filter((t) => t.category === "PER")).toHaveLength(4);
  });

  it("gives every task an id prefixed with its project", () => {
    const { tasks } = store.getSnapshot();
    for (const task of tasks) {
      expect(task.id.startsWith(`${task.project}-`)).toBe(true);
    }
  });

  it("keeps already-completed tasks completed", () => {
    expect(store.getSnapshot().tasks.filter((t) => t.done)).toHaveLength(2);
  });
});

describe("task mutations", () => {
  let store: Store;
  beforeEach(() => {
    store = seeded();
  });

  it("adds a task and advances only that project's counter", () => {
    const before = store.getSnapshot().projects.find((p) => p.code === "ALP")!;
    const etcBefore = store.getSnapshot().projects.find((p) => p.code === "ETC")!.next;

    const task = store.addTask({ title: "Việc mới", project: "ALP", category: "WRK" });

    expect(task?.id).toBe(`ALP-${String(before.next).padStart(4, "0")}`);
    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")!.next).toBe(before.next + 1);
    // Counters are per project — adding to ALP must not move ETC's.
    expect(store.getSnapshot().projects.find((p) => p.code === "ETC")!.next).toBe(etcBefore);
  });

  it("does not reissue an id after a delete", () => {
    const first = store.addTask({ title: "A", project: "ALP" })!;
    store.deleteTask(first.id);
    const second = store.addTask({ title: "B", project: "ALP" })!;

    expect(second.id).not.toBe(first.id);
    expect(store.getSnapshot().tasks.find((t) => t.id === first.id)).toBeUndefined();
  });

  it("lifts inline #tags out of the quick-add box", () => {
    const task = store.addTask({ title: "Gọi khách #dukan #gấp", project: "ALP" })!;
    expect(task.title).toBe("Gọi khách");
    expect(task.tags).toEqual(["dukan", "gấp"]);
  });

  it("does not duplicate a tag across repeated saves", () => {
    const task = store.addTask({ title: "Việc #gấp", project: "ALP" })!;
    store.updateTask(task.id, { title: "Việc sửa #gấp" });
    store.updateTask(task.id, { title: "Việc sửa lần hai #gấp" });

    expect(store.getSnapshot().tasks.find((t) => t.id === task.id)!.tags).toEqual(["gấp"]);
  });

  it("creates a project on the fly for an unknown code", () => {
    store.addTask({ title: "Việc dự án mới", project: "NEW", category: "PER" });
    const project = store.getSnapshot().projects.find((p) => p.code === "NEW");
    expect(project).toMatchObject({ code: "NEW", category: "PER" });
  });

  it("stamps and clears the completion time on toggle", () => {
    const task = store.addTask({ title: "Toggle", project: "ETC" })!;

    store.toggleTask(task.id);
    const done = store.getSnapshot().tasks.find((t) => t.id === task.id)!;
    expect(done.done).toBe(true);
    expect(done.completed).toMatch(/^\d{4}\.\d{2}\.\d{2}_\d{2}\.\d{2}$/);

    store.toggleTask(task.id);
    const reopened = store.getSnapshot().tasks.find((t) => t.id === task.id)!;
    expect(reopened.done).toBe(false);
    expect(reopened.completed).toBeUndefined();
  });

  it("keeps the permanent id when a task moves project", () => {
    const task = store.addTask({ title: "Chuyển dự án", project: "ALP" })!;
    store.moveTask(task.id, "BET");

    const moved = store.getSnapshot().tasks.find((t) => t.id === task.id)!;
    expect(moved.id).toBe(task.id); // still ALP-xxxx, like a ticket key
    expect(moved.project).toBe("BET");
    expect(store.getSnapshot().tasks.filter((t) => t.id === task.id)).toHaveLength(1);
  });

  it("writes changes straight into the project's markdown file", () => {
    store.addTask({ title: "Xuất hiện trong file", project: "ALP" });
    const file = store.allFiles().find((f) => f.path === paths.project("ALP"))!;
    expect(file.content).toContain("Xuất hiện trong file");
    expect(file.dirty).toBe(true);
  });
});

describe("day notes", () => {
  let store: Store;
  beforeEach(() => {
    store = seeded();
  });

  it("creates no file for a day with no note", () => {
    expect(store.allFiles().some((f) => f.path.startsWith("data/days/"))).toBe(false);
  });

  it("creates the file only once something is written", () => {
    store.setDayNote("2026-08-17", "Họp lúc 14:00");
    expect(store.allFiles().some((f) => f.path === "data/days/2026/2026-08-17.md")).toBe(true);
    expect(store.getSnapshot().days).toEqual([
      { date: "2026-08-17", body: "Họp lúc 14:00" },
    ]);
  });

  it("removes a never-synced file when the note is cleared", () => {
    store.setDayNote("2026-08-17", "tạm");
    store.setDayNote("2026-08-17", "   ");
    expect(store.allFiles().some((f) => f.path === "data/days/2026/2026-08-17.md")).toBe(false);
  });
});

describe("sync bookkeeping", () => {
  it("counts unpushed files and clears them on push", () => {
    const store = seeded();
    store.addTask({ title: "A", project: "ALP" });

    expect(store.getSnapshot().pending).toBeGreaterThan(0);
    const dirty = store.dirtyFiles();

    store.markPushed(dirty.map((f) => ({ path: f.path, sha: "new-sha" })));
    expect(store.getSnapshot().pending).toBe(0);
  });

  it("rebuilds the model from files pulled off the remote", () => {
    const store = new Store();
    store.loadForTest([]);
    expect(store.getSnapshot().tasks).toHaveLength(0);

    for (const file of buildFixtureFiles(new Date("2026-08-17T10:00:00"))) {
      store.applyRemote([{ ...file, sha: "remote" }]);
    }
    expect(store.getSnapshot().tasks).toHaveLength(11);
    expect(store.getSnapshot().pending).toBe(0);
  });
});

describe("file format survives a full mutation cycle", () => {
  it("stays parseable after add, toggle, edit and delete", () => {
    const store = seeded();
    const a = store.addTask({ title: "Một", project: "ALP" })!;
    const b = store.addTask({ title: "Hai #gấp", project: "ALP" })!;
    store.toggleTask(a.id);
    store.updateTask(b.id, { title: "Hai đã sửa", starred: true });
    store.deleteTask(a.id);

    const content = store.allFiles().find((f) => f.path === paths.project("ALP"))!.content;
    const reparsed = parseProjectFile(content, "ALP");

    expect(reparsed.tasks.find((t) => t.id === b.id)).toMatchObject({
      title: "Hai đã sửa",
      starred: true,
      tags: ["gấp"],
    });
    expect(reparsed.tasks.find((t) => t.id === a.id)).toBeUndefined();
  });
});
