import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { isDefaultProject, type Project } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

export interface DeleteProjectDialogProps {
  project: Project;
  onClose: () => void;
  /** Ran after the project is gone — the project page uses it to navigate away. */
  onDeleted?: () => void;
}

/**
 * The one confirmation between a stray tap and a project that is no longer
 * there.
 *
 * Deleting is offered everywhere the project is, so the dialog has to carry
 * the whole rule rather than assume the button was only shown when it was
 * safe: a project holding work cannot go, and neither can the catch-all
 * bucket. In both cases it says why instead of failing silently, because a
 * button that does nothing is worse than one that explains itself.
 */
export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const { tasks } = useStore();
  const count = tasks.filter(t => t.project === project.code).length;
  const isDefault = isDefaultProject(project.code);

  const confirm = () => {
    const result = store.deleteProject(project.code);
    if (!result.ok) {
      toast.error(result.reason ?? "Không xoá được phân nhánh");
      return;
    }
    toast.success(`Đã xoá phân nhánh ${project.name}`);
    onClose();
    onDeleted?.();
  };

  return (
    <AlertDialog open onOpenChange={o => !o && onClose()}>
      <AlertDialogContent>
        {isDefault ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Không xoá được "{project.name}"
              </AlertDialogTitle>
              <AlertDialogDescription>
                Đây là ngăn mặc định của app: việc bạn gõ nhanh mà chưa chọn dự
                án nào đều rơi vào đây, nên nó phải luôn tồn tại. Muốn gọn hơn
                thì đổi tên nó trong “Sửa phân nhánh”.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Đã hiểu</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : count > 0 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Không xoá được "{project.name}"
              </AlertDialogTitle>
              <AlertDialogDescription>
                Phân nhánh này còn <b>{count} việc</b> bên trong (cả việc đã
                xong). App chỉ xoá phân nhánh rỗng, để công việc thật không bao
                giờ biến mất theo. Mở phân nhánh ra, chuyển việc sang phân nhánh
                khác hoặc xoá hết việc, rồi quay lại xoá phân nhánh.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Đã hiểu</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Xoá phân nhánh "{project.name}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Phân nhánh đang rỗng nên không có việc nào bị mất. Mã{" "}
                <code className="font-mono">{project.code}</code> được trả lại
                để dùng cho phân nhánh khác, và file{" "}
                <code className="font-mono">data/tasks/{project.code}.md</code>{" "}
                trên GitHub cũng bị xoá theo. Không hoàn tác được.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirm}
                className={cn(buttonVariants({ variant: "destructive" }))}
              >
                <Trash2 className="mr-2 size-4" /> Xoá phân nhánh
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
