import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { suggestProjectCode } from "@/core/codes";
import {
  CATEGORY_LABEL,
  CODE_RE,
  CODE_RULE_TEXT,
  normaliseCode,
  type Category,
  type Field,
  type Project,
} from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";

const NO_FIELD = "__none__";

export interface ProjectDialogProps {
  project: Project | null;
  defaultCategory: Category;
  fields: Field[];
  existing: Project[];
  onClose: () => void;
}

/**
 * Asks for exactly what the app needs to file a project: a name, which field
 * it belongs to, and a code. The code drives every task id under it, so it is
 * suggested automatically but shown and editable before it is locked in.
 */
export function ProjectDialog({
  project,
  defaultCategory,
  fields,
  existing,
  onClose,
}: ProjectDialogProps) {
  const { tasks } = useStore();
  const editing = project !== null;
  const existingTaskCount = tasks.filter((t) => t.project === project?.code).length;
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [field, setField] = useState(project?.field ?? NO_FIELD);
  const [archived, setArchived] = useState(project?.archived ?? false);
  const [codeTouched, setCodeTouched] = useState(editing);

  const taken = existing.filter((p) => p.code !== project?.code).map((p) => p.code);
  const effectiveCode = codeTouched
    ? normaliseCode(code)
    : suggestProjectCode(name, taken);
  const codeChanged = editing && effectiveCode !== project.code;

  // A field owns the group, so the group is shown as a consequence of the
  // field rather than as a separate question the user could contradict.
  const owner = fields.find((f) => f.code === field);
  const category: Category = owner?.category ?? project?.category ?? defaultCategory;

  const codeError =
    effectiveCode && !CODE_RE.test(effectiveCode)
      ? CODE_RULE_TEXT
      : taken.includes(effectiveCode)
        ? "Mã này đã được dùng."
        : "";

  const submit = () => {
    if (!name.trim() || codeError || !effectiveCode) return;
    const fieldCode = field === NO_FIELD ? undefined : field;

    if (editing) {
      if (codeChanged) {
        const result = store.renameProjectCode(project.code, effectiveCode);
        if (!result.ok) {
          toast.error(result.reason ?? "Không đổi được mã");
          return;
        }
      }
      store.updateProject(codeChanged ? effectiveCode : project.code, {
        name: name.trim(),
        category,
        field: fieldCode,
        archived,
      });
      toast.success(
        codeChanged
          ? `Đã đổi mã ${project.code} → ${effectiveCode}`
          : `Đã cập nhật ${name.trim()}`
      );
    } else {
      store.createProject(name.trim(), effectiveCode, category, fieldCode);
      toast.success(`Đã tạo dự án ${name.trim()} · mã việc ${effectiveCode}-0001`);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa dự án" : "Dự án mới"}</DialogTitle>
          <DialogDescription>
            Mã dự án là tiền tố của mọi mã việc bên trong, ví dụ {effectiveCode || "ALP"}-0042.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Tên dự án</Label>
            <Input
              id="project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Alpha"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-field">Lĩnh vực</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger id="project-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FIELD}>Chưa gán — phân loại sau</SelectItem>
                {fields.map((f) => (
                  <SelectItem key={f.code} value={f.code}>
                    {f.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {CATEGORY_LABEL[f.category]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nhóm: <span className="font-medium">{CATEGORY_LABEL[category]}</span>
              {owner ? " (theo lĩnh vực đã chọn)" : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-code">Mã dự án</Label>
            <Input
              id="project-code"
              value={effectiveCode}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value);
              }}
              maxLength={8}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{CODE_RULE_TEXT}</p>
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            {codeChanged && !codeError && (
              <p className="rounded-lg border-l-4 border-l-amber-500 bg-amber-500/10 px-2.5 py-2 text-xs">
                Đổi mã sẽ đánh lại mã của{" "}
                <b>{existingTaskCount} việc</b> trong dự án này:{" "}
                <code className="font-mono">{project.code}-0001</code> →{" "}
                <code className="font-mono">{effectiveCode}-0001</code>. File trên GitHub
                cũng đổi tên theo.
              </p>
            )}
          </div>

          {editing && (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="project-archived" className="font-normal">
                  Lưu trữ
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ẩn khỏi ô thêm nhanh, việc cũ vẫn tra cứu được.
                </p>
              </div>
              <Switch id="project-archived" checked={archived} onCheckedChange={setArchived} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {/* A mistyped project used to be un-deletable and haunted the
              archive forever. Deleting is offered only while it holds no
              tasks, so real work can never disappear with it. */}
          {editing && existingTaskCount === 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                const result = store.deleteProject(project.code);
                if (!result.ok) {
                  toast.error(result.reason ?? "Không xoá được");
                  return;
                }
                toast.success(`Đã xoá dự án ${project.name}`);
                onClose();
              }}
              className="text-destructive hover:text-destructive sm:mr-auto"
            >
              Xoá dự án rỗng
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button onClick={submit} disabled={!name.trim() || Boolean(codeError)}>
              {editing ? "Lưu" : "Tạo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
