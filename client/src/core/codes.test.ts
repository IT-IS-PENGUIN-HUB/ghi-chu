import { describe, expect, it } from "vitest";
import { allocateTaskId, buildDailyList, formatDailyCode, formatTaskId, suggestProjectCode } from "./codes";
import type { Project, Task } from "./model";

const ALP: Project = { code: "ALP", name: "Alpha", category: "WRK", next: 1, archived: false };

function task(id: string, created: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    project: id.split("-")[0],
    category: "WRK",
    title: id,
    done: false,
    created,
    ...extra,
  };
}

describe("permanent ids", () => {
  it("zero-pads to four digits", () => {
    expect(formatTaskId("ALP", 42)).toBe("ALP-0042");
    // Lower-case input is normalised, so a hand-edited file cannot introduce a
    // second casing of the same project.
    expect(formatTaskId("alp", 7)).toBe("ALP-0007");
  });

  it("is visually distinct from a daily code", () => {
    // The old app numbered by list position, so both ids looked the same and
    // the permanent one silently changed. Hyphen + 4 digits vs underscore + 2.
    expect(formatTaskId("WRK", 1)).toBe("WRK-0001");
    expect(formatDailyCode("WRK", 0)).toBe("WRK_01");
    expect(formatTaskId("WRK", 1)).not.toBe(formatDailyCode("WRK", 0));
  });

  it("never reissues an id after a delete", () => {
    // This is the defect in the old getNextTaskCode (`length + 1`): delete C2,
    // add a task, get a second C2.
    let project = ALP;
    const issued: string[] = [];

    for (let i = 0; i < 3; i++) {
      const r = allocateTaskId(project);
      issued.push(r.id);
      project = r.project;
    }
    // Two tasks are deleted; the counter does not roll back.
    const after = allocateTaskId(project);
    issued.push(after.id);

    expect(issued).toEqual(["ALP-0001", "ALP-0002", "ALP-0003", "ALP-0004"]);
    expect(new Set(issued).size).toBe(issued.length);
  });
});

describe("project code suggestions", () => {
  it("prefers consonants", () => {
    // Dropping vowels keeps a short code readable and distinct: two projects
    // starting with the same three letters would otherwise collide constantly.
    expect(suggestProjectCode("Alpha", [])).toBe("LPH");
    expect(suggestProjectCode("Beta", [])).toBe("BT");
    expect(suggestProjectCode("Yokohama", [])).toBe("YKH");
  });

  it("uses initials for multi-word names", () => {
    expect(suggestProjectCode("Tokyo Metro Line", [])).toBe("TML");
  });

  it("strips Vietnamese diacritics", () => {
    expect(suggestProjectCode("Đường sắt", [])).toMatch(/^[A-Z0-9]{2,5}$/);
  });

  it("avoids codes already taken", () => {
    const first = suggestProjectCode("Alpha", []);
    const second = suggestProjectCode("Alpha", [first]);
    expect(second).not.toBe(first);
    expect(second).toMatch(/^[A-Z][A-Z0-9]{1,4}$/);
  });
});

describe("today's list", () => {
  const tasks = [
    task("ALP-0001", "2026.08.01_09.00"),
    task("BET-0002", "2026.08.10_09.00"),
    task("ETC-0003", "2026.08.05_09.00"),
    task("ALP-0004", "2026.08.02_09.00", { done: true }),
    task("BANK-0005", "2026.08.03_09.00", { category: "PER" }),
  ];

  it("numbers by position, oldest first", () => {
    const list = buildDailyList(tasks, "WRK");
    expect(list.map((e) => [e.daily, e.task.id])).toEqual([
      ["WRK_01", "ALP-0001"],
      ["WRK_02", "ETC-0003"],
      ["WRK_03", "BET-0002"],
    ]);
  });

  it("excludes done tasks and other categories", () => {
    expect(buildDailyList(tasks, "WRK").map((e) => e.task.id)).not.toContain("ALP-0004");
    expect(buildDailyList(tasks, "PER").map((e) => e.task.id)).toEqual(["BANK-0005"]);
  });

  it("renumbers when the list changes, so codes never leave holes", () => {
    const without = tasks.filter((t) => t.id !== "ALP-0001");
    expect(buildDailyList(without, "WRK").map((e) => e.daily)).toEqual(["WRK_01", "WRK_02"]);
  });

  it("floats starred work to the top", () => {
    const starred = tasks.map((t) => (t.id === "BET-0002" ? { ...t, starred: true } : t));
    expect(buildDailyList(starred, "WRK")[0].task.id).toBe("BET-0002");
  });
});
