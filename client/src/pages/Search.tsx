import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { NotebookPen, Phone, Search as SearchIcon, SquareCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useComposition } from "@/hooks/useComposition";
import { highlightRanges, type Hit } from "@/core/search";
import { useSearchIndex, useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

/**
 * One box over everything: tasks, day notes and the phone book.
 *
 * The index folds Vietnamese tone marks away, so recalling a task from a year
 * ago works from the words alone — "khoi luong" finds "khối lượng" — which is
 * the only realistic way to search history you cannot date.
 */
export default function SearchPage() {
  const { index, version } = useSearchIndex();
  const { projects, ready } = useStore();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 120);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { isComposing: _c, ...compositionHandlers } = useComposition<HTMLInputElement>({});
  void _c;

  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.code, p.name])),
    [projects]
  );

  // `version` is what makes this re-run after the index is rebuilt — the index
  // object itself is mutated in place and keeps the same identity.
  const hits: Hit[] = useMemo(
    () => (ready ? index.search(debounced) : []),
    [index, version, debounced, ready]
  );

  const grouped = useMemo(
    () => ({
      task: hits.filter((h) => h.kind === "task"),
      note: hits.filter((h) => h.kind === "note"),
      contact: hits.filter((h) => h.kind === "contact"),
    }),
    [hits]
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tìm kiếm</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Không cần gõ dấu, không cần nhớ ngày.
        </p>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          {...compositionHandlers}
          placeholder="khoi luong, bao cao, BANK, 0312…"
          aria-label="Từ khoá tìm kiếm"
          type="search"
          enterKeyHint="search"
          className="h-11 pl-9"
        />
      </div>

      {debounced.trim().length < 2 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Gõ ít nhất 2 ký tự để tìm.
        </p>
      ) : hits.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Không tìm thấy gì cho "{debounced}".
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.task.length > 0 && (
            <Group icon={SquareCheck} title="Công việc" count={grouped.task.length}>
              {grouped.task.map((hit) =>
                hit.kind === "task" ? (
                  <Link
                    key={hit.task.id}
                    href={`/du-an/${hit.task.project}`}
                    className="block rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
                  >
                    <div className={cn("text-[15px]", hit.task.done && "text-muted-foreground line-through")}>
                      <Highlight text={hit.task.title} query={debounced} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{hit.task.id}</span>
                      <span>{projectName.get(hit.task.project) ?? hit.task.project}</span>
                      <span className="tabular-nums">{hit.task.created}</span>
                      {hit.task.done && <span className="text-done">đã xong</span>}
                    </div>
                  </Link>
                ) : null
              )}
            </Group>
          )}

          {grouped.note.length > 0 && (
            <Group icon={NotebookPen} title="Ghi chú" count={grouped.note.length}>
              {grouped.note.map((hit) =>
                hit.kind === "note" ? (
                  <Link
                    key={hit.note.date}
                    href={`/lich-su/${hit.note.date}`}
                    className="block rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
                  >
                    <div className="text-[11px] font-medium tabular-nums text-muted-foreground">
                      {hit.note.date}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug">
                      <Highlight text={hit.excerpt} query={debounced} />
                    </p>
                  </Link>
                ) : null
              )}
            </Group>
          )}

          {grouped.contact.length > 0 && (
            <Group icon={Phone} title="Danh bạ" count={grouped.contact.length}>
              {grouped.contact.map((hit, i) =>
                hit.kind === "contact" ? (
                  <a
                    key={`${hit.contact.phone}-${i}`}
                    href={`tel:${hit.contact.phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
                  >
                    <Phone className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px]">
                        <Highlight text={hit.contact.label} query={debounced} />
                      </div>
                      <div className="text-[11px] text-muted-foreground">{hit.contact.group}</div>
                    </div>
                    <span className="font-mono text-sm tabular-nums text-primary">
                      {hit.contact.phone}
                    </span>
                  </a>
                ) : null
              )}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Phone;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" />
        {title} ({count})
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** Bolds the matched words while keeping the original tone marks visible. */
function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightRanges(text, query).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded bg-primary/20 px-0.5 text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}
