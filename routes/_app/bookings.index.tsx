import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ConflictBanner } from "@/components/crm/conflicts";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankBooking } from "@/lib/crm/blank";
import { BOOKING_TONE, formatDate, money, parseDate } from "@/lib/crm/format";
import { detectConflicts, hardConflictIds } from "@/lib/crm/logic";
import { BOOKING_STATUSES, BRANDS, TRIP_TYPES, type BookingRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/bookings/")({
  component: BookingsPage,
});

function BookingsPage() {
  const { data, saveEntity, removeEntity, nextRef, actor } = useCrm();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingRecord | null>(null);

  const report = useMemo(() => detectConflicts(data.bookings), [data.bookings]);
  const hardIds = hardConflictIds(report);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.bookings
      .filter((b) => (status === "All" ? true : b.status === status))
      .filter((b) =>
        !s ? true : `${b.ref} ${b.company} ${b.from} ${b.to} ${b.units.map((u) => u.driver + u.plate).join(" ")}`.toLowerCase().includes(s),
      )
      .sort((a, b) => (a.dates[0]?.date || "").localeCompare(b.dates[0]?.date || ""));
  }, [data.bookings, q, status]);

  async function startNew() {
    const ref = await nextRef("booking");
    if (!ref) return;
    setDraft(blankBooking(actor, ref));
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Conflicts run themselves: same driver or plate on overlapping dates (red), same vehicle type on a day (amber), same customer/date/route (likely duplicate)."
        actions={
          <Button variant="brand" onClick={() => void startNew()}>
            New booking
          </Button>
        }
      />

      <ConflictBanner
        report={report}
        bookings={data.bookings}
        onDelete={(id) => void removeEntity("bookings", id)}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search ref, customer, plate, driver…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="bg-card sm:w-44">
          <option>All</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
      </div>

      <MonthBoard bookings={data.bookings} hardIds={hardIds} />

      {rows.length === 0 ? (
        <EmptyState title="No bookings in this view" />
      ) : (
        <DataTable columns={["Ref", "Customer", "Dates", "Route", "Units", "Status", "Amount"]}>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link to="/bookings/$id" params={{ id: b.id }} className="font-medium text-primary">
                  {b.ref}
                </Link>
              </td>
              <td className="px-4 py-3">{b.company}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {b.dates.map((d) => formatDate(d.date)).join(", ")}
              </td>
              <td className="max-w-[14rem] truncate px-4 py-3 text-muted-foreground">
                {b.from} → {b.to}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {b.units.map((u) => [u.vehicle, u.plate, u.driver].filter(Boolean).join(" · ")).join("; ") || "—"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={hardIds.has(b.id) ? "danger" : BOOKING_TONE[b.status]}>
                  {hardIds.has(b.id) ? "Conflict" : b.status}
                </StatusBadge>
              </td>
              <td className="px-4 py-3 tabular">{money(b.amount)}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.ref ?? "New booking"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <Field label="Company">
                <Input
                  list="bk-cos"
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
                <datalist id="bk-cos">
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand">
                  <NativeSelect
                    value={draft.brand}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value as BookingRecord["brand"] })}
                  >
                    {BRANDS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Trip type">
                  <NativeSelect
                    value={draft.tripType}
                    onChange={(e) => setDraft({ ...draft, tripType: e.target.value as BookingRecord["tripType"] })}
                  >
                    {TRIP_TYPES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <Input value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
                </Field>
                <Field label="To">
                  <Input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
                </Field>
              </div>
              <Field label="First date">
                <Input
                  type="date"
                  value={draft.dates[0]?.date || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dates: [{ ...draft.dates[0], date: e.target.value, endDate: e.target.value }],
                    })
                  }
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!draft) return;
                if (!draft.company.trim()) {
                  toast.error("Company is required.");
                  return;
                }
                const ok = await saveEntity("bookings", draft);
                if (ok) {
                  setOpen(false);
                  void navigate({ to: "/bookings/$id", params: { id: draft.id } });
                }
              }}
            >
              Save booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MonthBoard({ bookings, hardIds }: { bookings: BookingRecord[]; hardIds: Set<string> }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(y, m, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const byDay = new Map<string, BookingRecord[]>();
  for (const b of bookings.filter((x) => x.status !== "Cancelled")) {
    for (const d of b.dates) {
      const start = parseDate(d.date);
      const end = parseDate(d.endDate || d.date) ?? start;
      if (!start) continue;
      for (let t = new Date(start); t <= (end ?? start); t.setDate(t.getDate() + 1)) {
        const key = isoDay(t);
        const arr = byDay.get(key) ?? [];
        arr.push(b);
        byDay.set(key, arr);
      }
    }
  }

  const label = cursor.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Calendar
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(new Date(y, m - 1, 1))}
          >
            Prev
          </Button>
          <p className="min-w-36 text-center text-sm font-medium">{label}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(new Date(y, m + 1, 1))}
          >
            Next
          </Button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-px rounded-md bg-border text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-card px-1 py-2 text-center text-[10px] tracking-wide text-muted-foreground uppercase">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} className="min-h-20 bg-muted/40" />;
          const key = isoDay(d);
          const list = byDay.get(key) ?? [];
          const isToday = key === isoDay(today);
          return (
            <div
              key={key}
              className={`min-h-20 bg-card px-1.5 py-1 ${isToday ? "ring-1 ring-brand ring-inset" : ""}`}
            >
              <p className="text-[11px] tabular text-muted-foreground">{d.getDate()}</p>
              {list.slice(0, 3).map((b) => (
                <Link
                  key={b.id}
                  to="/bookings/$id"
                  params={{ id: b.id }}
                  className={`mt-0.5 block truncate text-[11px] ${hardIds.has(b.id) ? "text-danger" : "text-primary"}`}
                >
                  {b.ref}
                </Link>
              ))}
              {list.length > 3 ? (
                <p className="text-[10px] text-muted-foreground">+{list.length - 3}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
