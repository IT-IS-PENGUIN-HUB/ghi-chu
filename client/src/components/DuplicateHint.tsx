import { type DuplicateHit, describeDuplicate } from "@/core/duplicates";

/**
 * The amber line that says "you already wrote this down".
 *
 * A warning, never a block — same as the duplicate-name warning when making a
 * phân nhánh. Sometimes you really do mean to do the same thing twice, and an
 * app that refuses is worse than one that mentions it.
 */
export function DuplicateHint({ hit }: { hit: DuplicateHit }) {
  return (
    <p className="mt-2 rounded-lg border-l-4 border-l-amber-500 bg-amber-500/10 px-2.5 py-2 text-xs">
      Đã có việc <b>“{hit.task.title}”</b> {describeDuplicate(hit)} (mã{" "}
      <code className="font-mono">{hit.task.id}</code>). Vẫn thêm nữa thì bạn sẽ
      có hai dòng giống nhau.
    </p>
  );
}
