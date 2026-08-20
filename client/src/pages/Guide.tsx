import { type ReactNode } from "react";
import { Link } from "wouter";
import {
  CalendarDays,
  CheckSquare,
  Cloud,
  FolderTree,
  Keyboard,
  NotebookPen,
  Phone,
  Repeat,
  Search,
  Smartphone,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Written as answers to the questions someone actually has in front of the
 * app ("how do I add a task", "why did the number change"), not as a feature
 * list. The numbering scheme in particular surprises people, so it gets a
 * worked example rather than a definition.
 */
export default function Guide() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Hướng dẫn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đọc một lần là dùng được hết.
        </p>
      </header>

      <Section icon={CheckSquare} title="Thêm việc" accent="wrk">
        <ol className="space-y-2.5">
          <Step n={1}>
            Ở màn <b>Hôm nay</b>, chọn nhóm <Chip color="wrk">Công việc</Chip> hoặc{" "}
            <Chip color="per">Cá nhân</Chip>.
          </Step>
          <Step n={2}>
            Gõ nội dung vào ô lớn có chữ <b>“Thêm việc…”</b>, rồi bấm{" "}
            <Kbd>Enter</Kbd> hoặc nút <b>Thêm</b>.
          </Step>
          <Step n={3}>
            Muốn xếp việc vào dự án nào thì chọn ở ô <b>“Thuộc dự án”</b> ngay dưới.
            App nhớ dự án bạn dùng lần trước nên thường không phải chọn lại.
          </Step>
        </ol>
        <Tip>
          Gõ liên tiếp nhiều việc được: sau mỗi lần Enter, con trỏ vẫn nằm trong ô.
        </Tip>
      </Section>

      <Section icon={CheckSquare} title="Đánh dấu xong, sửa, xoá" accent="done">
        <ul className="space-y-2">
          <Bullet>
            <b>Xong:</b> tick vào ô vuông bên trái. Việc chuyển xuống mục “Đã xong hôm nay”.
          </Bullet>
          <Bullet>
            <b>Trên điện thoại:</b> <b>vuốt sang phải</b> để đánh dấu xong,{" "}
            <b>vuốt sang trái</b> để xoá — không cần mở menu.
          </Bullet>
          <Bullet>
            <b>Sửa / chuyển dự án / đánh dấu ưu tiên:</b> bấm nút ba chấm ⋮ bên phải dòng.
          </Bullet>
          <Bullet>
            <b>Lỡ tay xoá?</b> Bấm <b>Hoàn tác</b> trên thông báo hiện ra trong 6 giây —
            việc quay lại nguyên vẹn, đúng mã cũ.
          </Bullet>
          <Bullet>
            Bỏ tick thì việc quay lại danh sách, dấu thời gian hoàn thành bị xoá.
          </Bullet>
        </ul>
      </Section>

      <Section icon={Tag} title="Hai loại mã số" accent="per">
        <p className="mb-3">
          Mỗi việc có <b>hai mã khác nhau</b>, cố ý nhìn là phân biệt được ngay:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-3 font-semibold">Mã</th>
                <th className="pb-2 pr-3 font-semibold">Ví dụ</th>
                <th className="pb-2 font-semibold">Nghĩa</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-border/60">
                <td className="py-2.5 pr-3">Mã ngày</td>
                <td className="py-2.5 pr-3">
                  <code className="rounded bg-wrk-soft px-1.5 py-0.5 font-mono text-wrk">
                    WRK_01
                  </code>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  Số thứ tự trong danh sách <b>hôm nay</b>. Sang ngày mới thì đánh lại từ
                  01. Không dùng để tra cứu lâu dài.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3">Mã việc</td>
                <td className="py-2.5 pr-3">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">ALP-0042</code>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  <b>Vĩnh viễn.</b> Cấp một lần lúc tạo, không bao giờ đổi — kể cả khi
                  chuyển việc sang dự án khác. Đây là mã để tra cứu sau một năm.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Tip>
          Việc chưa xong sẽ <b>tự sang ngày mới</b> với mã ngày mới. Nhãn{" "}
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
            +9 ngày
          </span>{" "}
          cho biết việc đó đã tồn bao lâu — đỏ là quá 7 ngày.
        </Tip>
      </Section>

      <Section icon={FolderTree} title="Phân cấp: Nhóm → Lĩnh vực → Dự án" accent="wrk">
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
{`Công việc (WRK)
 └ Lĩnh vực        ví dụ: 積算, 積算照査
    └ Dự án        ví dụ: Alpha, Beta
       └ Việc      ALP-0042

Cá nhân (PER)
 └ Lĩnh vực        Cuộc sống, Học tập
    └ Dự án        …`}
        </pre>
        <ul className="mt-3 space-y-2">
          <Bullet>
            Vào <Link href="/du-an" className="font-medium text-primary hover:underline">Dự án</Link>{" "}
            để thêm/sửa/xoá <b>lĩnh vực</b> và <b>dự án</b>.
          </Bullet>
          <Bullet>
            Dự án chưa gán lĩnh vực vẫn dùng bình thường — app chỉ nhắc chứ không ép.
          </Bullet>
          <Bullet>
            Xoá lĩnh vực <b>không xoá việc nào</b>; các dự án bên trong chuyển về mục
            “chưa gán”.
          </Bullet>
          <Bullet>
            Mã dự án (ví dụ <code className="rounded bg-muted px-1 font-mono">ALP</code>) là
            tiền tố của mọi mã việc bên trong. <b>Đổi được bất cứ lúc nào</b> — app sẽ
            đánh lại mã cho toàn bộ việc trong dự án và đổi tên file trên GitHub.
          </Bullet>
        </ul>

        <h3 className="mb-2 mt-4 font-semibold">Đặt mã như thế nào</h3>
        <ul className="space-y-2">
          <Bullet>
            Được dùng: <b>chữ in hoa</b>, <b>số</b> và dấu <b>gạch dưới</b> —{" "}
            <code className="rounded bg-muted px-1 font-mono">SNK</code>,{" "}
            <code className="rounded bg-muted px-1 font-mono">DU_AN01</code>. Dài 2–8 ký tự,
            bắt đầu bằng chữ. Gõ tiếng Việt có dấu cũng được, app tự bỏ dấu.
          </Bullet>
          <Bullet>
            Không dùng được dấu <b>chấm</b> và dấu <b>gạch ngang</b>, vì mã vừa là tên file
            (<code className="rounded bg-muted px-1 font-mono">data/tasks/SNK.md</code>) vừa
            là phần đầu của mã việc (
            <code className="rounded bg-muted px-1 font-mono">SNK-0042</code>) — dấu chấm sẽ
            lẫn với đuôi <code className="rounded bg-muted px-1 font-mono">.md</code>, còn
            gạch ngang sẽ lẫn với dấu ngăn trước dãy số.
          </Bullet>
        </ul>
      </Section>

      <Section icon={NotebookPen} title="Ghi chú tự do" accent="per">
        <p>
          Ô <b>“Ghi chú hôm nay”</b> ở màn Hôm nay dùng để ghi những gì không phải
          checklist: nội dung cuộc họp, số liệu, ý tưởng. Hỗ trợ Markdown, có nút xem
          trước.
        </p>
        <Tip>
          Ngày nào không ghi gì thì <b>không tạo file nào cả</b> — bạn chỉ ghi khi có
          việc phát sinh.
        </Tip>
      </Section>

      <Section icon={Search} title="Tìm lại việc cũ" accent="done">
        <ul className="space-y-2">
          <Bullet>
            <b>Không cần gõ dấu:</b> gõ <code className="rounded bg-muted px-1">khoi luong</code>{" "}
            vẫn ra “khối lượng”.
          </Bullet>
          <Bullet>
            <b>Không cần nhớ ngày:</b> tìm trong toàn bộ lịch sử, gồm cả việc, ghi chú
            ngày và danh bạ.
          </Bullet>
          <Bullet>
            Gõ gần đúng vẫn ra, gõ nửa từ cũng ra.
          </Bullet>
        </ul>
      </Section>

      <Section icon={CalendarDays} title="Xem lại ngày cũ" accent="wrk">
        <p>
          Màn <Link href="/lich-su" className="font-medium text-primary hover:underline">Lịch sử</Link>{" "}
          có lịch tháng: ô càng đậm là ngày đó xong càng nhiều việc, chấm nhỏ dưới ô nghĩa
          là ngày đó có ghi chú. Bấm vào ngày để xem lại.
        </p>
      </Section>

      <Section icon={Phone} title="Danh bạ" accent="per">
        <p>
          Lưu số văn phòng khách hàng ở màn{" "}
          <Link href="/danh-ba" className="font-medium text-primary hover:underline">Danh bạ</Link>.
          Trên iPhone bấm vào số là gọi luôn.
        </p>
      </Section>

      <Section icon={Repeat} title="Việc lặp lại" accent="wrk">
        <p>
          Trong <Link href="/cai-dat" className="font-medium text-primary hover:underline">Cài đặt</Link>{" "}
          có mục “Việc lặp lại”: khai báo một lần, việc tự xuất hiện đúng ngày (hằng ngày,
          hoặc chọn thứ trong tuần).
        </p>
        <Tip>
          Việc lặp được sinh khi bạn <b>mở app</b>, không phải đúng 0h — app chạy trong
          trình duyệt nên không có tiến trình nền.
        </Tip>
      </Section>

      <Section icon={Cloud} title="Đồng bộ iPhone ↔ máy tính" accent="done">
        <p>
          Mặc định dữ liệu chỉ nằm trên máy đang dùng. Muốn đồng bộ thì vào{" "}
          <Link href="/cai-dat" className="font-medium text-primary hover:underline">Cài đặt</Link>{" "}
          và kết nối GitHub một lần cho mỗi thiết bị.
        </p>
        <p className="mt-2">
          Biểu tượng góc trên cho biết trạng thái: <b>đám mây gạch chéo</b> = chưa kết nối,{" "}
          <b>dấu tick xanh</b> = đã đồng bộ xong, <b>chấm vàng</b> = còn thay đổi chờ đẩy lên.
        </p>
      </Section>

      <Section icon={Smartphone} title="Cài thành app" accent="per">
        <ul className="space-y-2">
          <Bullet>
            <b>iPhone:</b> mở bằng Safari → nút Chia sẻ → <b>Thêm vào MH chính</b>.
          </Bullet>
          <Bullet>
            <b>Windows (bản nhẹ):</b> mở bằng Edge hoặc Chrome → menu →{" "}
            <b>Cài đặt ứng dụng này</b>.
          </Bullet>
          <Bullet>
            <b>Windows (bản nổi trên màn hình):</b> cài file <b>GhiChu-setup.exe</b> từ
            mục Releases trên GitHub. Bản này có thêm: nút <b>ghim 📌</b> trên thanh công
            cụ để cửa sổ luôn nổi trên mọi ứng dụng khác, phím tắt toàn cục{" "}
            <Kbd>Ctrl</Kbd>+<Kbd>Alt</Kbd>+<Kbd>G</Kbd> gọi app từ bất cứ đâu, và icon ở
            khay hệ thống — bấm ✕ chỉ ẩn xuống khay chứ không thoát.
          </Bullet>
        </ul>
        <Tip variant="warn">
          Trên iPhone <b>nên cài</b> chứ đừng chỉ mở bằng Safari: web thường bị iOS xoá dữ
          liệu sau 7 ngày không dùng, còn app đã cài thì không.
        </Tip>
      </Section>

      <Section icon={Keyboard} title="Phím tắt trên máy tính" accent="wrk">
        <ul className="space-y-1.5">
          <Bullet>
            <Kbd>J</Kbd> / <Kbd>K</Kbd> — di chuyển xuống / lên trong danh sách
          </Bullet>
          <Bullet>
            <Kbd>Space</Kbd> — đánh dấu xong việc đang chọn
          </Bullet>
          <Bullet>
            <Kbd>N</Kbd> — nhảy tới ô thêm việc
          </Bullet>
          <Bullet>
            <Kbd>Esc</Kbd> — bỏ chọn
          </Bullet>
          <Bullet>
            <Kbd>Enter</Kbd> — thêm việc (khi con trỏ trong ô nhập)
          </Bullet>
        </ul>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ pieces --

type Accent = "wrk" | "per" | "done";

const ACCENT: Record<Accent, string> = {
  wrk: "bg-wrk-soft text-wrk",
  per: "bg-per-soft text-per",
  done: "bg-done-soft text-done",
};

function Section({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: typeof Tag;
  title: string;
  accent: Accent;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", ACCENT[accent])}>
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
      <span>{children}</span>
    </li>
  );
}

function Tip({ children, variant = "info" }: { children: ReactNode; variant?: "info" | "warn" }) {
  return (
    <p
      className={cn(
        "mt-3 rounded-lg border-l-4 px-3 py-2 text-sm",
        variant === "warn"
          ? "border-l-destructive bg-destructive/5"
          : "border-l-primary bg-primary/5"
      )}
    >
      {children}
    </p>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  );
}

function Chip({ children, color }: { children: ReactNode; color: "wrk" | "per" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-sm font-medium",
        color === "wrk" ? "bg-wrk-soft text-wrk" : "bg-per-soft text-per"
      )}
    >
      {children}
    </span>
  );
}
