import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { describeRule, nextRuleId, WEEKDAY_LABELS } from "@/core/recurring";
import { type RecurrenceKind, type RecurringRule } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<RecurrenceKind, string> = {
  daily: "Hằng ngày",
  weekdays: "Theo thứ trong tuần",
  weekly: "Mỗi 7 ngày",
};

export function RecurringRules() {
  const { recurring, projects } = useStore();
  const [adding, setAdding] = useState(false);

  const projectName = new Map(projects.map((p) => [p.code, p.name]));

  return (
    <div className="space-y-2">
      {recurring.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Chưa có việc lặp lại nào. Ví dụ: "Nộp báo cáo ngày" mỗi thứ Sáu.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {recurring.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{rule.title}</div>
                <div className="text-xs text-muted-foreground">
                  {describeRule(rule)} · {projectName.get(rule.project) ?? rule.project}
                  {rule.lastRun && ` · lần cuối ${rule.lastRun}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => store.setRecurring(recurring.filter((r) => r.id !== rule.id))}
                aria-label={`Xoá quy tắc ${rule.title}`}
                className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <Plus className="mr-1.5 size-4" /> Thêm quy tắc
      </Button>

      {adding && (
        <RuleDialog
          onSave={(rule) => {
            store.setRecurring([...recurring, rule]);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function RuleDialog({
  onSave,
  onClose,
}: {
  onSave: (rule: RecurringRule) => void;
  onClose: () => void;
}) {
  const { recurring, projects } = useStore();
  const available = projects.filter((p) => !p.archived);

  const [title, setTitle] = useState("");
  const [project, setProject] = useState(available[0]?.code ?? "ETC");
  const [kind, setKind] = useState<RecurrenceKind>("weekdays");
  const [days, setDays] = useState<number[]>([5]);

  const submit = () => {
    if (!title.trim()) return;
    const owner = available.find((p) => p.code === project);
    onSave({
      id: nextRuleId(recurring),
      title: title.trim(),
      project,
      category: owner?.category ?? "WRK",
      kind,
      days: kind === "weekdays" ? days : [],
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Việc lặp lại</DialogTitle>
          <DialogDescription>
            Việc sẽ tự xuất hiện trong danh sách khi đến hạn, và không nhân đôi nếu
            việc cũ chưa xong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-title">Nội dung</Label>
            <Input
              id="rule-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Nộp báo cáo ngày"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-project">Dự án</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger id="rule-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {available.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-kind">Lặp lại</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RecurrenceKind)}>
              <SelectTrigger id="rule-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as RecurrenceKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === "weekdays" && (
            <div className="space-y-1.5">
              <Label>Ngày trong tuần</Label>
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, i) => {
                  const day = i + 1;
                  const on = days.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDays((prev) =>
                          prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                        )
                      }
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-xs transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || (kind === "weekdays" && days.length === 0)}
          >
            Thêm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
