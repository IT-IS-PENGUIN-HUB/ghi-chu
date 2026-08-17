import { beforeEach, describe, expect, it } from "vitest";
import { fold, highlightRanges, SearchIndex } from "./search";
import type { Contact, DayNote, Task } from "./model";

const tasks: Task[] = [
  {
    id: "BET-0001",
    project: "BET",
    category: "WRK",
    title: "Kiểm tra khối lượng hạng mục Beta",
    done: false,
    created: "2025.04.10_09.12",
  },
  {
    id: "ETC-0007",
    project: "ETC",
    category: "WRK",
    title: "Nộp báo cáo ngày ngày 14 tháng 4",
    done: true,
    created: "2025.04.14_08.00",
    completed: "2025.04.14_17.30",
  },
  {
    id: "BANK-0002",
    project: "BANK",
    category: "PER",
    title: "Đi gửi phong bì cho BANK",
    done: false,
    created: "2025.04.12_20.05",
    tags: ["giấy-tờ"],
  },
];

const notes: DayNote[] = [
  { date: "2025-04-14", body: "Họp Alpha 14:00 — chốt khối lượng tầng 3, còn thiếu bản vẽ mặt cắt." },
  { date: "2025-04-15", body: "" },
];

const contacts: Contact[] = [
  { group: "Alpha", label: "Văn phòng Tokyo", phone: "03-1234-5678", note: "Phòng kinh doanh" },
];

describe("diacritic folding", () => {
  it("strips tone marks and maps đ", () => {
    expect(fold("Kiểm tra khối lượng")).toBe("kiem tra khoi luong");
    expect(fold("Đi gửi phong bì")).toBe("di gui phong bi");
  });

  it("is length-preserving, so highlight offsets stay valid", () => {
    for (const s of ["Kiểm tra khối lượng", "Đường sắt Việt Nam", "Nộp báo cáo ngày"]) {
      expect(fold(s)).toHaveLength(s.length);
    }
  });
});

describe("search", () => {
  let index: SearchIndex;

  beforeEach(() => {
    index = new SearchIndex();
    index.rebuild({ tasks, notes, contacts });
  });

  const ids = (q: string) =>
    index.search(q).flatMap((h) => (h.kind === "task" ? [h.task.id] : []));

  it("finds Vietnamese text typed without tone marks", () => {
    // The whole point: a year later you remember the words, not the accents.
    expect(ids("khoi luong")).toContain("BET-0001");
    expect(ids("di gui phong bi")).toContain("BANK-0002");
  });

  it("still finds text typed with tone marks", () => {
    expect(ids("khối lượng")).toContain("BET-0001");
  });

  it("matches on a prefix", () => {
    expect(ids("bet")).toContain("BET-0001");
  });

  it("tolerates a typo", () => {
    expect(ids("betaa")).toContain("BET-0001");
  });

  it("finds a task by its permanent id", () => {
    expect(ids("BANK-0002")).toContain("BANK-0002");
  });

  it("searches day notes as well as tasks", () => {
    const hit = index.search("ban ve mat cat").find((h) => h.kind === "note");
    expect(hit).toBeDefined();
    expect(hit?.kind === "note" && hit.note.date).toBe("2025-04-14");
  });

  it("skips empty day notes", () => {
    expect(index.search("2025-04-15").some((h) => h.kind === "note")).toBe(false);
  });

  it("finds a contact by name or by digits only", () => {
    expect(index.search("van phong tokyo").some((h) => h.kind === "contact")).toBe(true);
    expect(index.search("0312345678").some((h) => h.kind === "contact")).toBe(true);
  });

  it("returns nothing for a one-character query", () => {
    expect(index.search("k")).toEqual([]);
  });
});

describe("highlighting", () => {
  it("marks the matched span while keeping the original tone marks", () => {
    const parts = highlightRanges("Kiểm tra khối lượng", "khoi luong");
    expect(parts.map((p) => p.text).join("")).toBe("Kiểm tra khối lượng");
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["khối", "lượng"]);
  });

  it("returns the whole string when nothing matches", () => {
    expect(highlightRanges("Nộp báo cáo ngày", "khong-khop")).toEqual([{ text: "Nộp báo cáo ngày", hit: false }]);
  });
});
