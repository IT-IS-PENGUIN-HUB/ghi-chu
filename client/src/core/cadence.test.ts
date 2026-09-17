import { describe, expect, it } from "vitest";
import { pacesByProject } from "./cadence";
import { parseFieldsFile, serializeFieldsFile } from "./markdown";
import {
  cadenceOf,
  DEFAULT_CADENCE,
  toStamp,
  type Field,
  type Project,
  type Task,
} from "./model";

const NOW = new Date("2026-09-17T10:00:00");

function daysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return toStamp(d);
}

function field(code: string, cadence?: number): Field {
  return {
    code,
    name: code,
    category: "WRK",
    order: 1,
    ...(cadence === undefined ? {} : { cadence }),
  };
}

function project(code: string, fieldCode?: string, archived = false): Project {
  return {
    code,
    name: code,
    category: "WRK",
    ...(fieldCode ? { field: fieldCode } : {}),
    next: 2,
    archived,
  };
}

function task(code: string, age: number, done = false): Task {
  return {
    id: `${code}-0001`,
    project: code,
    category: "WRK",
    title: "Việc",
    done,
    created: daysAgo(age),
    ...(done ? { completed: daysAgo(age) } : {}),
  };
}

describe("nhịp per dự án", () => {
  it("flags a phân nhánh left alone longer than its dự án allows", () => {
    const paces = pacesByProject(
      [project("ALP", "SEK")],
      [field("SEK", 7)],
      [task("ALP", 40)],
      NOW
    );
    expect(paces.get("ALP")).toMatchObject({ stale: true, idleDays: 40 });
  });

  it("leaves the same phân nhánh alone under a long nhịp", () => {
    const paces = pacesByProject(
      [project("ALP", "SEK")],
      [field("SEK", 90)],
      [task("ALP", 40)],
      NOW
    );
    expect(paces.get("ALP")?.stale).toBe(false);
  });

  it("never flags a dự án set to không nhắc", () => {
    const paces = pacesByProject(
      [project("ALP", "SEK")],
      [field("SEK", 0)],
      [task("ALP", 400)],
      NOW
    );
    expect(paces.get("ALP")).toMatchObject({ stale: false, staleAfter: 0 });
  });

  it("does not flag a phân nhánh whose work is all finished", () => {
    const paces = pacesByProject(
      [project("ALP", "SEK")],
      [field("SEK", 7)],
      [task("ALP", 40, true)],
      NOW
    );
    expect(paces.get("ALP")?.stale).toBe(false);
  });

  it("does not flag an archived phân nhánh", () => {
    const paces = pacesByProject(
      [project("ALP", "SEK", true)],
      [field("SEK", 7)],
      [task("ALP", 40)],
      NOW
    );
    expect(paces.get("ALP")?.stale).toBe(false);
  });

  it("counts finishing something as touching it", () => {
    const stale = task("ALP", 40);
    const finished: Task = {
      ...task("ALP", 40, true),
      id: "ALP-0002",
      completed: daysAgo(2),
    };
    const paces = pacesByProject(
      [project("ALP", "SEK")],
      [field("SEK", 7)],
      [stale, finished],
      NOW
    );
    expect(paces.get("ALP")).toMatchObject({ stale: false, idleDays: 2 });
  });

  it("falls back to the default for a phân nhánh in no dự án", () => {
    const paces = pacesByProject([project("ALP")], [], [task("ALP", 40)], NOW);
    expect(paces.get("ALP")).toMatchObject({
      staleAfter: DEFAULT_CADENCE,
      stale: true,
    });
  });

  it("says nothing about a phân nhánh that never held a việc", () => {
    const paces = pacesByProject(
      [project("ALP", "SEK")],
      [field("SEK", 7)],
      [],
      NOW
    );
    expect(paces.get("ALP")).toMatchObject({ stale: false, idleDays: null });
  });
});

describe("nhịp in fields.md", () => {
  it("survives a round trip, including không nhắc", () => {
    const written = serializeFieldsFile([
      field("SEK", 30),
      field("HT", 0),
      field("ETC"),
    ]);
    const read = parseFieldsFile(written);

    expect(read.find(f => f.code === "SEK")?.cadence).toBe(30);
    expect(read.find(f => f.code === "HT")?.cadence).toBe(0);
    expect(read.find(f => f.code === "ETC")?.cadence).toBeUndefined();
  });

  it("reads a row written before the column existed as 'not set', not as 0", () => {
    const old = [
      "# Lĩnh vực",
      "",
      "| Mã | Tên | Nhóm | Thứ tự |",
      "| --- | --- | --- | --- |",
      "| SEK | 分野A | WRK | 1 |",
      "",
    ].join("\n");

    const [parsed] = parseFieldsFile(old);
    expect(parsed.cadence).toBeUndefined();
    // Which is what keeps the app behaving exactly as it did before.
    expect(cadenceOf(parsed)).toBe(DEFAULT_CADENCE);
  });
});
