import { describe, expect, it } from "vitest";
import { mergeFile } from "./merge";
import { parseContactsFile, parseProjectFile, serializeProjectFile } from "./markdown";
import type { Project, Task } from "./model";

const PROJECT: Project = {
  code: "ALP",
  name: "Alpha",
  category: "WRK",
  next: 3,
  archived: false,
};

function file(tasks: Task[], next = 3): string {
  return serializeProjectFile({ project: { ...PROJECT, next }, tasks, extra: [] });
}

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    project: "ALP",
    category: "WRK",
    title,
    done: false,
    created: "2026.08.10_09.12",
    ...extra,
  };
}

const PATH = "data/tasks/ALP.md";
const tasksIn = (content: string) => parseProjectFile(content, "ALP").tasks;
const titles = (content: string) =>
  tasksIn(content)
    .map((t) => t.title)
    .sort();

describe("no real conflict", () => {
  it("takes the remote when only the remote moved", () => {
    const base = file([task("ALP-0001", "A")]);
    const remote = file([task("ALP-0001", "A sửa")]);
    expect(mergeFile({ path: PATH, base, local: base, remote })).toEqual({
      content: remote,
      merged: false,
    });
  });

  it("keeps the local when only the local moved", () => {
    const base = file([task("ALP-0001", "A")]);
    const local = file([task("ALP-0001", "A sửa")]);
    expect(mergeFile({ path: PATH, base, local, remote: base }).content).toBe(local);
  });
});

describe("project file merge", () => {
  it("keeps tasks added on both devices while offline", () => {
    const base = file([task("ALP-0001", "Chung")], 2);
    const local = file([task("ALP-0001", "Chung"), task("ALP-0002", "Thêm trên máy tính")], 3);
    const remote = file([task("ALP-0001", "Chung"), task("ALP-0003", "Thêm trên iPhone")], 4);

    const merged = mergeFile({ path: PATH, base, local, remote });

    expect(titles(merged.content)).toEqual([
      "Chung",
      "Thêm trên iPhone",
      "Thêm trên máy tính",
    ]);
  });

  it("advances the counter past every id either side issued", () => {
    // Otherwise the next task on this device would reuse an id the other
    // device already handed out.
    const base = file([], 1);
    const local = file([task("ALP-0001", "Máy tính")], 2);
    const remote = file([task("ALP-0002", "iPhone")], 3);

    const merged = mergeFile({ path: PATH, base, local, remote });
    expect(parseProjectFile(merged.content, "ALP").project.next).toBe(3);
  });

  it("keeps a task done on one device and edited on the other", () => {
    const base = file([task("ALP-0001", "Nộp báo cáo ngày")]);
    const local = file([
      task("ALP-0001", "Nộp báo cáo ngày", { done: true, completed: "2026.08.17_17.30" }),
    ]);
    const remote = file([task("ALP-0001", "Nộp báo cáo ngày tháng 8")]);

    const merged = mergeFile({ path: PATH, base, local, remote });
    const result = tasksIn(merged.content)[0];

    // Finishing is the change that cannot be recovered by redoing a tap.
    expect(result.done).toBe(true);
    expect(result.completed).toBe("2026.08.17_17.30");
  });

  it("honours a delete made on one side only", () => {
    const base = file([task("ALP-0001", "A"), task("ALP-0002", "B")]);
    const local = file([task("ALP-0001", "A")]);
    const remote = base;

    expect(titles(mergeFile({ path: PATH, base, local, remote }).content)).toEqual(["A"]);
  });

  it("keeps a task deleted on one side but edited on the other", () => {
    // An edit means the task still mattered to someone; resurrect rather than
    // silently drop it.
    const base = file([task("ALP-0001", "A"), task("ALP-0002", "B")]);
    const local = file([task("ALP-0001", "A")]);
    const remote = file([task("ALP-0001", "A"), task("ALP-0002", "B đã sửa")]);

    expect(titles(mergeFile({ path: PATH, base, local, remote }).content)).toEqual([
      "A",
      "B đã sửa",
    ]);
  });

  it("loses nothing when this device has never seen the file", () => {
    const local = file([task("ALP-0001", "Máy tính")]);
    const remote = file([task("ALP-0002", "iPhone")]);

    expect(titles(mergeFile({ path: PATH, base: null, local, remote }).content)).toEqual([
      "Máy tính",
      "iPhone",
    ]);
  });
});

describe("day note merge", () => {
  it("keeps both versions rather than picking a winner", () => {
    const merged = mergeFile({
      path: "data/days/2026/2026-08-17.md",
      base: "---\ndate: 2026-08-17\n---\n\nHọp lúc 14:00\n",
      local: "---\ndate: 2026-08-17\n---\n\nHọp lúc 14:00\nChốt khối lượng tầng 3\n",
      remote: "---\ndate: 2026-08-17\n---\n\nHọp lúc 14:00\nBên kia gửi bản vẽ thứ Tư\n",
    });

    expect(merged.content).toContain("Chốt khối lượng tầng 3");
    expect(merged.content).toContain("Bên kia gửi bản vẽ thứ Tư");
    expect(merged.content).toContain("bản trên máy này");
  });
});

describe("contacts merge", () => {
  it("keeps a number added on each device", () => {
    const base = "# Danh bạ\n\n## Alpha\n- VP · `03-1111-1111`\n";
    const local = "# Danh bạ\n\n## Alpha\n- VP · `03-1111-1111`\n- Kho · `03-2222-2222`\n";
    const remote = "# Danh bạ\n\n## Alpha\n- VP · `03-1111-1111`\n- Xưởng · `03-3333-3333`\n";

    const merged = mergeFile({ path: "data/contacts.md", base, local, remote });
    const phones = parseContactsFile(merged.content).map((c) => c.phone).sort();

    expect(phones).toEqual(["03-1111-1111", "03-2222-2222", "03-3333-3333"]);
  });
});
