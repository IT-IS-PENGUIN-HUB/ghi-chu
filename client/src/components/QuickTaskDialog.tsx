import { useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
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
import { useComposition } from "@/hooks/useComposition";
import { type Project } from "@/core/model";
import { store } from "@/core/store";

export interface QuickTaskDialogProps {
  project: Project;
  onClose: () => void;
}

/**
 * Add tasks straight into one project, from the tree.
 *
 * The tree is where you look when you think in projects rather than in "what's
 * on today"; being able to drop a task into a project from there — without
 * first switching screens and picking the project back out of a list — is the
 * other half of the same "filing should be cheap" idea. Stays open after each
 * add so several tasks for the same công trình go in one after another.
 */
export function QuickTaskDialog({ project, onClose }: QuickTaskDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [added, setAdded] = useState(0);

  const add = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    store.addTask({
      title: trimmed,
      project: project.code,
      category: project.category,
    });
    setTitle("");
    setAdded(n => n + 1);
    inputRef.current?.focus();
  };

  const { isComposing: _c, ...handlers } = useComposition<HTMLInputElement>({
    onKeyDown: e => {
      if (e.key === "Enter") add();
    },
  });
  void _c;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm việc · {project.name}</DialogTitle>
          <DialogDescription>
            Gõ việc rồi bấm Enter. Thêm được nhiều việc liền nhau — xong thì bấm
            Đóng.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="quick-task-title">Nội dung việc</Label>
          <Input
            id="quick-task-title"
            ref={inputRef}
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            {...handlers}
            placeholder="Gõ việc cần làm…"
          />
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {added > 0 ? `Đã thêm ${added} việc vào dự án này` : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button onClick={add} disabled={!title.trim()} className="gap-1.5">
              <CornerDownLeft className="size-4" /> Thêm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
