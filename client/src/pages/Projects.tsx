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
  ListPlus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "@/components/DeleteProjectDialog";
import { FieldDialog } from "@/components/FieldDialog";
import { ProjectDialog } from "@/components/ProjectDialog";
import { QuickTaskDialog } from "@/components/QuickTaskDialog";
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
        bên trái của Explorer hay Regedit. Từ ngoài vào trong: <b>Phạm trù</b>{" "}
        (Công việc / Cá nhân — hai tủ lớn, không đổi) → <b>Dự án</b> (ngăn gom
        các phân nhánh cùng loại, ví dụ 積算, 照査) → <b>Phân nhánh</b> (một
        案件 cụ thể) → <b>Việc</b> (cái bạn gõ hằng ngày).
      </>
    ),
  },
  {
    label: "＋ Phân nhánh / ＋ Việc trên mỗi dòng",
    text: "bấm ＋ Phân nhánh ở dòng dự án để thêm phân nhánh vào dự án đó; bấm ＋ Việc ở dòng phân nhánh để thêm việc ngay, không cần mở phân nhánh ra.",
  },
  {
    label: "Bấm tên phân nhánh",
    text: "để mở danh sách việc đang tồn và đã xong của phân nhánh đó.",
  },
  {
    label: "Bấm ▸ / ▾",
    text: "để thu gọn hoặc mở rộng một phạm trù, một dự án. App nhớ trạng thái này.",
  },
  {
    label: "Chưa xếp vào dự án",
    text: "là ngăn tạm cho phân nhánh chưa thuộc dự án nào — dùng bình thường, không bắt buộc phải xếp.",
  },
  {
    label: "Xoá dự án không xoá việc",
    text: "các phân nhánh bên trong chỉ chuyển sang ngăn “Chưa xếp vào dự án”.",
  },
  {
    label: "Xoá phân nhánh",
    text: "nằm trong menu ⋮ của dòng phân nhánh, và ở nút “Xoá” trong trang phân nhánh. App luôn hỏi lại, và chỉ xoá được phân nhánh rỗng — còn việc bên trong thì nó nói rõ còn bao nhiêu việc thay vì xoá theo.",
  },
  {
    label: "Chữ mờ như ALP",
    text: (
      <>
        là mã phân nhánh — phần đầu của mã việc (
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
 * The whole hierarchy as one explorer-style tree: phạm trù → dự án → phân nhánh.
 *
 * Drawing it as a tree with guide lines borrows a shape everyone already knows
 * from Explorer and Regedit, so the structure explains itself before a word is
 * read. Every row that can hold something shows an inline "＋" for the next
 * level down, so adding never means hunting through a menu.
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
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  // { project: null } = the screen-level button, which asks where to file.
  const [addingTask, setAddingTask] = useState<{
    project: Project | null;
  } | null>(null);

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

  // A just-created project must be seen to land somewhere: open the dự án (or
  // the "chưa xếp" bucket) it went into and flash it. Otherwise a project that
  // fell into a collapsed bucket looks lost, and a duplicate gets made.
  const revealProject = (created: Project) => {
    const key =
      created.field && fields.some(f => f.code === created.field)
        ? `field:${created.field}`
        : `unfiled:${created.category}`;
    setCollapsed(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      persistCollapsed(next);
      return next;
    });
    setFocus(key);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dự án</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mỗi việc được cất trong một phân nhánh. Bấm vào phân nhánh để xem
            việc bên trong.
          </p>
        </div>
        <HelpButton {...help} />
      </header>

      <HelpPanel {...help} items={HELP} />

      {/* Read left to right, the row is the hierarchy itself: dự án, then
          phân nhánh, then the việc that goes inside one. Only the last is
          filled in — making a container is rare housekeeping, writing down a
          việc is the thing you came here to do. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => newField("WRK")}
          className="gap-1.5"
        >
          <Layers className="size-4" /> Dự án mới
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => newProject("WRK")}
          className="gap-1.5"
        >
          <FolderPlus className="size-4" /> Phân nhánh mới
        </Button>
        <Button
          size="sm"
          onClick={() => setAddingTask({ project: null })}
          className="gap-1.5"
        >
          <ListPlus className="size-4" /> Thêm việc mới
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
              onDeleteProject={setDeletingProject}
              onAddTask={project => setAddingTask({ project })}
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
          onCreated={revealProject}
          onRequestDelete={setDeletingProject}
        />
      )}

      {deletingProject && (
        <DeleteProjectDialog
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
        />
      )}

      {addingTask && (
        <QuickTaskDialog
          project={addingTask.project}
          onClose={() => setAddingTask(null)}
        />
      )}

      <AlertDialog
        open={deletingField !== null}
        onOpenChange={o => !o && setDeletingField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xoá dự án "{deletingField?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Các phân nhánh trong dự án này sẽ chuyển sang ngăn "Chưa xếp vào
              dự án". Không có công việc nào bị xoá.
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
              Xoá dự án
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
  onDeleteProject: (project: Project) => void;
  onAddTask: (project: Project) => void;
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
  onDeleteProject,
  onAddTask,
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

  const shared = {
    openCount,
    collapsed,
    focus,
    onToggle,
    onEditProject,
    onDeleteProject,
    onAddTask,
  };

  return (
    <li>
      {/* The two phạm trù are fixed and always open. Letting them collapse
          meant one tap on "Công việc" made the whole tree vanish, which reads
          as "I broke it" rather than "I folded it". */}
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
          <LevelTag>phạm trù</LevelTag>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {openTotal} việc
          </span>
        </div>
        <InlineAdd
          label="Phân nhánh"
          onClick={() => onNewProject(category)}
          title={`Thêm phân nhánh vào ${CATEGORY_LABEL[category]}`}
        />
        <NodeMenu label={`Tuỳ chọn phạm trù ${CATEGORY_LABEL[category]}`}>
          <DropdownMenuItem onClick={() => onNewProject(category)}>
            <FolderPlus className="mr-2 size-4" /> Thêm phân nhánh vào phạm trù
            này
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNewField(category)}>
            <Layers className="mr-2 size-4" /> Thêm dự án vào phạm trù này
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
            onAddProject={() => onNewProject(category, field.code)}
            menu={
              <NodeMenu label={`Tuỳ chọn dự án ${field.name}`}>
                <DropdownMenuItem
                  onClick={() => onNewProject(category, field.code)}
                >
                  <FolderPlus className="mr-2 size-4" /> Thêm phân nhánh vào dự
                  án này
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEditField(field)}>
                  <Pencil className="mr-2 size-4" /> Sửa dự án (tên, mã)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDeleteField(field)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" /> Xoá dự án (giữ nguyên việc)
                </DropdownMenuItem>
              </NodeMenu>
            }
            {...shared}
          />
        ))}

        {/* Always present so a project without a dự án has a visible home. */}
        {(unfiled.length > 0 || fields.length === 0) && (
          <FieldNode
            nodeKey={`unfiled:${category}`}
            name="Chưa xếp vào dự án"
            projects={unfiled}
            muted
            onAddProject={() => onNewProject(category)}
            menu={
              <NodeMenu label="Tuỳ chọn ngăn chưa xếp">
                <DropdownMenuItem onClick={() => onNewProject(category)}>
                  <FolderPlus className="mr-2 size-4" /> Thêm phân nhánh vào đây
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNewField(category)}>
                  <Layers className="mr-2 size-4" /> Tạo dự án để xếp
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
  onDeleteProject: (project: Project) => void;
  onAddTask: (project: Project) => void;
  onAddProject?: () => void;
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
  onDeleteProject,
  onAddTask,
  onAddProject,
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
          {!muted && <LevelTag>dự án</LevelTag>}
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {projects.length}
            <span className="hidden sm:inline"> phân nhánh</span>
          </span>
        </button>
        {onAddProject && (
          <InlineAdd
            label="Phân nhánh"
            onClick={onAddProject}
            title={`Thêm phân nhánh vào ${name}`}
          />
        )}
        {menu ?? <span className="tap shrink-0" aria-hidden />}
      </div>

      {open && (
        <Branch>
          {projects.length === 0 ? (
            <TreeItem>
              <p className="px-1.5 py-1.5 text-xs text-muted-foreground">
                Trống — bấm <b>＋ Phân nhánh</b> ở dòng trên để thêm.
              </p>
            </TreeItem>
          ) : (
            projects.map(project => (
              <ProjectNode
                key={project.code}
                project={project}
                count={openCount.get(project.code) ?? 0}
                onEdit={() => onEditProject(project)}
                onDelete={() => onDeleteProject(project)}
                onAddTask={() => onAddTask(project)}
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
  onDelete,
  onAddTask,
}: {
  project: Project;
  count: number;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: () => void;
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
          {/* The two levels above name themselves; this one is the newest
              word of the three, so it needs the label most. */}
          <LevelTag>phân nhánh</LevelTag>
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
        {!project.archived && (
          <InlineAdd
            label="Việc"
            icon={ListPlus}
            onClick={onAddTask}
            title={`Thêm việc vào ${project.name}`}
          />
        )}
        <NodeMenu label={`Tuỳ chọn phân nhánh ${project.name}`}>
          <DropdownMenuItem onClick={onAddTask}>
            <ListPlus className="mr-2 size-4" /> Thêm việc vào phân nhánh này
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 size-4" /> Sửa phân nhánh (tên, dự án, mã)
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
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" /> Xoá phân nhánh (chỉ khi rỗng)
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

/** The inline "add one level down" button that sits on a row (desktop). */
function InlineAdd({
  label,
  icon: Icon = FolderPlus,
  onClick,
  title,
}: {
  label: string;
  icon?: typeof FolderPlus;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="hidden shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
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
      Phạm trù
      <ChevronRight className="size-3" />
      <Folder className="size-3.5 text-amber-500" />
      Dự án
      <ChevronRight className="size-3" />
      <FileText className="size-3.5" />
      Phân nhánh
      <ChevronRight className="size-3" />
      Việc
    </p>
  );
}
