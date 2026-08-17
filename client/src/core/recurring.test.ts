import { describe, expect, it } from "vitest";
import { describeRule, isDue, isoWeekday, materialise, nextRuleId } from "./recurring";
import type { RecurringRule, Task } from "./model";

const baocao: RecurringRule = {
  id: "R1",
  title: "Nộp báo cáo ngày",
  project: "ETC",
  category: "WRK",
  kind: "weekdays",
  days: [5], // Friday
};

const mail: RecurringRule = {
  id: "R2",
  title: "Kiểm tra mail",
  project: "ETC",
  category: "WRK",
  kind: "daily",
  days: [],
};

const FRIDAY = new Date(2026, 7, 21); // 2026-08-21
const SATURDAY = new Date(2026, 7, 22);

describe("weekday maths", () => {
  it("uses ISO numbering with Sunday as 7", () => {
    expect(isoWeekday(FRIDAY)).toBe(5);
    expect(isoWeekday(new Date(2026, 7, 23))).toBe(7); // Sunday
  });
});

describe("due dates", () => {
  it("fires a weekday rule only on its day", () => {
    expect(isDue(baocao, FRIDAY)).toBe(true);
    expect(isDue(baocao, SATURDAY)).toBe(false);
  });

  it("does not fire twice on the same day", () => {
    expect(isDue({ ...baocao, lastRun: "2026-08-21" }, FRIDAY)).toBe(false);
  });

  it("fires a daily rule every day", () => {
    expect(isDue(mail, FRIDAY)).toBe(true);
    expect(isDue(mail, SATURDAY)).toBe(true);
  });

  it("spaces a weekly rule seven days apart", () => {
    expect(isDue({ ...mail, kind: "weekly", lastRun: "2026-08-17" }, FRIDAY)).toBe(false);
    expect(isDue({ ...mail, kind: "weekly", lastRun: "2026-08-14" }, FRIDAY)).toBe(true);
  });
});

describe("materialising", () => {
  it("creates a task and records the run date", () => {
    const { created, rules } = materialise([baocao, mail], [], FRIDAY);
    expect(created.map((c) => c.title)).toEqual(["Nộp báo cáo ngày", "Kiểm tra mail"]);
    expect(rules.every((r) => r.lastRun === "2026-08-21")).toBe(true);
  });

  it("skips a rule whose task is already open, without duplicating it", () => {
    const open: Task[] = [
      {
        id: "ETC-0001",
        project: "ETC",
        category: "WRK",
        title: "Nộp báo cáo ngày",
        done: false,
        created: "2026.08.20_09.00",
      },
    ];
    const { created, rules } = materialise([baocao], open, FRIDAY);
    expect(created).toEqual([]);
    // Still marked as handled, so the check does not repeat all day.
    expect(rules[0].lastRun).toBe("2026-08-21");
  });

  it("recreates the task once the previous one is done", () => {
    const done: Task[] = [
      {
        id: "ETC-0001",
        project: "ETC",
        category: "WRK",
        title: "Nộp báo cáo ngày",
        done: true,
        created: "2026.08.14_09.00",
        completed: "2026.08.14_17.00",
      },
    ];
    expect(materialise([baocao], done, FRIDAY).created).toHaveLength(1);
  });
});

describe("rule bookkeeping", () => {
  it("hands out the next free id", () => {
    expect(nextRuleId([])).toBe("R1");
    expect(nextRuleId([baocao, mail])).toBe("R3");
  });

  it("describes a rule in Vietnamese", () => {
    expect(describeRule(baocao)).toBe("T6");
    expect(describeRule({ ...baocao, days: [1, 2, 3, 4, 5] })).toBe("T2, T3, T4, T5, T6");
    expect(describeRule(mail)).toBe("Hằng ngày");
  });
});
