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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suggestProjectCode } from "@/core/codes";
import {
  CADENCE_OPTIONS,
  CATEGORIES,
  CATEGORY_LABEL,
  CODE_RE,
  CODE_RULE_TEXT,
  DEFAULT_CADENCE,
  cadenceOf,
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
  const [cadence, setCadence] = useState(() => cadenceOf(field ?? undefined));

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
        cadence,
      });
      toast.success(
        codeChanged
          ? `Đã đổi mã ${field.code} → ${effectiveCode}`
          : `Đã cập nhật dự án ${name.trim()}`
      );
    } else {
      store.createField(name.trim(), effectiveCode, category, cadence);
      toast.success(`Đã tạo dự án ${name.trim()}`);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa dự án" : "Dự án mới"}</DialogTitle>
          <DialogDescription>
            Một ngăn để gom các phân nhánh cùng loại — ví dụ 積算, 積算照査, Học
            tập. Không bắt buộc: phân nhánh không thuộc dự án nào vẫn dùng bình
            thường.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="field-name">Tên dự án</Label>
            <Input
              id="field-name"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="積算"
            />
          </div>

          {/* The one setting that stops the red badge becoming wallpaper.
              Asked here, at the level that already groups work moving at the
              same speed, so it is four or five answers for the whole app. */}
          <div className="space-y-1.5">
            <Label htmlFor="field-nhip">
              Nhịp — bao lâu im lặng thì báo đỏ
            </Label>
            <Select
              value={String(cadence)}
              onValueChange={v => setCadence(Number(v))}
            >
              <SelectTrigger id="field-nhip">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map(option => (
                  <SelectItem key={option.days} value={String(option.days)}>
                    {option.label}
                    {option.days === DEFAULT_CADENCE && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        mặc định
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {cadence === 0 ? (
                <>
                  Không có gì trong dự án này bị tô đỏ. Hợp với việc dài hơi —
                  học hành, viết phần mềm — nơi im vài tuần là chuyện bình
                  thường.
                </>
              ) : (
                <>
                  Phân nhánh nào còn việc mà quá <b>{cadence} ngày</b> không
                  động tới sẽ hiện dấu đỏ, và mọi việc bên trong cũng đổi màu
                  theo mốc này.
                </>
              )}
            </p>
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
                Các phân nhánh thuộc dự án này sẽ tự trỏ sang mã mới.
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
                Đổi phạm trù sẽ chuyển toàn bộ phân nhánh trong dự án này sang{" "}
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
