import { useEffect, useRef, useState } from "react";
import { Eye, NotebookPen, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

export interface DayNoteEditorProps {
  date: string;
  value: string;
  onChange: (body: string) => void;
}

/**
 * The free-form half of a day: meeting notes, numbers, anything that is not a
 * checkbox. Writes are debounced so a paragraph becomes one file revision
 * rather than one per keystroke — which matters because each write is a
 * potential git commit.
 */
export function DayNoteEditor({ date, value, onChange }: DayNoteEditorProps) {
  const [draft, setDraft] = useState(value);
  const [preview, setPreview] = useState(false);
  const dirty = useRef(false);

  // Adopt external changes (a pull from GitHub, or switching day) unless the
  // user is mid-edit, which would yank text out from under them.
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value, date]);

  useEffect(() => {
    if (!dirty.current || draft === value) return;
    const id = setTimeout(() => {
      onChange(draft);
      dirty.current = false;
    }, 600);
    return () => clearTimeout(id);
  }, [draft, value, onChange]);

  // Flush on unmount so navigating away never drops the last few characters.
  useEffect(
    () => () => {
      if (dirty.current) onChange(draft);
    },
    [draft, onChange]
  );

  const empty = !draft.trim();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <NotebookPen className="size-4" />
          Ghi chú hôm nay
        </h2>
        {!empty && (
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
            {preview ? "Sửa" : "Xem"}
          </button>
        )}
      </div>

      {preview && !empty ? (
        <div
          className="min-h-[7rem] rounded-xl border border-border bg-card px-3 py-2.5"
          onDoubleClick={() => setPreview(false)}
        >
          <Markdown source={draft} />
        </div>
      ) : (
        <Textarea
          value={draft}
          onChange={(e) => {
            dirty.current = true;
            setDraft(e.target.value);
          }}
          onBlur={() => {
            if (dirty.current) {
              onChange(draft);
              dirty.current = false;
            }
          }}
          placeholder="Có gì phát sinh thì ghi ở đây… (hỗ trợ Markdown)"
          aria-label="Ghi chú tự do cho ngày hôm nay"
          className={cn("min-h-[7rem] resize-y leading-relaxed", empty && "min-h-[4.5rem]")}
        />
      )}

      <p className="text-xs text-muted-foreground">
        {empty
          ? "Ngày không có ghi chú sẽ không tạo file nào trên GitHub."
          : `Lưu vào data/days/${date.slice(0, 4)}/${date}.md`}
      </p>
    </section>
  );
}
