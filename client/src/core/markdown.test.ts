import { describe, expect, it } from "vitest";
import {
  codeFromProjectPath,
  dateFromDayPath,
  extractTags,
  parseContactsFile,
  parseDayNote,
  parseProjectFile,
  parseProjectsFile,
  parseRecurringFile,
  parseTaskLine,
  serializeContactsFile,
  serializeDayNote,
  serializeProjectFile,
  serializeProjectsFile,
  serializeRecurringFile,
} from "./markdown";
import type { Project, RecurringRule, Task } from "./model";

const PROJECT: Project = {
  code: "ALP",
  name: "Alpha",
  category: "WRK",
  next: 43,
  archived: false,
};

const TASKS: Task[] = [
  {
    id: "ALP-0042",
    project: "ALP",
    category: "WRK",
    title: "Kiểm tra khối lượng tầng 3",
    done: false,
    created: "2026.08.10_09.12",
  },
  {
    id: "ALP-0039",
    project: "ALP",
    category: "WRK",
    title: "Xem ngày đi khảo sát",
    done: false,
    created: "2026.08.05_11.20",
    starred: true,
    tags: ["gấp"],
  },
  {
    id: "ALP-0041",
    project: "ALP",
    category: "WRK",
    title: "Gửi bản vẽ revision B",
    done: true,
    created: "2026.08.09_08.30",
    completed: "2026.08.11_16.05",
  },
];

describe("project file", () => {
  it("round-trips byte for byte", () => {
    const text = serializeProjectFile({ project: PROJECT, tasks: TASKS, extra: [] });
    const parsed = parseProjectFile(text, "ALP");
    expect(serializeProjectFile(parsed)).toBe(text);
  });

  it("stays byte-stable across repeated saves of a half-empty file", () => {
    // The empty-section placeholders are generated text, not user content. If
    // the parser treated them as unrecognised lines it would preserve them and
    // then add a fresh copy, growing the file by a line on every save.
    const onlyOpen = { project: PROJECT, tasks: [TASKS[0]], extra: [] };

    let text = serializeProjectFile(onlyOpen);
    for (let i = 0; i < 3; i++) {
      text = serializeProjectFile(parseProjectFile(text, "ALP"));
    }

    expect(text).toBe(serializeProjectFile(onlyOpen));
    expect(text.match(/Chưa có việc nào/g)).toHaveLength(1);
  });

  it("stays byte-stable for a project with no tasks at all", () => {
    const empty = { project: { ...PROJECT, next: 1 }, tasks: [], extra: [] };
    let text = serializeProjectFile(empty);
    for (let i = 0; i < 3; i++) {
      text = serializeProjectFile(parseProjectFile(text, "ALP"));
    }
    expect(text).toBe(serializeProjectFile(empty));
  });

  it("keeps every field of every task", () => {
    const text = serializeProjectFile({ project: PROJECT, tasks: TASKS, extra: [] });
    const parsed = parseProjectFile(text, "ALP");

    expect(parsed.project).toEqual(PROJECT);
    expect([...parsed.tasks].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...TASKS].sort((a, b) => a.id.localeCompare(b.id))
    );
  });

  it("renders tasks as GitHub checkboxes", () => {
    const text = serializeProjectFile({ project: PROJECT, tasks: TASKS, extra: [] });
    expect(text).toContain("- [ ] `ALP-0042` Kiểm tra khối lượng tầng 3 `2026.08.10_09.12`");
    expect(text).toContain("- [x] `ALP-0041` Gửi bản vẽ revision B `2026.08.09_08.30` → `2026.08.11_16.05`");
    expect(text).toContain("- [ ] `ALP-0039` ★ Xem ngày đi khảo sát #gấp `2026.08.05_11.20`");
  });

  it("never drops lines it does not understand", () => {
    const handEdited = [
      "---",
      "project: ALP",
      "name: Alpha",
      "category: WRK",
      "next: 43",
      "---",
      "",
      "## Đang tồn",
      "",
      "- [ ] `ALP-0042` Kiểm tra khối lượng tầng 3 `2026.08.10_09.12`",
      "> ghi chú tay của tôi, đừng xoá",
      "",
      "## Đã xong",
      "",
      "- [x] `ALP-0041` Gửi bản vẽ `2026.08.09_08.30` → `2026.08.11_16.05`",
    ].join("\n");

    const parsed = parseProjectFile(handEdited, "ALP");
    expect(parsed.extra).toContain("> ghi chú tay của tôi, đừng xoá");
    expect(serializeProjectFile(parsed)).toContain("> ghi chú tay của tôi, đừng xoá");
  });

  it("self-heals a counter left behind by a hand edit", () => {
    // `next: 2` but ALP-0042 already exists — handing out ALP-0002 would be
    // fine, but ALP-0042 must never be reissued.
    const text = [
      "---",
      "project: ALP",
      "next: 2",
      "---",
      "",
      "## Đang tồn",
      "",
      "- [ ] `ALP-0042` Việc `2026.08.10_09.12`",
    ].join("\n");

    expect(parseProjectFile(text, "ALP").project.next).toBe(43);
  });

  it("accepts a checkbox ticked by hand with no completion stamp", () => {
    const task = parseTaskLine("- [x] `ALP-0042` Việc `2026.08.10_09.12`", "ALP", "WRK");
    expect(task).toMatchObject({ id: "ALP-0042", done: true });
    expect(task?.completed).toBeUndefined();
  });
});

describe("task line", () => {
  it("ignores lines that are not tasks", () => {
    for (const line of [
      "## Đang tồn",
      "- [ ] không có mã",
      "- [ ] `snk-0042` mã thường `2026.08.10_09.12`",
      "- [ ] `ALP-42` mã thiếu số `2026.08.10_09.12`",
      "chỉ là văn bản",
      "",
    ]) {
      expect(parseTaskLine(line, "ALP", "WRK")).toBeNull();
    }
  });

  it("keeps titles containing a → arrow", () => {
    const task = parseTaskLine(
      "- [ ] `ALP-0042` Chuyển A → B `2026.08.10_09.12`",
      "ALP",
      "WRK"
    );
    expect(task?.title).toBe("Chuyển A → B");
    expect(task?.completed).toBeUndefined();
  });

  it("pulls #tags out of the title", () => {
    expect(extractTags("Gọi khách #Alpha #gấp")).toEqual({
      title: "Gọi khách",
      tags: ["Alpha", "gấp"],
    });
    expect(extractTags("Việc không tag")).toEqual({ title: "Việc không tag", tags: [] });
  });

  it("handles Vietnamese and Japanese tags", () => {
    expect(extractTags("Nộp #báo-cáo và #熊谷").tags).toEqual(["báo-cáo", "熊谷"]);
  });
});

describe("projects registry", () => {
  it("round-trips", () => {
    const projects: Project[] = [
      PROJECT,
      { code: "ETC", name: "Chưa phân loại", category: "WRK", next: 12, archived: false },
      { code: "BANK", name: "BANK", category: "PER", next: 8, archived: true },
    ];
    const text = serializeProjectsFile(projects);
    expect(parseProjectsFile(text).sort((a, b) => a.code.localeCompare(b.code))).toEqual(
      [...projects].sort((a, b) => a.code.localeCompare(b.code))
    );
  });

  it("skips the header and separator rows", () => {
    expect(parseProjectsFile(serializeProjectsFile([PROJECT]))).toHaveLength(1);
  });
});

describe("day note", () => {
  it("round-trips", () => {
    const note = { date: "2026-08-17", body: "Họp Alpha 14:00 — chốt khối lượng tầng 3." };
    expect(parseDayNote(serializeDayNote(note), "2026-08-17")).toEqual(note);
  });

  it("preserves multi-line markdown", () => {
    const body = "# Họp\n\n- điểm 1\n- điểm 2\n\n**Kết luận:** xong.";
    expect(parseDayNote(serializeDayNote({ date: "2026-08-17", body }), "2026-08-17").body).toBe(body);
  });
});

describe("contacts", () => {
  it("round-trips", () => {
    const contacts = [
      { group: "Alpha", label: "Văn phòng Tokyo", phone: "03-1234-5678", note: "Phòng kinh doanh" },
      { group: "Alpha", label: "Công trường Chiba", phone: "090-1234-5678" },
      { group: "Beta", label: "VP chính", phone: "048-123-4567" },
    ];
    const parsed = parseContactsFile(serializeContactsFile(contacts));
    expect(parsed.sort((a, b) => a.phone.localeCompare(b.phone))).toEqual(
      [...contacts].sort((a, b) => a.phone.localeCompare(b.phone))
    );
  });

  it("reads a hand-written file", () => {
    const text = "## Alpha\n- Văn phòng · `03-1234-5678` · Phòng kinh doanh\n- Không có số\n";
    expect(parseContactsFile(text)).toEqual([
      { group: "Alpha", label: "Văn phòng", phone: "03-1234-5678", note: "Phòng kinh doanh" },
    ]);
  });
});

describe("recurring rules", () => {
  it("round-trips", () => {
    const rules: RecurringRule[] = [
      { id: "R1", title: "Nộp báo cáo ngày", project: "ETC", category: "WRK", kind: "weekdays", days: [5], lastRun: "2026-08-14" },
      { id: "R2", title: "Kiểm tra mail", project: "ETC", category: "WRK", kind: "daily", days: [] },
    ];
    expect(parseRecurringFile(serializeRecurringFile(rules))).toEqual(rules);
  });
});

describe("paths", () => {
  it("extracts identifiers back out", () => {
    expect(dateFromDayPath("data/days/2026/2026-08-17.md")).toBe("2026-08-17");
    expect(codeFromProjectPath("data/tasks/ALP.md")).toBe("ALP");
    expect(codeFromProjectPath("data/tasks/lowercase.md")).toBeNull();
  });
});
