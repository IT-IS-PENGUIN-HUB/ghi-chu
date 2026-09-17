/**
 * "Lâu chưa đụng tới" — measured against the dự án's own nhịp.
 *
 * A single app-wide threshold turns the warning into wallpaper: seven quiet
 * days on a 積算 gói means something is stuck, seven quiet days on a phần mềm
 * viết dần means nothing happened this week, which is the plan. So the
 * question "how long is too long" is asked once per dự án and everything
 * inside inherits the answer — including the age badge on each việc, so the
 * red on a row and the red on its phân nhánh always agree.
 */
import {
  ageInDays,
  cadenceOf,
  type Field,
  type Project,
  type Task,
} from "./model";

export interface Pace {
  /** Days a việc here may sit before its badge turns red. 0 = never. */
  staleAfter: number;
  /** Days since anything last happened here; null when nothing ever did. */
  idleDays: number | null;
  /** Has open work and has been quiet for longer than its dự án allows. */
  stale: boolean;
}

/** Newest stamp wins, and creating a task counts as touching it, same as finishing one. */
function idleSince(tasks: Task[], now: Date): number | null {
  let best: number | null = null;
  for (const task of tasks) {
    for (const stamp of [task.created, task.completed]) {
      if (!stamp) continue;
      const age = ageInDays(stamp, now);
      if (best === null || age < best) best = age;
    }
  }
  return best;
}

/** One {@link Pace} per phân nhánh, keyed by code. */
export function pacesByProject(
  projects: Project[],
  fields: Field[],
  tasks: Task[],
  now = new Date()
): Map<string, Pace> {
  const fieldByCode = new Map(fields.map(f => [f.code, f]));
  const byProject = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = byProject.get(task.project);
    if (list) list.push(task);
    else byProject.set(task.project, [task]);
  }

  const out = new Map<string, Pace>();
  for (const project of projects) {
    const mine = byProject.get(project.code) ?? [];
    const staleAfter = cadenceOf(
      project.field ? fieldByCode.get(project.field) : undefined
    );
    const idleDays = idleSince(mine, now);
    out.set(project.code, {
      staleAfter,
      idleDays,
      stale:
        staleAfter > 0 &&
        // Nothing open means nothing is waiting on you: a phân nhánh you
        // finished and left alone is not forgotten, it is done. And an
        // archived one was parked on purpose.
        !project.archived &&
        mine.some(t => !t.done) &&
        idleDays !== null &&
        idleDays >= staleAfter,
    });
  }
  return out;
}
