import { toast } from "sonner";
import { store } from "@/core/store";

/**
 * Deletes a task with a 6-second undo window instead of a confirm dialog.
 *
 * Every major todo app (Todoist, TickTick, Apple Reminders) settled on this
 * pattern for a reason: a confirm dialog taxes the 99% of deletes that are
 * intentional, while undo makes the 1% that are accidents free. Restoring is
 * safe at any point — the permanent id was allocated before the delete and
 * counters never roll back, so it cannot collide.
 */
export function deleteTaskWithUndo(id: string): void {
  const task = store.getSnapshot().tasks.find((t) => t.id === id);
  if (!task) return;

  store.deleteTask(id);

  const title = task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title;
  toast(`Đã xoá "${title}"`, {
    duration: 6000,
    action: {
      label: "Hoàn tác",
      onClick: () => store.restoreTask(task),
    },
  });
}

/**
 * Toggles a task, and when that reopens a finished one, offers to undo.
 *
 * Reopening deletes the completion stamp (ticking again would mint a new
 * time), so an accidental tap on the "done" list quietly falsifies history.
 * The toast makes the change visible and reversible with the original stamp.
 */
export function toggleTaskWithUndo(id: string): void {
  const task = store.getSnapshot().tasks.find((t) => t.id === id);
  if (!task) return;

  const wasDone = task.done;
  const stamp = task.completed;
  store.toggleTask(id);

  if (wasDone && stamp) {
    const title = task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title;
    toast(`Đã mở lại "${title}"`, {
      duration: 6000,
      action: {
        label: "Hoàn tác",
        onClick: () => store.markDone(id, stamp),
      },
    });
  }
}
