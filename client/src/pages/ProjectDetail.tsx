import { useCallback, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Pencil } from "lucide-react";
import { ProjectDialog } from "@/components/ProjectDialog";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABEL, type Project } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";

/**
 * The long-term archive for one project — the "thư mục công việc" a permanent
 * id belongs to. Mirrors data/tasks/<CODE>.md: open work above, finished below.
 */
export default function ProjectDetail() {
  const [, params] = useRoute("/du-an/:code");
  const { projects, fields, tasks } = useStore();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);

  const code = params?.code?.toUpperCase() ?? "";
  const project = projects.find((p) => p.code === code);

  const mine = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks
      .filter((t) => t.project === code)
      .filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle));
  }, [tasks, code, query]);

  const open = useMemo(
    () => mine.filter((t) => !t.done).sort((a, b) => a.created.localeCompare(b.created)),
    [mine]
  );
  const done = useMemo(
    () =>
      mine
        .filter((t) => t.done)
        .sort((a, b) => (b.completed ?? b.created).localeCompare(a.completed ?? a.created)),
    [mine]
  );

  const onToggle = useCallback((id: string) => store.toggleTask(id), []);
  const onRename = useCallback((id: string, title: string) => store.updateTask(id, { title }), []);
  const onStar = useCallback((id: string, starred: boolean) => store.updateTask(id, { starred }), []);
  const onDelete = useCallback((id: string) => store.deleteTask(id), []);
  const onMove = useCallback((id: string, target: string) => store.moveTask(id, target), []);

  if (!project) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Không tìm thấy dự án {code}.</p>
        <Button variant="link" asChild>
          <Link href="/du-an">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

  const field = fields.find((f) => f.code === project.field);

  return (
    <div className="space-y-5">
      <Link
        href="/du-an"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dự án
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="font-mono">{project.code}</span>
            <span>·</span>
            <span>{CATEGORY_LABEL[project.category]}</span>
            <span>·</span>
            <span>{field?.name ?? "Chưa gán lĩnh vực"}</span>
            <span>·</span>
            <span>mã tiếp theo {project.code}-{String(project.next).padStart(4, "0")}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Sửa dự án"
          className="tap flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </header>

      {mine.length > 6 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Lọc trong ${project.name}…`}
          aria-label="Lọc công việc trong dự án"
          className="h-10"
        />
      )}

      <Section title="Đang tồn" count={open.length} empty="Không còn việc nào đang tồn.">
        {open.map((task) => (
          <li key={task.id}>
            <TaskRow
              task={task}
              label={task.id}
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

      <Section title="Đã xong" count={done.length} empty="Chưa có việc nào hoàn thành.">
        {done.map((task) => (
          <li key={task.id}>
            <TaskRow
              task={task}
              label={task.id}
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
