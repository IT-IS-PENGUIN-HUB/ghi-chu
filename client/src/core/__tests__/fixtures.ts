/**
 * Synthetic data for tests.
 *
 * Kept out of `seed.ts` on purpose: that file ships in the public code repo,
 * so it must stay free of anything resembling real tasks or customer names.
 * Everything here is invented.
 */
import { formatTaskId } from "../codes";
import {
  paths,
  serializeFieldsFile,
  serializeProjectFile,
  serializeProjectsFile,
} from "../markdown";
import { toStamp, type Category, type Field, type Project, type Task } from "../model";

export const FIXTURE_FIELDS: Field[] = [
  { code: "SEK", name: "分野A", category: "WRK", order: 1 },
  { code: "SKS", name: "分野B", category: "WRK", order: 2 },
  { code: "CS", name: "Cuộc sống", category: "PER", order: 1 },
  { code: "HT", name: "Học tập", category: "PER", order: 2 },
];

/** Projects deliberately left unassigned, to exercise that state. */
export const FIXTURE_PROJECTS: Array<Omit<Project, "next">> = [
  { code: "ALP", name: "Alpha", category: "WRK", archived: false },
  { code: "BET", name: "Beta", category: "WRK", archived: false },
  { code: "GAM", name: "Gamma", category: "WRK", archived: false },
  { code: "DEL", name: "Delta", category: "WRK", archived: false },
  { code: "EPS", name: "Epsilon", category: "WRK", archived: false },
  { code: "ETC", name: "Chưa phân loại", category: "WRK", archived: false },
  { code: "BANK", name: "Ngân hàng", category: "PER", field: "CS", archived: false },
  { code: "CN", name: "Cá nhân chung", category: "PER", field: "CS", archived: false },
];

interface FixtureTask {
  title: string;
  project: string;
  category: Category;
  done: boolean;
  agedays: number;
}

/** Eleven tasks: seven WRK, four PER, two of them already finished. */
export const FIXTURE_TASKS: FixtureTask[] = [
  { title: "Kiểm tra khối lượng hạng mục A", project: "ALP", category: "WRK", done: false, agedays: 7 },
  { title: "Đối chiếu bản vẽ gói B", project: "BET", category: "WRK", done: false, agedays: 7 },
  { title: "Soát tài liệu bàn giao gói C", project: "GAM", category: "WRK", done: false, agedays: 6 },
  { title: "Xếp lịch khảo sát hiện trường D", project: "DEL", category: "WRK", done: false, agedays: 5 },
  { title: "Sửa khung tên bản vẽ gói E", project: "EPS", category: "WRK", done: true, agedays: 5 },
  { title: "Đặt lịch khám sức khỏe định kỳ", project: "ETC", category: "WRK", done: false, agedays: 3 },
  { title: "Nộp báo cáo ngày", project: "ETC", category: "WRK", done: false, agedays: 1 },
  { title: "Đăng ký thông tin thuê bao", project: "CN", category: "PER", done: false, agedays: 6 },
  { title: "Khai báo tài khoản ngân hàng", project: "BANK", category: "PER", done: true, agedays: 6 },
  { title: "Gửi hồ sơ qua bưu điện", project: "BANK", category: "PER", done: false, agedays: 4 },
  { title: "Cài ứng dụng học tiếng Nhật", project: "CN", category: "PER", done: false, agedays: 2 },
];

function stampDaysAgo(days: number, now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(9 + (days % 8), (days * 13) % 60, 0, 0);
  return toStamp(d);
}

/** A populated repo, for tests that need more than an empty store. */
export function buildFixtureFiles(now = new Date()): Array<{ path: string; content: string }> {
  const projects = new Map<string, Project>(
    FIXTURE_PROJECTS.map((p) => [p.code, { ...p, next: 1 }])
  );
  const byProject = new Map<string, Task[]>();

  for (const seed of FIXTURE_TASKS) {
    const project = projects.get(seed.project)!;
    const created = stampDaysAgo(seed.agedays, now);
    const task: Task = {
      id: formatTaskId(project.code, project.next),
      project: project.code,
      category: seed.category,
      title: seed.title,
      done: seed.done,
      created,
      ...(seed.done ? { completed: stampDaysAgo(Math.max(0, seed.agedays - 1), now) } : {}),
    };
    projects.set(project.code, { ...project, next: project.next + 1 });
    byProject.set(project.code, [...(byProject.get(project.code) ?? []), task]);
  }

  return [
    { path: paths.fields, content: serializeFieldsFile(FIXTURE_FIELDS) },
    { path: paths.projects, content: serializeProjectsFile([...projects.values()]) },
    ...[...projects.values()].map((project) => ({
      path: paths.project(project.code),
      content: serializeProjectFile({
        project,
        tasks: byProject.get(project.code) ?? [],
        extra: [],
      }),
    })),
  ];
}
