import { describe, expect, it } from "vitest";
import { Store } from "./store";
import { paths, serializeProjectsFile, serializeProjectFile } from "./markdown";

/** A fresh Store on the same IndexedDB — i.e. closing and reopening the app. */
async function boot(): Promise<Store> {
  const store = new Store();
  await store.init();
  return store;
}

const PROJECT = {
  code: "ETC",
  name: "Chưa phân loại",
  category: "WRK" as const,
  next: 1,
  archived: false,
};

describe("xoá một việc rồi mở lại app", () => {
  it("việc đã xoá không được quay lại", async () => {
    const first = await boot();
    first.seed([
      { path: paths.projects, content: serializeProjectsFile([PROJECT]) },
      {
        path: paths.project("ETC"),
        content: serializeProjectFile({ project: PROJECT, tasks: [], extra: [] }),
      },
    ]);

    const task = first.addTask({ title: "Giặt ghế", project: "ETC" })!;
    expect(first.getSnapshot().tasks).toHaveLength(1);

    first.deleteTask(task.id);
    expect(first.getSnapshot().tasks).toHaveLength(0);

    // Đóng app, mở lại.
    const second = await boot();
    expect(second.getSnapshot().tasks.map(t => t.title)).toEqual([]);
  });

  it("việc đã xoá không quay lại kể cả khi đóng app ngay lập tức", async () => {
    const store = await boot();
    const task = store.addTask({ title: "Giặt ghế 2", project: "ETC" })!;
    store.deleteTask(task.id);

    // Không chờ một nhịp nào — đúng kiểu xoá xong bấm tắt luôn.
    const again = await boot();
    expect(again.getSnapshot().tasks.some(t => t.title === "Giặt ghế 2")).toBe(
      false
    );
  });
});
