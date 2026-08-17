/**
 * First-run scaffold.
 *
 * Deliberately generic: this file ships in the public code repo, so it must
 * never contain real tasks, customer names or contacts. Actual data lives only
 * in the user's private data repo and in their browser.
 */
import {
  paths,
  serializeFieldsFile,
  serializeProjectFile,
  serializeProjectsFile,
} from "./markdown";
import { DEFAULT_PROJECTS, type Field, type Project } from "./model";

/**
 * Starter fields. Two per group so the Projects screen has something to show,
 * and so the shape of the hierarchy is obvious. All four are renamable and
 * removable from the UI.
 */
const STARTER_FIELDS: Field[] = [
  { code: "CS", name: "Cuộc sống", category: "PER", order: 1 },
  { code: "HT", name: "Học tập", category: "PER", order: 2 },
];

/** Catch-all project per group, so a task can always be filed somewhere. */
const STARTER_PROJECTS: Project[] = [
  {
    code: DEFAULT_PROJECTS.WRK,
    name: "Chưa phân loại",
    category: "WRK",
    next: 1,
    archived: false,
  },
  {
    code: DEFAULT_PROJECTS.PER,
    name: "Cá nhân chung",
    category: "PER",
    field: "CS",
    next: 1,
    archived: false,
  },
];

const CONTACTS_TEMPLATE = `# Danh bạ

Thêm số điện thoại ở đây — trên iPhone bấm vào số là gọi được ngay.
Mỗi dòng có dạng: \`- Tên · \\\`số điện thoại\\\` · ghi chú\`

## Ví dụ
- Văn phòng · \`03-1234-5678\` · thay bằng số thật của bạn
`;

/** Files laid down the first time the app opens on a device with no data. */
export function buildEmptyFiles(): Array<{ path: string; content: string }> {
  return [
    { path: paths.fields, content: serializeFieldsFile(STARTER_FIELDS) },
    { path: paths.projects, content: serializeProjectsFile(STARTER_PROJECTS) },
    ...STARTER_PROJECTS.map((project) => ({
      path: paths.project(project.code),
      content: serializeProjectFile({ project, tasks: [], extra: [] }),
    })),
    { path: paths.contacts, content: CONTACTS_TEMPLATE },
  ];
}
