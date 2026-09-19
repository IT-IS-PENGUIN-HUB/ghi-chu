import { useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { DuplicateHint } from "@/components/DuplicateHint";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useComposition } from "@/hooks/useComposition";
import { findDuplicateTask } from "@/core/duplicates";
import { CATEGORIES, CATEGORY_LABEL, type Project } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";

const LAST_TARGET_KEY = "quick-task-last-project";

export interface QuickTaskDialogProps {
  /**
   * Where the task goes. `null` means "ask" — the screen-level "Thêm việc
   * mới" button has no row to start from, so the dialog carries the picker.
   */
  project: Project | null;
  onClose: () => void;
}

/**
 * Add tasks straight into one phân nhánh, from the tree.
 *
 * The tree is where you look when you think in phân nhánh rather than in
 * "what's on today"; being able to drop a task into one from there — without
 * first switching screens and picking it back out of a list — is the other
 * half of the same "filing should be cheap" idea. Stays open after each add so
 * several tasks for the same công trình go in one after another.
 */
export function QuickTaskDialog({ project, onClose }: QuickTaskDialogProps) {
  const { projects, fields, tasks } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [added, setAdded] = useState(0);
  const [picked, setPicked] = useState(
    () => project?.code ?? localStorage.getItem(LAST_TARGET_KEY) ?? ""
  );

  /**
   * The whole tree flattened into one grouped list: phạm trù · dự án as the
   * heading, phân nhánh as the choices. One question instead of a two-step
   * cascade, and the heading shows where a phân nhánh sits, which is the part
   * that would otherwise need asking separately.
   */
  const groups = useMemo(() => {
    const live = projects.filter(p => !p.archived);
    const out: Array<{ key: string; label: string; items: Project[] }> = [];
    for (const category of CATEGORIES) {
      const known = fields
        .filter(f => f.category === category)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      for (const field of known) {
        const items = live.filter(p => p.field === field.code);
        if (items.length) {
          out.push({
            key: field.code,
            label: `${CATEGORY_LABEL[category]} · ${field.name}`,
            items,
          });
        }
      }
      const codes = new Set(known.map(f => f.code));
      const unfiled = live.filter(
        p => p.category === category && (!p.field || !codes.has(p.field))
      );
      if (unfiled.length) {
        out.push({
          key: `unfiled:${category}`,
          label: `${CATEGORY_LABEL[category]} · Chưa xếp vào dự án`,
          items: unfiled,
        });
      }
    }
    return out;
  }, [projects, fields]);

  const choices = groups.flatMap(g => g.items);
  const target =
    project ?? choices.find(p => p.code === picked) ?? choices[0] ?? null;

  const duplicate = useMemo(
    () => (target ? findDuplicateTask(tasks, title, target.code) : null),
    [tasks, title, target]
  );

  const add = () => {
    const trimmed = title.trim();
    if (!trimmed || !target) return;
    store.addTask({
      title: trimmed,
      project: target.code,
      category: target.category,
    });
    if (!project) localStorage.setItem(LAST_TARGET_KEY, target.code);
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
          <DialogTitle>
            {project ? `Thêm việc · ${project.name}` : "Thêm việc mới"}
          </DialogTitle>
          <DialogDescription>
            {project
              ? "Gõ việc rồi bấm Enter. Thêm được nhiều việc liền nhau — xong thì bấm Đóng."
              : "Chọn phân nhánh để cất việc, gõ nội dung rồi bấm Enter. Thêm được nhiều việc liền nhau."}
          </DialogDescription>
        </DialogHeader>

        {!project && (
          <div className="space-y-1.5">
            <Label htmlFor="quick-task-target">Cất vào phân nhánh</Label>
            {choices.length === 0 ? (
              <p className="rounded-lg border-l-4 border-l-amber-500 bg-amber-500/10 px-2.5 py-2 text-xs">
                Chưa có phân nhánh nào để cất việc. Bấm <b>Phân nhánh mới</b> ở
                trên rồi quay lại.
              </p>
            ) : (
              <Select
                value={target?.code ?? ""}
                onValueChange={code => setPicked(code)}
              >
                <SelectTrigger id="quick-task-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {groups.map(group => (
                    <SelectGroup key={group.key}>
                      <SelectLabel className="text-muted-foreground">
                        {group.label}
                      </SelectLabel>
                      {group.items.map(p => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {p.code}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

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

        {duplicate && <DuplicateHint hit={duplicate} />}

        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {added > 0
              ? project
                ? `Đã thêm ${added} việc vào phân nhánh này`
                : `Đã thêm ${added} việc`
              : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button
              onClick={add}
              disabled={!title.trim() || !target}
              className="gap-1.5"
            >
              <CornerDownLeft className="size-4" /> Thêm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
