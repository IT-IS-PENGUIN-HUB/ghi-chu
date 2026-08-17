import { beforeEach, describe, expect, it } from "vitest";
import { parseFieldsFile, parseProjectsFile, serializeFieldsFile, serializeProjectsFile } from "./markdown";
import { buildFixtureFiles } from "./__tests__/fixtures";
import { Store } from "./store";
import type { Field, Project } from "./model";

const FIELDS: Field[] = [
  { code: "SEK", name: "分野A", category: "WRK", order: 1 },
  { code: "SKS", name: "分野B", category: "WRK", order: 2 },
  { code: "CS", name: "Cuộc sống", category: "PER", order: 1 },
  { code: "HT", name: "Học tập", category: "PER", order: 2 },
];

/** Both registries are written in a sorted order to keep git diffs stable, so
 *  a round trip preserves the set rather than the input order. */
const byCode = <T extends { code: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.code.localeCompare(b.code));

describe("fields file", () => {
  it("round-trips, keeping Japanese names intact", () => {
    const text = serializeFieldsFile(FIELDS);
    expect(byCode(parseFieldsFile(text))).toEqual(byCode(FIELDS));
    expect(text).toContain("分野B");
  });

  it("re-serialises to exactly the same bytes", () => {
    const text = serializeFieldsFile(FIELDS);
    expect(serializeFieldsFile(parseFieldsFile(text))).toBe(text);
  });
});

describe("projects file", () => {
  it("round-trips the field column, including an unassigned project", () => {
    const projects: Project[] = [
      { code: "ALP", name: "Alpha", category: "WRK", field: "SEK", next: 3, archived: false },
      { code: "ETC", name: "Chưa phân loại", category: "WRK", next: 1, archived: false },
    ];
    expect(byCode(parseProjectsFile(serializeProjectsFile(projects)))).toEqual(byCode(projects));
  });
});

describe("field level in the store", () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
    store.loadForTest(buildFixtureFiles(new Date("2026-08-17T10:00:00")));
  });

  it("seeds the four starting fields", () => {
    expect(store.getSnapshot().fields.map((f) => f.name)).toEqual([
      "Cuộc sống",
      "Học tập",
      "分野A",
      "分野B",
    ]);
  });

  it("leaves existing work projects unassigned rather than guessing", () => {
    const unassigned = store.getSnapshot().projects.filter((p) => p.category === "WRK" && !p.field);
    expect(unassigned.map((p) => p.code).sort()).toEqual(["ALP", "BET", "DEL", "EPS", "ETC", "GAM"]);
  });

  it("files a project into a field", () => {
    store.updateProject("ALP", { field: "SEK" });
    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")?.field).toBe("SEK");
  });

  it("lets the field decide the group", () => {
    store.updateProject("ALP", { field: "HT" }); // Học tập is a PER field
    const snk = store.getSnapshot().projects.find((p) => p.code === "ALP")!;
    expect(snk.category).toBe("PER");
    // Tasks follow their project's group.
    expect(store.getSnapshot().tasks.filter((t) => t.project === "ALP").every((t) => t.category === "PER")).toBe(true);
  });

  it("adds a new field for a future line of work", () => {
    store.createField("設計", "SKE", "WRK");
    expect(store.getSnapshot().fields.find((f) => f.code === "SKE")).toMatchObject({
      name: "設計",
      category: "WRK",
    });
  });

  it("renames a field without touching its projects", () => {
    store.updateProject("ALP", { field: "SEK" });
    store.updateField("SEK", { name: "分野A (mới)" });

    expect(store.getSnapshot().fields.find((f) => f.code === "SEK")?.name).toBe("分野A (mới)");
    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")?.field).toBe("SEK");
  });

  it("carries projects along when a field moves group", () => {
    store.updateProject("ALP", { field: "SEK" });
    store.updateField("SEK", { category: "PER" });

    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")?.category).toBe("PER");
  });

  it("keeps every task when a field is deleted", () => {
    store.updateProject("ALP", { field: "SEK" });
    const before = store.getSnapshot().tasks.length;

    store.deleteField("SEK");

    expect(store.getSnapshot().fields.find((f) => f.code === "SEK")).toBeUndefined();
    expect(store.getSnapshot().projects.find((p) => p.code === "ALP")?.field).toBeUndefined();
    expect(store.getSnapshot().tasks).toHaveLength(before);
  });

  it("reorders fields within a group", () => {
    store.reorderFields("WRK", ["SKS", "SEK"]);
    const work = store.getSnapshot().fields.filter((f) => f.category === "WRK");
    expect(work.map((f) => f.code)).toEqual(["SKS", "SEK"]);
  });
});
