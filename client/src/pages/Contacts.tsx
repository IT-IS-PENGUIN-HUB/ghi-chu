import { useMemo, useState } from "react";
import { Copy, Pencil, Phone, Plus, Trash2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
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

/** Copies a value to the clipboard with a short confirmation. */
function copyText(text: string, what: string) {
  const value = text.trim();
  if (!navigator.clipboard) {
    toast.error(`Không sao chép được — ${what}: ${value}`);
    return;
  }
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã sao chép ${what}`, { duration: 1500 }),
    () => toast.error(`Không sao chép được — ${what}: ${value}`)
  );
}

/**
 * Groups a bare run of digits into the usual Japanese dashed shape, so the
 * user types only numbers and the dashes appear on their own.
 *
 * Perfect grouping needs the full area-code table; this covers the common
 * cases (mobile/050, Tokyo/Osaka, and the frequent 3-3-4 regional shape) and
 * leaves anything the user dashed themselves untouched, so an odd number like
 * 0480-12-3456 can always be entered by hand.
 */
function formatJpPhone(raw: string): string {
  if (raw.trim().startsWith("+")) return raw.replace(/[^\d+\-\s]/g, "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    if (/^0[36]/.test(d))
      return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return d;
}

/**
 * How a stored number is shown. Numbers saved before auto-formatting existed,
 * or synced as bare digits, get grouped here too; a number the user dashed
 * their own way is shown verbatim.
 */
function displayPhone(phone: string): string {
  return /[-\s]/.test(phone) ? phone.trim() : formatJpPhone(phone);
}

/**
 * Customer phone book. Numbers are `tel:` links so one tap dials from the
 * phone — the whole reason for keeping them in here rather than in a note.
 */
export default function Contacts() {
  const { contacts } = useStore();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      c =>
        c.label.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle) ||
        c.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "")) ||
        (c.note ?? "").toLowerCase().includes(needle)
    );
  }, [contacts, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filtered)
      map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const remove = (target: Contact) => {
    store.setContacts(
      contacts.filter(
        c => !(c.phone === target.phone && c.label === target.label)
      )
    );
    setRemoving(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Danh bạ</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bấm số để gọi · bấm nút chép (hoặc nhấn giữ) để sao chép.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
          <UserRoundPlus className="size-4" /> Thêm
        </Button>
      </header>

      {contacts.length > 5 && (
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
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
                  <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card py-1.5 pl-3 pr-1.5 transition-colors hover:border-foreground/20">
                    {/* Name column: the name (tap = edit) and its own copy
                        button at the far end of the same cell, so the button
                        clearly belongs to the name, not the number. */}
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        onContextMenu={e => {
                          e.preventDefault();
                          copyText(c.label, "tên");
                        }}
                        className="flex min-w-0 items-center gap-3 py-1 text-left"
                        aria-label={`Sửa ${c.label}`}
                        title="Bấm để sửa · nhấn giữ để sao chép tên"
                      >
                        <Pencil className="size-4 shrink-0 text-muted-foreground/60" />
                        <span className="min-w-0">
                          <span className="block truncate text-base">
                            {c.label}
                          </span>
                          {c.note && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.note}
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(c.label, "tên")}
                        aria-label={`Sao chép tên ${c.label}`}
                        title="Sao chép tên"
                        className="tap flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Copy className="size-4" />
                      </button>
                      {/* Eats the rest of the name column so the copy-name
                          button hugs the name instead of drifting to the far
                          right next to the phone. */}
                      <span aria-hidden className="flex-1" />
                    </div>

                    {/* Phone column: the number (tap = call) and its copy
                        button, kept together as their own cell. */}
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                        onContextMenu={e => {
                          e.preventDefault();
                          copyText(displayPhone(c.phone), "số");
                        }}
                        aria-label={`Gọi ${displayPhone(c.phone)}`}
                        title="Bấm để gọi · nhấn giữ để sao chép số"
                        className="tap flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 font-mono text-sm font-medium tabular-nums text-primary transition-colors hover:bg-primary/20"
                      >
                        <Phone className="size-3.5" />
                        {displayPhone(c.phone)}
                      </a>
                      <button
                        type="button"
                        onClick={() => copyText(displayPhone(c.phone), "số")}
                        aria-label={`Sao chép số ${displayPhone(c.phone)}`}
                        title="Sao chép số"
                        className="tap flex shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Copy className="size-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoving(c)}
                    aria-label={`Xoá ${c.label}`}
                    className="tap flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {(adding || editing) && (
        <ContactDialog
          groups={[...new Set(contacts.map(c => c.group))]}
          initial={editing ?? undefined}
          onSave={contact => {
            store.setContacts(
              editing
                ? contacts.map(c => (c === editing ? contact : c))
                : [...contacts, contact]
            );
            setAdding(false);
            setEditing(null);
          }}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      <Dialog
        open={removing !== null}
        onOpenChange={o => !o && setRemoving(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xoá "{removing?.label}"?</DialogTitle>
            <DialogDescription>{removing?.phone}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={() => removing && remove(removing)}
            >
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
  initial,
  onSave,
  onClose,
}: {
  groups: string[];
  initial?: Contact;
  onSave: (contact: Contact) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(initial?.group ?? groups[0] ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

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
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Sửa số điện thoại" : "Thêm số điện thoại"}
          </DialogTitle>
          <DialogDescription>
            Lưu vào data/contacts.md trong repo của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-group">Khách hàng / nhóm</Label>
            <Input
              id="c-group"
              list="contact-groups"
              value={group}
              onChange={e => setGroup(e.target.value)}
              placeholder="Alpha"
            />
            <datalist id="contact-groups">
              {groups.map(g => (
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
              onChange={e => setLabel(e.target.value)}
              placeholder="Văn phòng Tokyo"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Số điện thoại</Label>
            <Input
              id="c-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onBlur={() =>
                // Only auto-group a bare run of digits; a number the user
                // dashed themselves (e.g. 0480-12-3456) is left as typed.
                setPhone(p => (/[-\s]/.test(p) ? p.trim() : formatJpPhone(p)))
              }
              onKeyDown={e => {
                if (e.key !== "Enter") return;
                setPhone(p => (/[-\s]/.test(p) ? p.trim() : formatJpPhone(p)));
                submit();
              }}
              type="tel"
              inputMode="tel"
              placeholder="Gõ số liền, vd 0312345678"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Gõ số liền là được — dấu <b>–</b> tự thêm khi rời ô
              (03-1234-5678). Số cần chia khác thì bạn tự gõ dấu, app giữ
              nguyên.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-note">Ghi chú (không bắt buộc)</Label>
            <Input
              id="c-note"
              value={note}
              onChange={e => setNote(e.target.value)}
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
