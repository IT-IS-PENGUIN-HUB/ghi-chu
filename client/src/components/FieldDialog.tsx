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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { suggestProjectCode } from "@/core/codes";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CODE_RE,
  CODE_RULE_TEXT,
  normaliseCode,
  type Category,
  type Field,
} from "@/core/model";
import { store } from "@/core/store";

export interface FieldDialogProps {
  field: Field | null;
  defaultCategory: Category;
  existing: Field[];
  onClose: () => void;
}

/** Create or rename a field — 分野A, 分野B, Cuộc sống, Học tập, anything next. */
export function FieldDialog({
  field,
  defaultCategory,
  existing,
  onClose,
}: FieldDialogProps) {
  const editing = field !== null;
  const [name, setName] = useState(field?.name ?? "");
  const [code, setCode] = useState(field?.code ?? "");
  const [category, setCategory] = useState<Category>(
    field?.category ?? defaultCategory
  );
  const [codeTouched, setCodeTouched] = useState(editing);

  const taken = existing.filter(f => f.code !== field?.code).map(f => f.code);
  const effectiveCode = codeTouched
    ? normaliseCode(code)
    : suggestProjectCode(name, taken);
  const codeChanged = editing && effectiveCode !== field.code;
  const codeError =
    effectiveCode && !CODE_RE.test(effectiveCode)
      ? CODE_RULE_TEXT
      : taken.includes(effectiveCode)
        ? "Mã này đã được dùng."
        : "";

  const submit = () => {
    if (!name.trim() || codeError || !effectiveCode) return;
    if (editing) {
      if (codeChanged) {
        const result = store.renameFieldCode(field.code, effectiveCode);
        if (!result.ok) {
          toast.error(result.reason ?? "Không đổi được mã");
          return;
        }
      }
      store.updateField(codeChanged ? effectiveCode : field.code, {
        name: name.trim(),
        category,
      });
      toast.success(
        codeChanged
          ? `Đã đổi mã ${field.code} → ${effectiveCode}`
          : `Đã cập nhật nhóm ${name.trim()}`
      );
    } else {
      store.createField(name.trim(), effectiveCode, category);
      toast.success(`Đã tạo nhóm ${name.trim()}`);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa nhóm" : "Nhóm mới"}</DialogTitle>
          <DialogDescription>
            Một ngăn để gom các dự án cùng loại — ví dụ 積算, 積算照査, Học tập.
            Không bắt buộc: dự án không thuộc nhóm nào vẫn dùng bình thường.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="field-name">Tên nhóm</Label>
            <Input
              id="field-name"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="積算"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-code">Mã</Label>
            <Input
              id="field-code"
              value={effectiveCode}
              onChange={e => {
                setCodeTouched(true);
                setCode(e.target.value);
              }}
              maxLength={8}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{CODE_RULE_TEXT}</p>
            {codeError && (
              <p className="text-xs text-destructive">{codeError}</p>
            )}
            {codeChanged && !codeError && (
              <p className="text-xs text-muted-foreground">
                Các dự án thuộc nhóm này sẽ tự trỏ sang mã mới.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Thuộc phạm trù</Label>
            <RadioGroup
              value={category}
              onValueChange={v => setCategory(v as Category)}
              className="flex gap-4"
            >
              {CATEGORIES.map(c => (
                <div key={c} className="flex items-center gap-2">
                  <RadioGroupItem value={c} id={`field-cat-${c}`} />
                  <Label htmlFor={`field-cat-${c}`} className="font-normal">
                    {CATEGORY_LABEL[c]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {editing && category !== field.category && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Đổi phạm trù sẽ chuyển toàn bộ dự án trong nhóm này sang{" "}
                {CATEGORY_LABEL[category]}.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={submit}
            disabled={!name.trim() || Boolean(codeError)}
          >
            {editing ? "Lưu" : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
