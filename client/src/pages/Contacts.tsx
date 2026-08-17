import { useMemo, useState } from "react";
import { Phone, Plus, Trash2, UserRoundPlus } from "lucide-react";
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
import { type Contact } from "@/core/model";
import { store } from "@/core/store";
import { useStore } from "@/hooks/useStore";

/**
 * Customer phone book. Numbers are `tel:` links so one tap dials from the
 * phone — the whole reason for keeping them in here rather than in a note.
 */
export default function Contacts() {
  const { contacts } = useStore();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle) ||
        c.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "")) ||
        (c.note ?? "").toLowerCase().includes(needle)
    );
  }, [contacts, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filtered) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const remove = (target: Contact) => {
    store.setContacts(
      contacts.filter((c) => !(c.phone === target.phone && c.label === target.label))
    );
    setRemoving(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Danh bạ</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bấm vào số để gọi ngay.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <UserRoundPlus className="size-4" /> Thêm
        </Button>
      </header>

      {contacts.length > 5 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên, khách hàng hoặc số…"
          aria-label="Tìm trong danh bạ"
          type="search"
          className="h-10"
        />
      )}

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <Phone className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0
              ? "Chưa có số nào. Thêm số văn phòng khách hàng để tra nhanh khi cần."
              : `Không tìm thấy "${query}".`}
          </p>
          {contacts.length === 0 && (
            <Button variant="link" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 size-3.5" /> Thêm số đầu tiên
            </Button>
          )}
        </div>
      ) : (
        grouped.map(([group, list]) => (
          <section key={group} className="space-y-2">
            <h2 className="text-sm font-semibold">{group}</h2>
            <ul className="space-y-1.5">
              {list.map((c, i) => (
                <li key={`${c.phone}-${i}`} className="flex items-center gap-1">
                  <a
                    href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                    className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/20"
                  >
                    <Phone className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base">{c.label}</div>
                      {c.note && (
                        <div className="truncate text-xs text-muted-foreground">{c.note}</div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-primary">
                      {c.phone}
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemoving(c)}
                    aria-label={`Xoá ${c.label}`}
                    className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {adding && (
        <ContactDialog
          groups={[...new Set(contacts.map((c) => c.group))]}
          onSave={(contact) => {
            store.setContacts([...contacts, contact]);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xoá "{removing?.label}"?</DialogTitle>
            <DialogDescription>{removing?.phone}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={() => removing && remove(removing)}>
              Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactDialog({
  groups,
  onSave,
  onClose,
}: {
  groups: string[];
  onSave: (contact: Contact) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(groups[0] ?? "");
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!label.trim() || !phone.trim()) return;
    onSave({
      group: group.trim() || "Khác",
      label: label.trim(),
      phone: phone.trim(),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm số điện thoại</DialogTitle>
          <DialogDescription>Lưu vào data/contacts.md trong repo của bạn.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-group">Khách hàng / nhóm</Label>
            <Input
              id="c-group"
              list="contact-groups"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Alpha"
            />
            <datalist id="contact-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-label">Tên / bộ phận</Label>
            <Input
              id="c-label"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Văn phòng Tokyo"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Số điện thoại</Label>
            <Input
              id="c-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              type="tel"
              inputMode="tel"
              placeholder="03-1234-5678"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-note">Ghi chú (không bắt buộc)</Label>
            <Input
              id="c-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Phòng kinh doanh"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!label.trim() || !phone.trim()}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
