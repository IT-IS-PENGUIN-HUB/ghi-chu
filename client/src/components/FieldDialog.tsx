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
import { CATEGORIES, CATEGORY_LABEL, type Category, type Field } from "@/core/model";
import { store } from "@/core/store";

export interface FieldDialogProps {
  field: Field | null;
  defaultCategory: Category;
  existing: Field[];
  onClose: () => void;
}

/** Create or rename a field — 分野A, 分野B, Cuộc sống, Học tập, anything next. */
export function FieldDialog({ field, defaultCategory, existing, onClose }: FieldDialogProps) {
  const editing = field !== null;
  const [name, setName] = useState(field?.name ?? "");
  const [code, setCode] = useState(field?.code ?? "");
  const [category, setCategory] = useState<Category>(field?.category ?? defaultCategory);
  const [codeTouched, setCodeTouched] = useState(editing);

  const taken = existing.filter((f) => f.code !== field?.code).map((f) => f.code);
  const effectiveCode = (codeTouched ? code : suggestProjectCode(name, taken)).toUpperCase();
  const codeError =
    effectiveCode && !/^[A-Z][A-Z0-9]{1,5}$/.test(effectiveCode)
      ? "Mã phải là 2–6 ký tự chữ in hoa hoặc số, bắt đầu bằng chữ."
      : taken.includes(effectiveCode)
        ? "Mã này đã được dùng."
        : "";

  const submit = () => {
    if (!name.trim() || codeError || !effectiveCode) return;
    if (editing) {
      store.updateField(field.code, { name: name.trim(), category });
      toast.success(`Đã cập nhật lĩnh vực ${name.trim()}`);
    } else {
      store.createField(name.trim(), effectiveCode, category);
      toast.success(`Đã tạo lĩnh vực ${name.trim()}`);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa lĩnh vực" : "Lĩnh vực mới"}</DialogTitle>
          <DialogDescription>
            Tầng giữa Nhóm và Dự án. Ví dụ: 分野A, 分野B, Cuộc sống, Học tập.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="field-name">Tên lĩnh vực</Label>
            <Input
              id="field-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="分野A"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-code">Mã</Label>
            <Input
              id="field-code"
              value={effectiveCode}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
              disabled={editing}
              maxLength={6}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {editing
                ? "Mã không đổi được — dự án đang tham chiếu tới nó."
                : codeError || "Tự gợi ý từ tên, sửa được."}
            </p>
            {codeError && !editing && <p className="text-xs text-destructive">{codeError}</p>}
          </div>

          <div className="space-y-2">
            <Label>Thuộc nhóm</Label>
            <RadioGroup
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
              className="flex gap-4"
            >
              {CATEGORIES.map((c) => (
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
                Đổi nhóm sẽ chuyển toàn bộ dự án trong lĩnh vực này sang{" "}
                {CATEGORY_LABEL[category]}.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!name.trim() || Boolean(codeError)}>
            {editing ? "Lưu" : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
