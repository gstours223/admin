import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, PageHeader, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankDriver, blankHours } from "@/lib/crm/blank";
import { parseDate, todayIso } from "@/lib/crm/format";
import type { DriverHoursEntry, DriverRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/drivers")({
  component: DriversPage,
});

function hoursSpan(start: string, end: string) {
  const toMin = (t: string) => {
    const [h, m] = (t || "0:0").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let diff = toMin(end) - toMin(start);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function isoWeekKey(iso: string) {
  const d = parseDate(iso);
  if (!d) return iso || "—";
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function thisWeekKey() {
  return isoWeekKey(todayIso());
}

function weekHours(hours: DriverHoursEntry[]) {
  const map = new Map<string, number>();
  for (const h of hours) {
    const key = isoWeekKey(h.date);
    map.set(key, (map.get(key) || 0) + hoursSpan(h.start, h.end));
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function fmtHours(n: number) {
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function DriversPage() {
  const { data, saveEntity, removeEntity, actor } = useCrm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DriverRecord | null>(null);
  const currentWeek = thisWeekKey();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.drivers
      .filter((d) => (!s ? true : `${d.name} ${d.phone} ${d.email} ${d.license}`.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.drivers, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Drivers"
        description="Working hours per chauffeur. Totals roll up by ISO week — overnight shifts count through midnight."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setDraft(blankDriver(actor));
              setOpen(true);
            }}
          >
            New driver
          </Button>
        }
      />
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
      {rows.length === 0 ? (
        <EmptyState title="No drivers yet" hint="Add a chauffeur, then log the hours against bookings and vehicles." />
      ) : (
        <DataTable columns={["Name", "Phone", "Licence", "This week", "Hours logged", ""]}>
          {rows.map((d) => {
            const weeks = weekHours(d.hours || []);
            const thisW = weeks.find(([k]) => k === currentWeek)?.[1] || 0;
            const total = (d.hours || []).reduce((s, h) => s + hoursSpan(h.start, h.end), 0);
            return (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d.phone}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.license}</td>
                <td className="px-4 py-3 tabular">{fmtHours(thisW)}</td>
                <td className="px-4 py-3 tabular">{fmtHours(total)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(d);
                      setOpen(true);
                    }}
                  >
                    Hours
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete ${d.name}? Hours on this card go with it.`)) void removeEntity("drivers", d.id);
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft && data.drivers.some((d) => d.id === draft.id) ? draft.name || "Driver" : "New driver"}
            </DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </Field>
                <Field label="Licence">
                  <Input
                    value={draft.license}
                    onChange={(e) => setDraft({ ...draft, license: e.target.value })}
                    placeholder="B / D1 / D"
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Field>

              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Working hours
                </p>
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, hours: [blankHours(), ...draft.hours] })}>
                  Add shift
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-1 pr-2">Date</th>
                      <th className="py-1 pr-2">Start</th>
                      <th className="py-1 pr-2">End</th>
                      <th className="py-1 pr-2">Hours</th>
                      <th className="py-1 pr-2">Booking</th>
                      <th className="py-1 pr-2">Vehicle</th>
                      <th className="py-1"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.hours || []).map((h, i) => (
                      <tr key={h.id} className="border-t border-border align-top">
                        <td className="py-2 pr-2">
                          <Input
                            type="date"
                            value={h.date}
                            onChange={(e) => {
                              const hours = draft.hours.slice();
                              hours[i] = { ...h, date: e.target.value };
                              setDraft({ ...draft, hours });
                            }}
                          />
                        </td>
                        <td className="w-28 py-2 pr-2">
                          <Input
                            type="time"
                            value={h.start}
                            onChange={(e) => {
                              const hours = draft.hours.slice();
                              hours[i] = { ...h, start: e.target.value };
                              setDraft({ ...draft, hours });
                            }}
                          />
                        </td>
                        <td className="w-28 py-2 pr-2">
                          <Input
                            type="time"
                            value={h.end}
                            onChange={(e) => {
                              const hours = draft.hours.slice();
                              hours[i] = { ...h, end: e.target.value };
                              setDraft({ ...draft, hours });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-2 tabular text-muted-foreground">
                          {fmtHours(hoursSpan(h.start, h.end))}
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            list="dr-bookings"
                            value={h.bookingRef}
                            onChange={(e) => {
                              const hours = draft.hours.slice();
                              hours[i] = { ...h, bookingRef: e.target.value };
                              setDraft({ ...draft, hours });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            list="dr-plates"
                            value={h.vehicle}
                            onChange={(e) => {
                              const hours = draft.hours.slice();
                              hours[i] = { ...h, vehicle: e.target.value };
                              setDraft({ ...draft, hours });
                            }}
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDraft({ ...draft, hours: draft.hours.filter((_, j) => j !== i) })}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="dr-bookings">
                {data.bookings.map((b) => (
                  <option key={b.id} value={b.ref} />
                ))}
              </datalist>
              <datalist id="dr-plates">
                {data.vehicles.map((v) => (
                  <option key={v.id} value={v.plate} />
                ))}
              </datalist>

              <div className="flex flex-wrap gap-2">
                {weekHours(draft.hours || [])
                  .slice(0, 8)
                  .map(([week, hrs]) => (
                    <StatusBadge key={week} tone={week === currentWeek ? "brand" : "neutral"}>
                      {week} · {fmtHours(hrs)}
                    </StatusBadge>
                  ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!draft?.name.trim()) {
                  toast.error("A name is required.");
                  return;
                }
                const ok = await saveEntity("drivers", draft);
                if (ok) {
                  toast.success("Driver saved.");
                  setOpen(false);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
