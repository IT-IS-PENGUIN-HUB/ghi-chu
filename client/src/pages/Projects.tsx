import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  House,
  Layers,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldDialog } from "@/components/FieldDialog";
import { ProjectDialog } from "@/components/ProjectDialog";
import {
  HelpButton,
  HelpPanel,
  useScreenHelp,
  type HelpItem,
} from "@/components/ScreenHelp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  type Field,
  type Project,
} from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "project-tree-collapsed";

function loadCollapsed(): Set<string> {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(COLLAPSED_KEY) ?? "[]"
    );
    return new Set(
      Array.isArray(raw)
        ? raw.filter((k): k is string => typeof k === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

function persistCollapsed(next: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
  } catch {
    // Private mode — fine, the tree just reopens next visit.
  }
}

/** Node keys the breadcrumb on a project page can point at: `#field:SEK`, `#root:WRK`. */
function hashNodeKey(): string {
  return decodeURIComponent(window.location.hash.slice(1));
}

const HELP: HelpItem[] = [
  {
    label: "Cây này giống cây thư mục",
    text: (
      <>
        bên trái của Explorer hay Regedit. Từ ngoài vào trong: <b>Nhóm</b> (Công
        việc / Cá nhân — hai tủ lớn, không đổi) → <b>Lĩnh vực</b> (ngăn gom các
        dự án cùng loại, ví dụ 積算, 照査) → <b>Dự án</b> (một 案件 cụ thể) →{" "}
        <b>Việc</b> (cái bạn gõ hằng ngày).
      </>
    ),
  },
  {
    label: "Bấm tên dự án",
    text: "để mở danh sách việc đang tồn và đã xong của dự án đó.",
  },
  {
    label: "Bấm ▸ / ▾",
    text: "để thu gọn hoặc mở rộng một nhóm, một lĩnh vực. App nhớ trạng thái này.",
  },
  {
    label: "Nút ⋮ cuối dòng",
    text: "chứa mọi thao tác của dòng đó: thêm dự án vào đây, sửa tên, đổi lĩnh vực, lưu trữ, xoá.",
  },
  {
    label: "Chưa xếp vào lĩnh vực",
    text: "là ngăn tạm cho dự án chưa thuộc lĩnh vực nào — dùng bình thường, không bắt buộc phải xếp.",
  },
  {
    label: "Xoá lĩnh vực không xoá việc",
    text: "các dự án bên trong chỉ chuyển sang ngăn “Chưa xếp vào lĩnh vực”.",
  },
  {
    label: "Chữ mờ như ALP",
    text: (
      <>
        là mã dự án — phần đầu của mã việc (
        <code className="font-mono">ALP-0042</code>). Đổi được trong “Sửa dự
        án”, app tự đánh lại mã cho việc bên trong.
      </>
    ),
  },
];

type ProjectEditor = {
  project: Project | null;
  category: Category;
  field?: string;
};
type FieldEditor = { field: Field | null; category: Category };

/**
 * The whole hierarchy as one explorer-style tree: group → field → project.
 *
 * Earlier this was tabs plus flat sections, and the levels never read as
 * levels — people could not tell which of "Lĩnh vực mới" and "Dự án mới"
 * contained the other. Drawing it as a tree with guide lines borrows a shape
 * everyone already knows from Explorer and Regedit, so the structure explains
 * itself before a word is read.
 */
export default function Projects() {
  const { fields, projects, tasks } = useStore();
  const help = useScreenHelp("projects");
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [focus, setFocus] = useState<string | null>(null);
  const [fieldEditor, setFieldEditor] = useState<FieldEditor | null>(null);
  const [projectEditor, setProjectEditor] = useState<ProjectEditor | null>(
    null
  );
  const [deletingField, setDeletingField] = useState<Field | null>(null);

  const openCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.done) continue;
      counts.set(t.project, (counts.get(t.project) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const toggleNode = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistCollapsed(next);
      return next;
    });

  // The breadcrumb on a project page links back here with a node key in the
  // hash. Open that node, scroll to it and flash it, so "back to 積算" lands
  // on 積算 rather than at the top of the tree.
  useEffect(() => {
    const land = () => {
      const key = hashNodeKey();
      if (!key) return;
      setCollapsed(prev => {
        // Archived nodes start closed, so for them the key means "open".
        const openMeansHas = key.startsWith("archived:");
        if (prev.has(key) === openMeansHas) return prev;
        const next = new Set(prev);
        if (openMeansHas) next.add(key);
        else next.delete(key);
        persistCollapsed(next);
        return next;
      });
      setFocus(key);
      // Drop the hash so a reload does not flash the node a second time.
      history.replaceState(
        history.state,
        "",
        window.location.pathname + window.location.search
      );
    };
    land();
    window.addEventListener("hashchange", land);
    return () => window.removeEventListener("hashchange", land);
  }, []);

  useEffect(() => {
    if (!focus) return;
    // The store may still be loading on a cold start, so give the node a few
    // frames to appear before giving up on the scroll.
    let tries = 0;
    let timer = setTimeout(function tick() {
      const el = document.getElementById(`node-${focus}`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      else if (tries++ < 10) timer = setTimeout(tick, 100);
    }, 0);
    const clear = setTimeout(() => setFocus(null), 2500);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [focus]);

  const newField = (category: Category) =>
    setFieldEditor({ field: null, category });
  const newProject = (category: Category, field?: string) =>
    setProjectEditor({ project: null, category, field });
  const editProject = (project: Project) =>
    setProjectEditor({ project, category: project.category });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dự án</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mỗi việc được cất trong một dự án. Bấm vào dự án để xem việc bên
            trong.
          </p>
        </div>
        <HelpButton {...help} />
      </header>

      <HelpPanel {...help} items={HELP} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => newProject("WRK")} className="gap-1.5">
          <FolderPlus className="size-4" /> Dự án mới
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => newField("WRK")}
          className="gap-1.5"
        >
          <Layers className="size-4" /> Lĩnh vực mới
        </Button>
        <Legend />
      </div>

      <div className="rounded-xl border border-border bg-card px-1.5 py-2 sm:px-3">
        <ul className="space-y-1">
          {CATEGORIES.map(category => (
            <RootNode
              key={category}
              category={category}
              fields={fields
                .filter(f => f.category === category)
                .sort(
                  (a, b) => a.order - b.order || a.name.localeCompare(b.name)
                )}
              projects={projects.filter(p => p.category === category)}
              openCount={openCount}
              collapsed={collapsed}
              focus={focus}
              onToggle={toggleNode}
              onNewField={newField}
              onNewProject={newProject}
              onEditField={field => setFieldEditor({ field, category })}
              onDeleteField={setDeletingField}
              onEditProject={editProject}
            />
          ))}
        </ul>
      </div>

      {fieldEditor && (
        <FieldDialog
          field={fieldEditor.field}
          defaultCategory={fieldEditor.category}
          existing={fields}
          onClose={() => setFieldEditor(null)}
        />
      )}

      {projectEditor && (
        <ProjectDialog
          project={projectEditor.project}
          defaultCategory={projectEditor.category}
          defaultField={projectEditor.field}
          fields={fields}
          existing={projects}
          onClose={() => setProjectEditor(null)}
        />
      )}

      <AlertDialog
        open={deletingField !== null}
        onOpenChange={o => !o && setDeletingField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xoá lĩnh vực "{deletingField?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Các dự án trong lĩnh vực này sẽ chuyển sang ngăn "Chưa xếp vào
              lĩnh vực". Không có công việc nào bị xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingField) store.deleteField(deletingField.code);
                setDeletingField(null);
              }}
            >
              Xoá lĩnh vực
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------------- nodes --

interface RootNodeProps {
  category: Category;
  fields: Field[];
  projects: Project[];
  openCount: Map<string, number>;
  collapsed: Set<string>;
  /** Node key being flashed after a breadcrumb jump, if any. */
  focus: string | null;
  onToggle: (key: string) => void;
  onNewField: (category: Category) => void;
  onNewProject: (category: Category, field?: string) => void;
  onEditField: (field: Field) => void;
  onDeleteField: (field: Field) => void;
  onEditProject: (project: Project) => void;
}

function RootNode({
  category,
  fields,
  projects,
  openCount,
  collapsed,
  focus,
  onToggle,
  onNewField,
  onNewProject,
  onEditField,
  onDeleteField,
  onEditProject,
}: RootNodeProps) {
  const nodeKey = `root:${category}`;
  const Icon = category === "WRK" ? Briefcase : House;

  const active = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);
  const known = new Set(fields.map(f => f.code));
  const unfiled = active.filter(p => !p.field || !known.has(p.field));
  const openTotal = active.reduce(
    (n, p) => n + (openCount.get(p.code) ?? 0),
    0
  );

  const shared = { openCount, collapsed, focus, onToggle, onEditProject };

  return (
    <li>
      {/* The two groups are fixed and always open. Letting them collapse meant
          one tap on "Công việc" made the whole tree vanish, which reads as
          "I broke it" rather than "I folded it". */}
      <div id={`node-${nodeKey}`} className={rowClass(focus === nodeKey)}>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 sm:px-1.5">
          <span className="w-4 shrink-0" aria-hidden />
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-white",
              category === "WRK" ? "bg-wrk" : "bg-per"
            )}
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-base font-semibold">
            {CATEGORY_LABEL[category]}
          </span>
          <LevelTag>nhóm</LevelTag>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {openTotal} việc
          </span>
        </div>
        <NodeMenu label={`Tuỳ chọn nhóm ${CATEGORY_LABEL[category]}`}>
          <DropdownMenuItem onClick={() => onNewProject(category)}>
            <FolderPlus className="mr-2 size-4" /> Thêm dự án vào nhóm này
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNewField(category)}>
            <Layers className="mr-2 size-4" /> Thêm lĩnh vực vào nhóm này
          </DropdownMenuItem>
        </NodeMenu>
      </div>

      <Branch>
        {fields.map(field => (
          <FieldNode
            key={field.code}
            nodeKey={`field:${field.code}`}
            name={field.name}
            projects={active.filter(p => p.field === field.code)}
            menu={
              <NodeMenu label={`Tuỳ chọn lĩnh vực ${field.name}`}>
                <DropdownMenuItem
                  onClick={() => onNewProject(category, field.code)}
                >
                  <FolderPlus className="mr-2 size-4" /> Thêm dự án vào lĩnh vực
                  này
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEditField(field)}>
                  <Pencil className="mr-2 size-4" /> Sửa lĩnh vực (tên, mã)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeleteField(field)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" /> Xoá lĩnh vực (giữ nguyên
                  việc)
                </DropdownMenuItem>
              </NodeMenu>
            }
            {...shared}
          />
        ))}

        {/* Always present so a project without a field has a visible home.
              This used to be a yellow warning box, which shouted at the
              built-in catch-all project forever. */}
        {(unfiled.length > 0 || fields.length === 0) && (
          <FieldNode
            nodeKey={`unfiled:${category}`}
            name="Chưa xếp vào lĩnh vực"
            projects={unfiled}
            muted
            menu={
              <NodeMenu label="Tuỳ chọn ngăn chưa xếp">
                <DropdownMenuItem onClick={() => onNewProject(category)}>
                  <FolderPlus className="mr-2 size-4" /> Thêm dự án vào đây
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNewField(category)}>
                  <Layers className="mr-2 size-4" /> Tạo lĩnh vực để xếp
                </DropdownMenuItem>
              </NodeMenu>
            }
            {...shared}
          />
        )}

        {archived.length > 0 && (
          <FieldNode
            nodeKey={`archived:${category}`}
            name="Đã lưu trữ"
            icon={Archive}
            projects={archived}
            muted
            defaultCollapsed
            {...shared}
          />
        )}
      </Branch>
    </li>
  );
}

interface FieldNodeProps {
  nodeKey: string;
  name: string;
  projects: Project[];
  openCount: Map<string, number>;
  collapsed: Set<string>;
  focus: string | null;
  onToggle: (key: string) => void;
  onEditProject: (project: Project) => void;
  menu?: ReactNode;
  icon?: typeof Folder;
  muted?: boolean;
  defaultCollapsed?: boolean;
}

function FieldNode({
  nodeKey,
  name,
  projects,
  openCount,
  collapsed,
  focus,
  onToggle,
  onEditProject,
  menu,
  icon,
  muted,
  defaultCollapsed,
}: FieldNodeProps) {
  // Collapsed state is stored positively ("this one is closed"), so a node
  // that should start closed inverts the meaning of its own key.
  const open = defaultCollapsed
    ? collapsed.has(nodeKey)
    : !collapsed.has(nodeKey);
  const FolderIcon = icon ?? (open ? FolderOpen : Folder);

  return (
    <TreeItem>
      <div id={`node-${nodeKey}`} className={rowClass(focus === nodeKey)}>
        <button
          type="button"
          onClick={() => onToggle(nodeKey)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-accent sm:px-1.5"
        >
          <Chevron open={open} />
          <FolderIcon
            className={cn(
              "size-[1.125rem] shrink-0",
              muted ? "text-muted-foreground" : "text-amber-500"
            )}
          />
          <span
            className={cn(
              "min-w-0 flex-1 break-words font-medium leading-snug",
              muted && "text-muted-foreground"
            )}
          >
            {name}
          </span>
          {!muted && <LevelTag>lĩnh vực</LevelTag>}
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {projects.length}
            <span className="hidden sm:inline"> dự án</span>
          </span>
        </button>
        {menu ?? <span className="tap shrink-0" aria-hidden />}
      </div>

      {open && (
        <Branch>
          {projects.length === 0 ? (
            <TreeItem>
              <p className="px-1.5 py-1.5 text-xs text-muted-foreground">
                Trống — dùng ⋮ ở dòng trên để thêm dự án vào đây.
              </p>
            </TreeItem>
          ) : (
            projects.map(project => (
              <ProjectNode
                key={project.code}
                project={project}
                count={openCount.get(project.code) ?? 0}
                onEdit={() => onEditProject(project)}
              />
            ))
          )}
        </Branch>
      )}
    </TreeItem>
  );
}

function ProjectNode({
  project,
  count,
  onEdit,
}: {
  project: Project;
  count: number;
  onEdit: () => void;
}) {
  return (
    <TreeItem>
      <div className="flex items-center gap-0.5">
        <Link
          href={`/du-an/${project.code}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-accent sm:px-1.5",
            project.archived && "opacity-60"
          )}
        >
          {/* Leaf: keeps the icon column aligned with the folders above. */}
          <span className="w-4 shrink-0" aria-hidden />
          <FileText className="size-[1.125rem] shrink-0 text-muted-foreground" />
          {/* Wraps rather than truncates: on a phone three levels of indent
              left "Al…" of "Alpha 県道改良", which is no name at all. */}
          <span className="min-w-0 flex-1 break-words leading-snug">
            {project.name}
            <span className="ml-1.5 hidden font-mono text-[0.7rem] text-muted-foreground/70 sm:inline">
              {project.code}
            </span>
          </span>
          {count > 0 && (
            <span
              className="shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground"
              title={`${count} việc đang tồn`}
            >
              {count}
              <span className="hidden sm:inline"> việc</span>
            </span>
          )}
          <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground/60 sm:block" />
        </Link>
        <NodeMenu label={`Tuỳ chọn dự án ${project.name}`}>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 size-4" /> Sửa dự án (tên, lĩnh vực, mã)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              store.updateProject(project.code, { archived: !project.archived })
            }
          >
            {project.archived ? (
              <>
                <ArchiveRestore className="mr-2 size-4" /> Bỏ lưu trữ
              </>
            ) : (
              <>
                <Archive className="mr-2 size-4" /> Lưu trữ (ẩn khỏi ô thêm
                nhanh)
              </>
            )}
          </DropdownMenuItem>
        </NodeMenu>
      </div>
    </TreeItem>
  );
}

// ------------------------------------------------------------------ pieces --

/** A tree row; `flash` is the brief highlight after a breadcrumb jump lands on it. */
function rowClass(flash: boolean) {
  return cn(
    "flex items-center gap-0.5 rounded-lg transition-[background-color,box-shadow] duration-500",
    flash && "bg-primary/10 ring-2 ring-primary"
  );
}

/**
 * A nested level. The left border is the vertical guide line; it is offset so
 * it hangs from the centre of the parent row's chevron.
 */
function Branch({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-[0.75rem] border-l border-dotted border-muted-foreground/40 sm:ml-[0.875rem]">
      {children}
    </ul>
  );
}

/**
 * One row inside a Branch. `before` draws the short horizontal tick from the
 * guide line to the row; `after` on the last item paints over the guide line
 * below its tick, so the line ends at the last child the way Explorer's does.
 */
function TreeItem({ children }: { children: ReactNode }) {
  return (
    <li
      className={cn(
        "relative pl-1.5 sm:pl-2.5",
        "before:absolute before:left-0 before:top-[1.3rem] before:w-1.5 before:border-t before:border-dotted before:border-muted-foreground/40 before:content-[''] sm:before:w-2.5",
        "last:after:absolute last:after:-left-px last:after:bottom-0 last:after:top-[1.3rem] last:after:w-px last:after:bg-card last:after:content-['']"
      )}
    >
      {children}
    </li>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform",
        open && "rotate-90"
      )}
    />
  );
}

/** Names the level in words, since an icon alone was exactly what confused people. */
function LevelTag({ children }: { children: ReactNode }) {
  return (
    <span className="hidden shrink-0 rounded bg-muted px-1 py-px text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
      {children}
    </span>
  );
}

function NodeMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title="Tuỳ chọn"
        className="tap flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground sm:ml-auto">
      <Briefcase className="size-3.5" />
      Nhóm
      <ChevronRight className="size-3" />
      <Folder className="size-3.5 text-amber-500" />
      Lĩnh vực
      <ChevronRight className="size-3" />
      <FileText className="size-3.5" />
      Dự án
      <ChevronRight className="size-3" />
      Việc
    </p>
  );
}
