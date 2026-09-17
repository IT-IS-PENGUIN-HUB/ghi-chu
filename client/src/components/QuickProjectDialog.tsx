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

export interface QuickProjectDialogProps {
  category: Category;
  /** Field (Dự án) to file the new project under, if one is chosen. */
  field?: string;
  /** Display name of that field, for the dialog subtitle. */
  fieldName?: string;
  /**
   * Every code already in use — project codes and field codes both — so the
   * auto-generated code steps over all of them and two different things never
   * end up sharing one code.
   */
  takenCodes: string[];
  onClose: () => void;
  onCreated: (code: string) => void;
}

/**
 * Create a project without leaving the "add task" box.
 *
 * The full ProjectDialog asks for a code, a field and an archive toggle up
 * front, which is exactly the wall that made classifying feel like homework.
 * Here the only question is the name — the code is derived and can be changed
 * later, and the field is left for the tree on the Projects screen. This is
 * the whole point: filing a task under a new công trình should cost one line
 * of typing, not a detour to another screen.
 */
export function QuickProjectDialog({
  category,
  field,
  fieldName,
  takenCodes,
  onClose,
  onCreated,
}: QuickProjectDialogProps) {
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const code = suggestProjectCode(trimmed, takenCodes);
    store.createProject(trimmed, code, category, field);
    toast.success(`Đã tạo phân nhánh ${trimmed}`);
    onCreated(code);
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Phân nhánh mới
            {fieldName
              ? ` · dự án ${fieldName}`
              : ` · ${CATEGORY_LABEL[category]}`}
          </DialogTitle>
          <DialogDescription>
            Mỗi công trình, cầu hoặc khách hàng là một phân nhánh. Chỉ cần đặt
            tên — mã tự tạo, xếp vào dự án để sau cũng được.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="quick-project-name">Tên phân nhánh</Label>
          <Input
            id="quick-project-name"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder="Cầu Shinkotobuki"
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
