import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Repeat,
  Upload,
} from "lucide-react";
import { RecurringRules } from "@/components/RecurringRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { verifyAccess } from "@/core/github";
import { store } from "@/core/store";
import { resetSyncState, syncNow } from "@/core/sync";
import { useStore } from "@/hooks/useStore";

export default function Settings() {
  const { settings, pending, syncState, tasks, projects, days, fields } = useStore();
  const [owner, setOwner] = useState(settings.owner);
  const [repo, setRepo] = useState(settings.repo);
  const [branch, setBranch] = useState(settings.branch);
  const [token, setToken] = useState(settings.token);
  const [checking, setChecking] = useState(false);

  const configured = Boolean(settings.owner && settings.repo && settings.token);
  const changed =
    owner !== settings.owner ||
    repo !== settings.repo ||
    branch !== settings.branch ||
    token !== settings.token;

  const connect = async () => {
    setChecking(true);
    try {
      const { defaultBranch } = await verifyAccess({
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch.trim() || "main",
        token: token.trim(),
      });
      const finalBranch = branch.trim() || defaultBranch;
      await store.setSettings({
        owner: owner.trim(),
        repo: repo.trim(),
        branch: finalBranch,
        token: token.trim(),
      });
      setBranch(finalBranch);
      resetSyncState();
      await syncNow({ force: true });
      toast.success("Đã kết nối GitHub");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không kết nối được");
    } finally {
      setChecking(false);
    }
  };

  const disconnect = async () => {
    await store.setSettings({ owner: "", repo: "", token: "" });
    resetSyncState();
    setOwner("");
    setRepo("");
    setToken("");
    toast.success("Đã ngắt kết nối. Dữ liệu vẫn còn trên máy này.");
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cài đặt</h1>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Đồng bộ GitHub</h2>
          {configured && (
            <span className="ml-auto flex items-center gap-1 text-xs text-done">
              <CheckCircle2 className="size-3.5" /> đã kết nối
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Ghi chú được lưu thành file Markdown trong một repo{" "}
          <strong>riêng tư</strong> của bạn. Repo này chỉ chứa dữ liệu — mã nguồn app
          nằm ở repo public khác.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gh-owner">Chủ repo</Label>
            <Input
              id="gh-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="tên-github-của-bạn"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-repo">Tên repo</Label>
            <Input
              id="gh-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="ghi-chu-data"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-branch">Nhánh</Label>
            <Input
              id="gh-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-token">Token</Label>
            <Input
              id="gh-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1.5 font-medium text-foreground">Cách tạo token</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>
              Mở{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Fine-grained personal access token
                <ExternalLink className="size-3" />
              </a>
            </li>
            <li>Repository access → Only select repositories → chọn đúng repo dữ liệu</li>
            <li>Permissions → Repository permissions → Contents → Read and write</li>
            <li>Đặt hạn 1 năm, tạo xong dán vào ô Token ở trên</li>
          </ol>
          <p className="mt-2">
            Token lưu trong trình duyệt máy này. Mất máy thì vào GitHub thu hồi token.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={connect} disabled={!owner || !repo || !token || checking}>
            {checking ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {configured && !changed ? "Kiểm tra lại" : "Kết nối"}
          </Button>

          {configured && (
            <>
              <Button
                variant="outline"
                onClick={() => void syncNow({ force: true })}
                disabled={syncState.status === "syncing"}
              >
                <RefreshCw
                  className={`mr-2 size-4 ${syncState.status === "syncing" ? "animate-spin" : ""}`}
                />
                Đồng bộ ngay
              </Button>
              <Button variant="ghost" onClick={disconnect}>
                Ngắt kết nối
              </Button>
            </>
          )}
        </div>

        {configured && (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="autosync" className="font-normal">
                Tự động đẩy lên
              </Label>
              <p className="text-xs text-muted-foreground">
                Gộp các thay đổi và đẩy sau 4 giây kể từ lúc bạn ngừng gõ.
              </p>
            </div>
            <Switch
              id="autosync"
              checked={settings.autoSync}
              onCheckedChange={(v) => void store.setSettings({ autoSync: v })}
            />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Chờ đẩy lên" value={String(pending)} />
          <Stat
            label="Lần cuối"
            value={
              syncState.status === "idle" && syncState.lastSync
                ? new Date(syncState.lastSync).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
          <Stat label="Công việc" value={String(tasks.length)} />
          <Stat label="Ngày có ghi chú" value={String(days.length)} />
        </dl>

        {syncState.status === "error" && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {syncState.message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Việc lặp lại</h2>
        </div>
        <RecurringRules />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Download className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Sao lưu thủ công</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Tải toàn bộ dữ liệu về máy dưới dạng file Markdown gộp — dùng khi chưa
          kết nối GitHub hoặc muốn giữ một bản riêng.
        </p>
        <Button variant="outline" onClick={() => exportAll()}>
          <Download className="mr-2 size-4" /> Tải xuống ({store.allFiles().length} file)
        </Button>
      </section>

      <p className="pb-4 text-xs text-muted-foreground">
        {fields.length} lĩnh vực · {projects.length} dự án · dữ liệu nằm trong IndexedDB
        của trình duyệt này.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Concatenates every file into one downloadable Markdown document. */
function exportAll() {
  const files = store
    .allFiles()
    .filter((f) => !f.deleted)
    .sort((a, b) => a.path.localeCompare(b.path));

  const body = files
    .map((f) => `${"=".repeat(60)}\nFILE: ${f.path}\n${"=".repeat(60)}\n\n${f.content}`)
    .join("\n\n");

  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ghi-chu-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
