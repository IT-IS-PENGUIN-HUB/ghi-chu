import { useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Layers, Plus, Star } from "lucide-react";
import { DuplicateHint } from "@/components/DuplicateHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickFieldDialog } from "@/components/QuickFieldDialog";
import { QuickProjectDialog } from "@/components/QuickProjectDialog";
import { useComposition } from "@/hooks/useComposition";
import { findDuplicateTask } from "@/core/duplicates";
import { extractTags } from "@/core/markdown";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  type Field,
  type Project,
} from "@/core/model";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

const LAST_PROJECT_KEY = "quickadd-last-project";
/** Sentinels for the "create…" rows and the no-field bucket inside the pickers. */
const NEW_PROJECT = "__new_project__";
const NEW_FIELD = "__new_field__";
const UNFILED = "__unfiled__";

export interface QuickAddProps {
  projects: Project[];
  fields: Field[];
  /** "ALL" when the Today screen is showing both categories at once. */
  category: Category | "ALL";
  onAdd: (input: { title: string; project: string; starred: boolean }) => void;
}

/**
 * The primary action of the whole app, so it is styled as one: a titled panel
 * with a filled button that says "Thêm", not a bare input with a plus icon.
 *
 * Filing is a two-step cascade — Dự án, then Phân nhánh filtered to that dự án —
 * because one flat list of every project across every dự án was hard to read
 * once there were more than a handful. Each picker can grow its own list on the
 * spot ("＋ Tạo … mới"), so nothing here ever sends you to another screen to
 * set up structure first.
 */
export function QuickAdd({ projects, fields, category, onAdd }: QuickAddProps) {
  const { tasks } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [starred, setStarred] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingField, setCreatingField] = useState(false);

  // In "ALL" mode there is no category from the toggle, so the box asks for
  // one (Phạm trù) as the first step of the cascade.
  const [pickedCategory, setPickedCategory] = useState<Category>("WRK");
  const activeCategory: Category =
    category === "ALL" ? pickedCategory : category;

  const available = useMemo(
    () => projects.filter(p => !p.archived && p.category === activeCategory),
    [projects, activeCategory]
  );
  const fieldsInCat = useMemo(
    () =>
      fields
        .filter(f => f.category === activeCategory)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [fields, activeCategory]
  );
  const known = useMemo(
    () => new Set(fieldsInCat.map(f => f.code)),
    [fieldsInCat]
  );
  const fieldOf = (p: Project) =>
    p.field && known.has(p.field) ? p.field : UNFILED;

  const [field, setField] = useState<string>(() => {
    const last =
      localStorage.getItem(`${LAST_PROJECT_KEY}-${activeCategory}`) ?? "";
    const lp = projects.find(
      p => !p.archived && p.code === last && p.category === activeCategory
    );
    if (lp)
      return lp.field && fields.some(f => f.code === lp.field)
        ? lp.field
        : UNFILED;
    const first = fields
      .filter(f => f.category === activeCategory)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))[0];
    return first?.code ?? UNFILED;
  });
  const [project, setProject] = useState<string>(
    () => localStorage.getItem(`${LAST_PROJECT_KEY}-${activeCategory}`) ?? ""
  );

  // Switching category (via the toggle, or the Phạm trù picker in ALL mode)
  // re-seeds both pickers from that category's last-used project.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const last =
      localStorage.getItem(`${LAST_PROJECT_KEY}-${activeCategory}`) ?? "";
    const lp = available.find(p => p.code === last);
    setField(lp ? fieldOf(lp) : (fieldsInCat[0]?.code ?? UNFILED));
    setProject(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const effectiveField =
    field === UNFILED || known.has(field) ? field : UNFILED;
  const projectsInField = useMemo(
    () => available.filter(p => fieldOf(p) === effectiveField),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [available, effectiveField, known]
  );
  const effectiveProject =
    projectsInField.find(p => p.code === project)?.code ??
    projectsInField[0]?.code ??
    "";

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || !effectiveProject) return;
    onAdd({ title: trimmed, project: effectiveProject, starred });
    setTitle("");
    setStarred(false);
    localStorage.setItem(
      `${LAST_PROJECT_KEY}-${activeCategory}`,
      effectiveProject
    );
    inputRef.current?.focus();
  };

  const { isComposing: _isComposing, ...compositionHandlers } =
    useComposition<HTMLInputElement>({
      onKeyDown: e => {
        if (e.key === "Enter") submit();
      },
    });
  void _isComposing;

  const onFieldChange = (value: string) => {
    if (value === NEW_FIELD) {
      setCreatingField(true);
      return;
    }
    setField(value);
    setProject(""); // fall to the first project of the newly chosen dự án
  };

  const onProjectChange = (value: string) => {
    if (value === NEW_PROJECT) {
      setCreatingProject(true);
      return;
    }
    setProject(value);
  };

  const onFieldCreated = (code: string) => {
    setField(code);
    setProject("");
    setCreatingField(false);
    // A brand-new dự án has no projects yet, so send the user straight on to
    // making the first one.
    setCreatingProject(true);
  };

  const onProjectCreated = (code: string) => {
    setProject(code);
    localStorage.setItem(`${LAST_PROJECT_KEY}-${activeCategory}`, code);
    setCreatingProject(false);
    inputRef.current?.focus();
  };

  const preview = extractTags(title);
  // Checked live rather than on submit: seeing it before pressing Enter is
  // the difference between a warning and a complaint.
  const duplicate = useMemo(
    () =>
      effectiveProject
        ? findDuplicateTask(tasks, preview.title, effectiveProject)
        : null,
    [tasks, preview.title, effectiveProject]
  );
  const takenCodes = useMemo(
    () => [...projects.map(p => p.code), ...fields.map(f => f.code)],
    [projects, fields]
  );
  const activeFieldName = fieldsInCat.find(
    f => f.code === effectiveField
  )?.name;

  return (
    <section
      className={cn(
        "rounded-2xl border-2 p-3 shadow-sm transition-colors",
        activeCategory === "WRK"
          ? "border-wrk/35 bg-wrk-soft/40"
          : "border-per/35 bg-per-soft/40"
      )}
    >
      {/* No heading: "Gõ việc cần làm rồi bấm Enter…" in the box says it
          better than a title above the box, and the coloured frame plus the
          coloured Thêm button already mark what this is. That row was 45px —
          one whole task row, spent on a label nobody needed to read twice. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="quick-add-input"
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          {...compositionHandlers}
          placeholder="Gõ việc cần làm rồi bấm Enter…"
          aria-label="Nội dung công việc mới"
          className="h-10 flex-1 border-2 bg-background text-base shadow-none focus-visible:ring-2"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
        />
        <Button
          onClick={submit}
          disabled={!title.trim() || !effectiveProject}
          size="lg"
          className={cn(
            "h-10 gap-1.5 px-4 text-sm font-semibold text-white shadow-sm",
            activeCategory === "WRK"
              ? "bg-wrk hover:bg-wrk/90"
              : "bg-per hover:bg-per/90"
          )}
        >
          <Plus className="size-4 stroke-[2.5]" />
          Thêm
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* Phạm trù — only in ALL mode; otherwise the toggle already fixed it. */}
        {category === "ALL" && (
          <>
            <span className="text-xs text-muted-foreground">Phạm trù</span>
            <Select
              value={activeCategory}
              onValueChange={v => setPickedCategory(v as Category)}
            >
              <SelectTrigger
                className="h-8 w-auto min-w-[7rem] gap-1.5 border-2 bg-background text-sm"
                aria-label="Chọn phạm trù cho việc mới"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <span className="text-xs text-muted-foreground">Dự án</span>
        <Select value={effectiveField} onValueChange={onFieldChange}>
          <SelectTrigger
            className="h-8 w-auto min-w-[8rem] max-w-[12rem] gap-1.5 border-2 bg-background text-sm"
            aria-label="Chọn dự án cho việc mới"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem
              value={NEW_FIELD}
              className="font-medium text-primary [&_svg]:text-primary"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="size-4" />
                Tạo dự án mới…
              </span>
            </SelectItem>
            <SelectSeparator />
            {fieldsInCat.map(f => (
              <SelectItem key={f.code} value={f.code}>
                {f.name}
              </SelectItem>
            ))}
            <SelectItem value={UNFILED}>Chưa xếp vào dự án</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">Phân nhánh</span>
        <Select value={effectiveProject} onValueChange={onProjectChange}>
          <SelectTrigger
            className="h-8 w-auto min-w-[9rem] max-w-[14rem] gap-1.5 border-2 bg-background text-sm"
            aria-label="Chọn phân nhánh cho việc mới"
          >
            <SelectValue placeholder="Chọn phân nhánh" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem
              value={NEW_PROJECT}
              className="font-medium text-primary [&_svg]:text-primary"
            >
              <span className="flex items-center gap-1.5">
                <FolderPlus className="size-4" />
                Tạo phân nhánh mới…
              </span>
            </SelectItem>
            <SelectSeparator />
            {projectsInField.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Dự án này chưa có phân nhánh — bấm “Tạo phân nhánh mới”.
              </p>
            ) : (
              projectsInField.map(p => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setStarred(s => !s)}
          aria-pressed={starred}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border-2 px-2.5 text-sm transition-colors",
            starred
              ? "border-amber-400 bg-amber-400/15 font-medium text-amber-700 dark:text-amber-300"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className={cn("size-4", starred && "fill-current")} />
          Ưu tiên
        </button>
      </div>

      {duplicate && (
        <DuplicateHint
          hit={duplicate}
          projectName={
            projects.find(p => p.code === duplicate.task.project)?.name
          }
        />
      )}

      {preview.tags.length > 0 && (
        <p
          className={cn(
            "mt-2 text-xs",
            activeCategory === "WRK" ? "text-wrk" : "text-per"
          )}
        >
          Sẽ gắn nhãn: {preview.tags.map(t => `#${t}`).join(" ")}
        </p>
      )}

      {creatingProject && (
        <QuickProjectDialog
          category={activeCategory}
          field={effectiveField === UNFILED ? undefined : effectiveField}
          fieldName={activeFieldName}
          takenCodes={takenCodes}
          onClose={() => setCreatingProject(false)}
          onCreated={onProjectCreated}
        />
      )}

      {creatingField && (
        <QuickFieldDialog
          category={activeCategory}
          takenCodes={takenCodes}
          onClose={() => setCreatingField(false)}
          onCreated={onFieldCreated}
        />
      )}
    </section>
  );
}
