import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { buildDailyList, type SortMode } from "@/core/codes";
import { CATEGORIES, toDateKey, type Category } from "@/core/model";
import { everyMidnight, materialise } from "@/core/recurring";
import { SearchIndex } from "@/core/search";
import { store, type Snapshot } from "@/core/store";

/** Whole-store subscription. The snapshot is immutable, so React can diff it. */
export function useStore(): Snapshot {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}

/** Today's list for one category, numbered WORK_01, WORK_02, … */
export function useDailyList(category: Category, sort: SortMode = "age") {
  const { tasks } = useStore();
  return useMemo(
    () => buildDailyList(tasks, category, sort),
    [tasks, category, sort]
  );
}

/**
 * Rebuilds the search index when the underlying data changes.
 *
 * Returns a version number alongside the index. The index is a mutable object
 * whose identity never changes, so without the version a memoised result would
 * keep showing pre-rebuild hits — add a task, search for it, and it would be
 * missing until you retyped the query.
 *
 * The signature is derived from ids and status rather than the arrays: every
 * keystroke in the note editor produces fresh array identities, and reindexing
 * a year of notes on each one would stutter on a phone.
 */
export function useSearchIndex(): { index: SearchIndex; version: number } {
  const { tasks, days, contacts } = useStore();
  const index = useMemo(() => new SearchIndex(), []);
  const [version, setVersion] = useState(0);

  const signature = useMemo(
    () =>
      [
        tasks
          .map(t => `${t.id}${t.done ? "1" : "0"}${t.title.length}`)
          .join(","),
        days.map(d => `${d.date}:${d.body.length}`).join(","),
        contacts.map(c => c.phone).join(","),
      ].join("|"),
    [tasks, days, contacts]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      index.rebuild({ tasks, notes: days, contacts });
      setVersion(v => v + 1);
    }, 150);
    return () => clearTimeout(id);
    // Rebuilding is keyed on the signature; the arrays are read at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, index]);

  return { index, version };
}

/**
 * Fires due recurring rules on open, on every midnight the app stays open
 * for, and whenever the window is brought back — a static PWA has no
 * background worker, and a sleeping machine has no working timers either.
 */
export function useRecurring(): void {
  const { ready, recurring, tasks } = useStore();

  useEffect(() => {
    if (!ready || !recurring.length) return;

    const run = () => {
      const snapshot = store.getSnapshot();
      const { created, rules } = materialise(
        snapshot.recurring,
        snapshot.tasks
      );
      if (
        !created.length &&
        rules.every((r, i) => r.lastRun === snapshot.recurring[i]?.lastRun)
      ) {
        return;
      }
      for (const task of created) {
        store.addTask({
          title: task.title,
          project: task.project,
          category: task.category,
        });
      }
      store.setRecurring(rules);
    };

    run();

    // Every midnight, not just the first one.
    const stop = everyMidnight(run);

    // A timer is not enough on its own: a closed laptop or a background tab
    // has its timers throttled or frozen, so the night can pass without the
    // callback ever firing. Coming back to the window re-checks.
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `tasks` is read inside `run` from the live store, not closed over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, recurring.length]);

  void tasks;
}

/** Counts for the header, computed once per snapshot. */
export function useStats() {
  const { tasks } = useStore();
  return useMemo(() => {
    const today = toDateKey(new Date());
    const open = tasks.filter(t => !t.done);
    const doneToday = tasks.filter(
      t => t.done && t.completed?.slice(0, 10).replace(/\./g, "-") === today
    );

    const byCategory = Object.fromEntries(
      CATEGORIES.map(c => [c, open.filter(t => t.category === c).length])
    ) as Record<Category, number>;

    return {
      open: open.length,
      total: tasks.length,
      doneToday: doneToday.length,
      byCategory,
      /** Oldest open task's age in days — the "how stale is my list" number. */
      oldest: open.reduce((max, t) => {
        const d = t.created.slice(0, 10);
        return d < max ? d : max;
      }, "9999.99.99"),
    };
  }, [tasks]);
}
