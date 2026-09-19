import { describe, expect, it } from "vitest";
import { describeDuplicate, findDuplicateTask } from "./duplicates";
import { toStamp, type Task } from "./model";

const NOW = new Date("2026-09-19T10:00:00");

function daysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return toStamp(d);
}

function task(over: Partial<Task> & { title: string }): Task {
  return {
    id: "CN-0001",
    project: "CN",
    category: "PER",
    done: false,
    created: daysAgo(1),
    ...over,
  };
}

describe("đã thêm việc này rồi", () => {
  it("bắt được dòng trùng đang còn trong danh sách", () => {
    const hit = findDuplicateTask(
      [task({ title: "Giặt ghế" })],
      "Giặt ghế",
      "CN",
      NOW
    );
    expect(hit?.state).toBe("open");
    expect(describeDuplicate(hit!)).toBe("đang còn trong danh sách");
  });

  it("bỏ qua dấu và khoảng trắng — gõ vội vẫn nhận ra", () => {
    const tasks = [task({ title: "Giặt ghế" })];
    expect(findDuplicateTask(tasks, "giat ghe", "CN", NOW)).not.toBeNull();
    expect(findDuplicateTask(tasks, "  GIẶT   GHẾ ", "CN", NOW)).not.toBeNull();
  });

  it("nhắc cả việc vừa làm xong hôm qua", () => {
    const hit = findDuplicateTask(
      [task({ title: "Giặt ghế", done: true, completed: daysAgo(1) })],
      "Giặt ghế",
      "CN",
      NOW
    );
    expect(hit?.state).toBe("done");
    expect(describeDuplicate(hit!)).toBe("đã xong hôm qua");
  });

  it("thôi nhắc khi việc cũ đã xong lâu", () => {
    const hit = findDuplicateTask(
      [task({ title: "Giặt ghế", done: true, completed: daysAgo(30) })],
      "Giặt ghế",
      "CN",
      NOW
    );
    expect(hit).toBeNull();
  });

  it("vẫn nhắc khi câu đó nằm ở phân nhánh khác, và nói rõ là ở đâu", () => {
    const hit = findDuplicateTask(
      [task({ title: "Giặt ghế", project: "ALP" })],
      "Giặt ghế",
      "BET",
      NOW
    );
    expect(hit?.sameProject).toBe(false);
    expect(hit?.task.project).toBe("ALP");
  });

  it("ưu tiên dòng ở ngay phân nhánh đang gõ", () => {
    const hit = findDuplicateTask(
      [
        task({ id: "ALP-0001", title: "Giặt ghế", project: "ALP" }),
        task({ id: "BET-0001", title: "Giặt ghế", project: "BET" }),
      ],
      "Giặt ghế",
      "BET",
      NOW
    );
    expect(hit?.task.id).toBe("BET-0001");
    expect(hit?.sameProject).toBe(true);
  });

  it("ưu tiên dòng đang tồn hơn dòng đã xong", () => {
    const hit = findDuplicateTask(
      [
        task({
          id: "CN-0001",
          title: "Giặt ghế",
          done: true,
          completed: daysAgo(2),
        }),
        task({ id: "CN-0002", title: "Giặt ghế" }),
      ],
      "Giặt ghế",
      "CN",
      NOW
    );
    expect(hit?.task.id).toBe("CN-0002");
  });

  it("câu rỗng thì không nhắc gì", () => {
    expect(
      findDuplicateTask([task({ title: "Giặt ghế" })], "   ", "CN", NOW)
    ).toBeNull();
  });
});
