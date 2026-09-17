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
import { suggestProjectCode } from "@/core/codes";
import { CATEGORY_LABEL, type Category } from "@/core/model";
import { store } from "@/core/store";

export interface QuickFieldDialogProps {
  category: Category;
  /** Every code already in use (projects + fields) so the new code is unique. */
  takenCodes: string[];
  onClose: () => void;
  onCreated: (code: string) => void;
}

/**
 * Create a "Dự án" (a field — the layer that gathers projects of one kind)
 * without leaving the add box. Name only; the code is derived. Sibling of
 * QuickProjectDialog so the two cascading pickers can both grow their own list
 * inline instead of sending the user to the Dự án screen.
 */
export function QuickFieldDialog({
  category,
  takenCodes,
  onClose,
  onCreated,
}: QuickFieldDialogProps) {
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const code = suggestProjectCode(trimmed, takenCodes);
    store.createField(trimmed, code, category);
    toast.success(`Đã tạo dự án ${trimmed}`);
    onCreated(code);
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dự án mới · {CATEGORY_LABEL[category]}</DialogTitle>
          <DialogDescription>
            Dự án gom các phân nhánh cùng loại — ví dụ 積算, 積算照査. Chỉ cần
            đặt tên, mã tự tạo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="quick-field-name">Tên dự án</Label>
          <Input
            id="quick-field-name"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder="積算"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={create} disabled={!name.trim()}>
            Tạo và chọn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
