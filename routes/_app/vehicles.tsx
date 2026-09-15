import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankMaint, blankVehicle } from "@/lib/crm/blank";
import { formatDate, money, parseDate, todayIso } from "@/lib/crm/format";
import { MAINT_KINDS, VEHICLES, type VehicleRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/vehicles")({
  component: VehiclesPage,
});

function daysUntil(iso: string) {
  const d = parseDate(iso);
  if (!d) return null;
  const t = parseDate(todayIso())!;
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function dueTone(iso: string): "danger" | "warning" | "success" | "neutral" {
  const n = daysUntil(iso);
  if (n == null) return "neutral";
  if (n < 0) return "danger";
  if (n <= 30) return "warning";
  return "success";
}

function dueLabel(iso: string) {
  const n = daysUntil(iso);
  if (!iso) return "—";
  if (n == null) return formatDate(iso);
  if (n < 0) return `Overdue ${formatDate(iso)}`;
  if (n === 0) return "Today";
  if (n <= 30) return `${n}d · ${formatDate(iso)}`;
  return formatDate(iso);
}

function VehiclesPage() {
  const { data, saveEntity, removeEntity, actor } = useCrm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VehicleRecord | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.vehicles
      .filter((v) =>
        !s ? true : `${v.plate} ${v.make} ${v.model} ${v.kind} ${v.notes}`.toLowerCase().includes(s),
      )
      .sort((a, b) => a.plate.localeCompare(b.plate));
  }, [data.vehicles, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet"
        title="Vehicles"
        description="Plates, APK / MOT and insurance, plus a maintenance log for service, tyres, damage and repairs."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setDraft(blankVehicle(actor));
              setOpen(true);
            }}
          >
            New vehicle
          </Button>
        }
      />
      <Input placeholder="Search plate, make…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
      {rows.length === 0 ? (
        <EmptyState title="No vehicles yet" hint="Add a plate, then log APK dates and workshop visits." />
      ) : (
        <DataTable columns={["Plate", "Kind", "Make", "APK / MOT", "Insurance", ""]}>
          {rows.map((v) => (
            <tr key={v.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium tabular">{v.plate}</td>
              <td className="px-4 py-3">{v.kind}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {[v.make, v.model, v.year].filter(Boolean).join(" ")}
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={dueTone(v.motUntil)}>{dueLabel(v.motUntil)}</StatusBadge>
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={dueTone(v.insuranceUntil)}>{dueLabel(v.insuranceUntil)}</StatusBadge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(v);
                    setOpen(true);
                  }}
                >
                  Log
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete ${v.plate}? Maintenance history on this card goes with it.`))
                      void removeEntity("vehicles", v.id);
                  }}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft && data.vehicles.some((v) => v.id === draft.id)
                ? draft.plate || "Vehicle"
                : "New vehicle"}
            </DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Plate">
                  <Input
                    value={draft.plate}
                    onChange={(e) => setDraft({ ...draft, plate: e.target.value.toUpperCase() })}
                    className="tabular"
                  />
                </Field>
                <Field label="Kind">
                  <NativeSelect
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as VehicleRecord["kind"] })}
                  >
                    {VEHICLES.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Make">
                  <Input value={draft.make} onChange={(e) => setDraft({ ...draft, make: e.target.value })} />
                </Field>
                <Field label="Model">
                  <Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
                </Field>
                <Field label="Year">
                  <Input value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
                </Field>
                <Field label="APK / MOT until">
                  <Input
                    type="date"
                    value={draft.motUntil}
                    onChange={(e) => setDraft({ ...draft, motUntil: e.target.value })}
                  />
                </Field>
                <Field label="Insurance until">
                  <Input
                    type="date"
                    value={draft.insuranceUntil}
                    onChange={(e) => setDraft({ ...draft, insuranceUntil: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Field>

              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Maintenance
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft({ ...draft, log: [blankMaint(), ...draft.log] })}
                >
                  Add entry
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-1 pr-2">Date</th>
                      <th className="py-1 pr-2">Kind</th>
                      <th className="py-1 pr-2">Km</th>
                      <th className="py-1 pr-2">Workshop</th>
                      <th className="py-1 pr-2">Cost</th>
                      <th className="py-1"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.log || []).map((m, i) => (
                      <tr key={m.id} className="border-t border-border align-top">
                        <td className="py-2 pr-2">
                          <Input
                            type="date"
                            value={m.date}
                            onChange={(e) => {
                              const log = draft.log.slice();
                              log[i] = { ...m, date: e.target.value };
                              setDraft({ ...draft, log });
                            }}
                          />
                        </td>
                        <td className="w-32 py-2 pr-2">
                          <NativeSelect
                            value={m.kind}
                            onChange={(e) => {
                              const log = draft.log.slice();
                              log[i] = { ...m, kind: e.target.value as typeof m.kind };
                              setDraft({ ...draft, log });
                            }}
                          >
                            {MAINT_KINDS.map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="w-24 py-2 pr-2">
                          <Input
                            type="number"
                            value={m.km ?? ""}
                            onChange={(e) => {
                              const log = draft.log.slice();
                              log[i] = { ...m, km: e.target.value === "" ? null : Number(e.target.value) };
                              setDraft({ ...draft, log });
                            }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            value={m.vendor}
                            onChange={(e) => {
                              const log = draft.log.slice();
                              log[i] = { ...m, vendor: e.target.value };
                              setDraft({ ...draft, log });
                            }}
                          />
                        </td>
                        <td className="w-28 py-2 pr-2">
                          <Input
                            type="number"
                            value={m.cost || ""}
                            onChange={(e) => {
                              const log = draft.log.slice();
                              log[i] = { ...m, cost: Number(e.target.value) || 0 };
                              setDraft({ ...draft, log });
                            }}
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDraft({ ...draft, log: draft.log.filter((_, j) => j !== i) })}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(draft.log || []).length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Workshop spend on this card:{" "}
                  {money((draft.log || []).reduce((s, m) => s + (m.cost || 0), 0))}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!draft?.plate.trim()) {
                  toast.error("A plate is required.");
                  return;
                }
                const ok = await saveEntity("vehicles", draft);
                if (ok) {
                  toast.success("Vehicle saved.");
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
