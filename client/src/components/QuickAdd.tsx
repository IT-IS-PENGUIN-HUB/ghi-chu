import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FolderPlus, Layers, Plus, Star } from "lucide-react";
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
import { extractTags } from "@/core/markdown";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  type Field,
  type Project,
} from "@/core/model";
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
 * Filing is a two-step cascade — Nhóm, then Dự án filtered to that nhóm —
 * because one flat list of every project across every nhóm was hard to read
 * once there were more than a handful. Each picker can grow its own list on the
 * spot ("＋ Tạo … mới"), so nothing here ever sends you to another screen to
 * set up structure first.
 */
export function QuickAdd({ projects, fields, category, onAdd }: QuickAddProps) {
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
    setProject(""); // fall to the first project of the newly chosen nhóm
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
    // A brand-new nhóm has no projects yet, so send the user straight on to
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
        "rounded-2xl border-2 p-4 shadow-sm transition-colors",
        activeCategory === "WRK"
          ? "border-wrk/35 bg-wrk-soft/40"
          : "border-per/35 bg-per-soft/40"
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-white",
            activeCategory === "WRK" ? "bg-wrk" : "bg-per"
          )}
        >
          <Plus className="size-4 stroke-[3]" />
        </span>
        <h2 className="text-base font-semibold">Thêm việc mới</h2>
        {category !== "ALL" && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              activeCategory === "WRK"
                ? "bg-wrk/15 text-wrk"
                : "bg-per/15 text-per"
            )}
          >
            {CATEGORY_LABEL[activeCategory]}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="quick-add-input"
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          {...compositionHandlers}
          placeholder="Gõ việc cần làm rồi bấm Enter…"
          aria-label="Nội dung công việc mới"
          className="h-12 flex-1 border-2 bg-background text-base shadow-none focus-visible:ring-2"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
        />
        <Button
          onClick={submit}
          disabled={!title.trim() || !effectiveProject}
          size="lg"
          className={cn(
            "h-12 gap-2 px-6 text-base font-semibold text-white shadow-sm",
            activeCategory === "WRK"
              ? "bg-wrk hover:bg-wrk/90"
              : "bg-per hover:bg-per/90"
          )}
        >
          <Plus className="size-5 stroke-[2.5]" />
          Thêm
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
        {/* Phạm trù — only in ALL mode; otherwise the toggle already fixed it. */}
        {category === "ALL" && (
          <>
            <span className="text-xs text-muted-foreground">Phạm trù</span>
            <Select
              value={activeCategory}
              onValueChange={v => setPickedCategory(v as Category)}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-[8rem] gap-1.5 border-2 bg-background text-sm"
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

        <span className="text-xs text-muted-foreground">Nhóm</span>
        <Select value={effectiveField} onValueChange={onFieldChange}>
          <SelectTrigger
            className="h-9 w-auto min-w-[9rem] max-w-[13rem] gap-1.5 border-2 bg-background text-sm"
            aria-label="Chọn nhóm cho việc mới"
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
                Tạo nhóm mới…
              </span>
            </SelectItem>
            <SelectSeparator />
            {fieldsInCat.map(f => (
              <SelectItem key={f.code} value={f.code}>
                {f.name}
              </SelectItem>
            ))}
            <SelectItem value={UNFILED}>Chưa xếp vào nhóm</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">Dự án</span>
        <Select value={effectiveProject} onValueChange={onProjectChange}>
          <SelectTrigger
            className="h-9 w-auto min-w-[10rem] max-w-[15rem] gap-1.5 border-2 bg-background text-sm"
            aria-label="Chọn dự án cho việc mới"
          >
            <SelectValue placeholder="Chọn dự án" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem
              value={NEW_PROJECT}
              className="font-medium text-primary [&_svg]:text-primary"
            >
              <span className="flex items-center gap-1.5">
                <FolderPlus className="size-4" />
                Tạo dự án mới…
              </span>
            </SelectItem>
            <SelectSeparator />
            {projectsInField.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Nhóm này chưa có dự án — bấm “Tạo dự án mới”.
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
            "flex h-9 items-center gap-1.5 rounded-lg border-2 px-3 text-sm transition-colors",
            starred
              ? "border-amber-400 bg-amber-400/15 font-medium text-amber-700 dark:text-amber-300"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          <Star className={cn("size-4", starred && "fill-current")} />
          Ưu tiên
        </button>

        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <CornerDownLeft className="size-3.5" />
          Enter để thêm nhanh
        </span>
      </div>

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
