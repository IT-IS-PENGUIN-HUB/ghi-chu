import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  FileText,
  Folder,
  House,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { DeleteProjectDialog } from "@/components/DeleteProjectDialog";
import { ProjectDialog } from "@/components/ProjectDialog";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useComposition } from "@/hooks/useComposition";
import { pacesByProject } from "@/core/cadence";
import { findDuplicateTask } from "@/core/duplicates";
import { DuplicateHint } from "@/components/DuplicateHint";
import { CATEGORY_LABEL, type Project } from "@/core/model";
import { store } from "@/core/store";
import { deleteTaskWithUndo, toggleTaskWithUndo } from "@/lib/taskActions";
import { useStore } from "@/hooks/useStore";

const crumbClass =
  "inline-flex items-center gap-1 rounded-md px-1 py-0.5 underline-offset-2 hover:bg-accent hover:text-foreground hover:underline";

/**
 * The long-term archive for one project — the "thư mục công việc" a permanent
 * id belongs to. Mirrors data/tasks/<CODE>.md: open work above, finished below.
 */
export default function ProjectDetail() {
  const [, params] = useRoute("/du-an/:code");
  const [, navigate] = useLocation();
  const { projects, fields, tasks } = useStore();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const code = params?.code?.toUpperCase() ?? "";
  const project = projects.find(p => p.code === code);

  const mine = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks
      .filter(t => t.project === code)
      .filter(
        t =>
          !needle ||
          t.title.toLowerCase().includes(needle) ||
          t.id.toLowerCase().includes(needle)
      );
  }, [tasks, code, query]);

  const open = useMemo(
    () =>
      mine
        .filter(t => !t.done)
        .sort((a, b) => a.created.localeCompare(b.created)),
    [mine]
  );
  const done = useMemo(
    () =>
      mine
        .filter(t => t.done)
        .sort((a, b) =>
          (b.completed ?? b.created).localeCompare(a.completed ?? a.created)
        ),
    [mine]
  );

  const pace = useMemo(
    () => pacesByProject(projects, fields, tasks).get(code),
    [projects, fields, tasks, code]
  );

  const onToggle = useCallback((id: string) => toggleTaskWithUndo(id), []);
  const onRename = useCallback(
    (id: string, title: string) => store.updateTask(id, { title }),
    []
  );
  const onStar = useCallback(
    (id: string, starred: boolean) => store.updateTask(id, { starred }),
    []
  );
  const onDelete = useCallback((id: string) => deleteTaskWithUndo(id), []);
  const onMove = useCallback(
    (id: string, target: string) => store.moveTask(id, target),
    []
  );

  // Add work straight into this project — the page used to be read-only, so an
  // empty project was a dead end you could look at but not fill.
  const [newTitle, setNewTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const addTask = () => {
    const t = newTitle.trim();
    if (!t || !project) return;
    store.addTask({
      title: t,
      project: project.code,
      category: project.category,
    });
    setNewTitle("");
    addInputRef.current?.focus();
  };
  const duplicate = useMemo(
    () => findDuplicateTask(tasks, newTitle, code),
    [tasks, newTitle, code]
  );

  const { isComposing: _c, ...addHandlers } = useComposition<HTMLInputElement>({
    onKeyDown: e => {
      if (e.key === "Enter") addTask();
    },
  });
  void _c;

  if (!project) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Không tìm thấy phân nhánh {code}.
        </p>
        <Button variant="link" asChild>
          <Link href="/du-an">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

  const field = fields.find(f => f.code === project.field);
  const GroupIcon = project.category === "WRK" ? Briefcase : House;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* A real button, not a muted text link: an installed PWA and the
            desktop window have no browser back button, so this is the only
            visible way out of a project. */}
        <Link
          href="/du-an"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 text-sm font-medium hover:border-primary/50 hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Quay lại Dự án
        </Link>

        {/* Same path the tree on the Projects screen draws, and each crumb is
            a link back into the tree at that node — an address bar, not a
            caption. The hash names the node for the tree to open and flash. */}
        <nav
          aria-label="Vị trí trong cây phân nhánh"
          className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground"
        >
          <Link href={`/du-an#root:${project.category}`} className={crumbClass}>
            <GroupIcon className="size-3.5" />{" "}
            {CATEGORY_LABEL[project.category]}
          </Link>
          <ChevronRight className="size-3.5" />
          <Link
            href={
              field
                ? `/du-an#field:${field.code}`
                : `/du-an#unfiled:${project.category}`
            }
            className={crumbClass}
          >
            <Folder className="size-3.5 text-amber-500" />{" "}
            {field?.name ?? "Chưa xếp vào dự án"}
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <FileText className="size-3.5" /> {project.name}
          </span>
        </nav>
      </div>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mã phân nhánh{" "}
            <span className="font-mono font-medium">{project.code}</span> — mọi
            việc bên trong có mã dạng{" "}
            <span className="font-mono">{project.code}-0001</span>
          </p>
        </div>
        {/* Named, not two bare glyphs: this is the only place a whole
            project can be renamed or removed, and a trash can next to a
            pencil is exactly the pair worth spelling out. */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-1.5"
          >
            <Pencil className="size-4" /> Sửa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleting(true)}
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" /> Xoá
          </Button>
        </div>
      </header>

      {/* Add straight into this project. */}
      <div className="flex gap-2">
        <Input
          ref={addInputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          {...addHandlers}
          placeholder={`Thêm việc vào ${project.name}…`}
          aria-label="Thêm việc vào phân nhánh này"
          className="h-11 flex-1 border-2 focus-visible:ring-2"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
        />
        <Button
          onClick={addTask}
          disabled={!newTitle.trim()}
          className="h-11 gap-1.5"
        >
          <Plus className="size-4 stroke-[2.5]" /> Thêm
        </Button>
      </div>

      {duplicate && <DuplicateHint hit={duplicate} />}

      {mine.length > 6 && (
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Lọc trong ${project.name}…`}
          aria-label="Lọc công việc trong phân nhánh"
          className="h-10"
        />
      )}

      <Section
        title="Đang tồn"
        count={open.length}
        empty="Không còn việc nào đang tồn."
      >
        {open.map(task => (
          <li key={task.id}>
            <TaskRow
              task={task}
              label={task.id}
              staleAfter={pace?.staleAfter}
              projects={projects}
              onToggle={onToggle}
              onRename={onRename}
              onStar={onStar}
              onDelete={onDelete}
              onMove={onMove}
            />
          </li>
        ))}
      </Section>

      <Section
        title="Đã xong"
        count={done.length}
        empty="Chưa có việc nào hoàn thành."
      >
        {done.map(task => (
          <li key={task.id}>
            <TaskRow
              task={task}
              label={task.id}
              staleAfter={pace?.staleAfter}
              projects={projects}
              onToggle={onToggle}
              onRename={onRename}
              onStar={onStar}
              onDelete={onDelete}
              onMove={onMove}
            />
          </li>
        ))}
      </Section>

      {editing && (
        <ProjectDialog
          project={project as Project}
          defaultCategory={project.category}
          fields={fields}
          existing={projects}
          onClose={() => setEditing(false)}
          onRequestDelete={() => setDeleting(true)}
        />
      )}

      {deleting && (
        <DeleteProjectDialog
          project={project as Project}
          onClose={() => setDeleting(false)}
          // The page it was on no longer exists, so go back to the tree.
          onDeleted={() => navigate("/du-an")}
        />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} ({count})
      </h2>
      {count === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}
