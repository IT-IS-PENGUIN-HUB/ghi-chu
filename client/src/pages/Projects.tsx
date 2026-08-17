import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, FolderPlus, Layers, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldDialog } from "@/components/FieldDialog";
import { ProjectDialog } from "@/components/ProjectDialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, CATEGORY_LABEL, type Category, type Field, type Project } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

/**
 * Category -> field -> project. Unassigned projects get their own section
 * rather than being hidden, so filing them stays a visible, one-tap job.
 */
export default function Projects() {
  const { fields, projects, tasks } = useStore();
  const [category, setCategory] = useState<Category>("WRK");
  const [editingField, setEditingField] = useState<Field | null | "new">(null);
  const [editingProject, setEditingProject] = useState<Project | null | "new">(null);
  const [deletingField, setDeletingField] = useState<Field | null>(null);

  const openCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.done) continue;
      counts.set(t.project, (counts.get(t.project) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const visibleFields = fields.filter((f) => f.category === category);
  const inCategory = projects.filter((p) => p.category === category && !p.archived);
  const unassigned = inCategory.filter((p) => !p.field);
  const archived = projects.filter((p) => p.category === category && p.archived);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dự án</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Nhóm → Lĩnh vực → Dự án. Thêm, sửa, xoá lĩnh vực tuỳ ý.
          </p>
        </div>
      </header>

      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="grid w-full grid-cols-2">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditingField("new")} className="gap-1.5">
          <Layers className="size-4" /> Lĩnh vực mới
        </Button>
        <Button size="sm" onClick={() => setEditingProject("new")} className="gap-1.5">
          <FolderPlus className="size-4" /> Dự án mới
        </Button>
      </div>

      {unassigned.length > 0 && (
        <section className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-700/40 dark:bg-amber-950/20">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
            <TriangleAlert className="size-4" />
            {unassigned.length} dự án chưa gán lĩnh vực
          </div>
          <ul className="space-y-1.5">
            {unassigned.map((p) => (
              <ProjectItem
                key={p.code}
                project={p}
                count={openCount.get(p.code) ?? 0}
                onEdit={() => setEditingProject(p)}
              />
            ))}
          </ul>
        </section>
      )}

      {visibleFields.map((field) => {
        const list = inCategory.filter((p) => p.field === field.code);
        return (
          <section key={field.code} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{field.name}</h2>
              <span className="font-mono text-xs text-muted-foreground">{field.code}</span>
              <span className="text-xs text-muted-foreground">· {list.length} dự án</span>
              <div className="ml-auto flex gap-0.5">
                <button
                  type="button"
                  onClick={() => setEditingField(field)}
                  aria-label={`Sửa lĩnh vực ${field.name}`}
                  className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingField(field)}
                  aria-label={`Xoá lĩnh vực ${field.name}`}
                  className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {list.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                Chưa có dự án nào trong lĩnh vực này.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((p) => (
                  <ProjectItem
                    key={p.code}
                    project={p}
                    count={openCount.get(p.code) ?? 0}
                    onEdit={() => setEditingProject(p)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {visibleFields.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <Layers className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Chưa có lĩnh vực nào cho {CATEGORY_LABEL[category].toLowerCase()}.
          </p>
          <Button variant="link" size="sm" onClick={() => setEditingField("new")}>
            <Plus className="mr-1 size-3.5" /> Tạo lĩnh vực đầu tiên
          </Button>
        </div>
      )}

      {archived.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-medium text-muted-foreground">Đã lưu trữ</h2>
          <ul className="space-y-1.5">
            {archived.map((p) => (
              <ProjectItem
                key={p.code}
                project={p}
                count={openCount.get(p.code) ?? 0}
                onEdit={() => setEditingProject(p)}
                muted
              />
            ))}
          </ul>
        </section>
      )}

      {editingField !== null && (
        <FieldDialog
          field={editingField === "new" ? null : editingField}
          defaultCategory={category}
          existing={fields}
          onClose={() => setEditingField(null)}
        />
      )}

      {editingProject !== null && (
        <ProjectDialog
          project={editingProject === "new" ? null : editingProject}
          defaultCategory={category}
          fields={fields}
          existing={projects}
          onClose={() => setEditingProject(null)}
        />
      )}

      <AlertDialog open={deletingField !== null} onOpenChange={(o) => !o && setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá lĩnh vực "{deletingField?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Các dự án trong lĩnh vực này sẽ chuyển sang mục "chưa gán lĩnh vực".
              Không có công việc nào bị xoá.
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

function ProjectItem({
  project,
  count,
  onEdit,
  muted,
}: {
  project: Project;
  count: number;
  onEdit: () => void;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center gap-1">
      <Link
        href={`/du-an/${project.code}`}
        className={cn(
          "flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-foreground/20",
          muted && "opacity-60"
        )}
      >
        <span className="font-mono text-xs text-muted-foreground">{project.code}</span>
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {count > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Sửa dự án ${project.name}`}
        className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
    </li>
  );
}
