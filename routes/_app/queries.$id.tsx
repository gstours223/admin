import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { QuoteDocument, printDocument } from "@/components/crm/document";
import { Field, NativeSelect, PageHeader, Panel, SectionTitle, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blankBooking, blankLog } from "@/lib/crm/blank";
import { addDays, formatDate, formatDateTime, STAGE_TONE } from "@/lib/crm/format";
import {
  BRANDS,
  LOG_CHANNELS,
  LOG_DIRECTIONS,
  LOST_REASONS,
  QUERY_SOURCES,
  QUERY_STAGES,
  VEHICLES,
  type QueryRecord,
} from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/queries/$id")({
  component: QueryDetail,
});

function QueryDetail() {
  const { id } = Route.useParams();
  const { data, saveEntity, removeEntity, nextRef, actor } = useCrm();
  const navigate = useNavigate();
  const found = data.queries.find((q) => q.id === id);
  const [local, setLocal] = useState<QueryRecord | null>(null);
  const [logNote, setLogNote] = useState("");
  const [logDir, setLogDir] = useState<(typeof LOG_DIRECTIONS)[number]>("Outgoing");
  const [logCh, setLogCh] = useState<(typeof LOG_CHANNELS)[number]>("Email");
  const [showQuote, setShowQuote] = useState(false);

  if (!found && !(local && local.id === id)) {
    return (
      <div className="space-y-3">
        <p>That query is not in this workspace.</p>
        <Button asChild variant="outline">
          <Link to="/queries">Back</Link>
        </Button>
      </div>
    );
  }
  const rec: QueryRecord = local && local.id === id ? local : found!;

  const set = (patch: Partial<QueryRecord>) => setLocal({ ...rec, ...patch });

  async function save() {
    const moved = rec.stage !== (found?.stage ?? rec.stage)
      ? { ...rec, moved: new Date().toISOString().slice(0, 10) }
      : rec;
    const ok = await saveEntity("queries", moved);
    if (ok) {
      toast.success("Query saved.");
      setLocal(null);
    }
  }

  async function addLog() {
    if (!logNote.trim()) return;
    const entry = { ...blankLog(), direction: logDir, channel: logCh, note: logNote.trim() };
    const next = { ...rec, log: [entry, ...rec.log] };
    const ok = await saveEntity("queries", next);
    if (ok) {
      setLogNote("");
      setLocal(next);
      toast.success("Log entry added. Past entries cannot be edited.");
    }
  }

  async function deleteLog(entryId: string) {
    if (!confirm("Delete this log entry? Only this line will go.")) return;
    const next = { ...rec, log: rec.log.filter((l) => l.id !== entryId) };
    const ok = await saveEntity("queries", next);
    if (ok) setLocal(next);
  }

  async function toBooking() {
    const ref = await nextRef("booking");
    if (!ref) return;
    const b = blankBooking(actor, ref);
    b.brand = rec.brand;
    b.company = rec.company;
    b.contactName = rec.contactName;
    b.contactPhone = rec.contactPhone;
    b.from = rec.from;
    b.to = rec.to;
    b.pax = rec.pax;
    b.amount = rec.amount;
    b.dates = [{ date: rec.tripDate, endDate: rec.tripDate, pickupTime: "08:00", returnTime: "18:00", note: "" }];
    b.units = [{ vehicle: rec.vehicle, plate: "", driver: "", driver2: "", pax: rec.pax, cost: 0, subcontractor: "" }];
    const ok = await saveEntity("bookings", b);
    if (!ok) return;
    await saveEntity("queries", { ...rec, stage: "Won", moved: new Date().toISOString().slice(0, 10) });
    toast.success(`Booking ${ref} created.`);
    void navigate({ to: "/bookings/$id", params: { id: b.id } });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={rec.brand}
        title={rec.ref}
        description={`${rec.company} · ${rec.from} → ${rec.to}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowQuote((v) => !v)}>
              {showQuote ? "Hide quote" : "Quote PDF"}
            </Button>
            <Button variant="outline" onClick={() => void toBooking()}>
              Create booking
            </Button>
            <Button onClick={() => void save()}>Save</Button>
          </div>
        }
      />

      {showQuote ? (
        <div className="space-y-3">
          <Button variant="brand" onClick={printDocument}>
            Print / save PDF
          </Button>
          <QuoteDocument
            query={rec}
            settings={data.settings}
            validUntil={addDays(rec.created || rec.tripDate, 14)}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-3 lg:col-span-2">
          <SectionTitle>Enquiry</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company">
              <Input value={rec.company} onChange={(e) => set({ company: e.target.value })} />
            </Field>
            <Field label="Stage">
              <NativeSelect
                value={rec.stage}
                onChange={(e) => set({ stage: e.target.value as QueryRecord["stage"] })}
              >
                {QUERY_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            {rec.stage === "Lost" ? (
              <Field label="Lost reason">
                <NativeSelect
                  value={rec.lostReason}
                  onChange={(e) => set({ lostReason: e.target.value as QueryRecord["lostReason"] })}
                >
                  <option value="">Select…</option>
                  {LOST_REASONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field label="Brand">
              <NativeSelect
                value={rec.brand}
                onChange={(e) => set({ brand: e.target.value as QueryRecord["brand"] })}
              >
                {BRANDS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Source">
              <NativeSelect
                value={rec.source}
                onChange={(e) => set({ source: e.target.value as QueryRecord["source"] })}
              >
                {QUERY_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Contact">
              <Input value={rec.contactName} onChange={(e) => set({ contactName: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={rec.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={rec.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
            </Field>
            <Field label="From">
              <Input value={rec.from} onChange={(e) => set({ from: e.target.value })} />
            </Field>
            <Field label="To">
              <Input value={rec.to} onChange={(e) => set({ to: e.target.value })} />
            </Field>
            <Field label="Trip date">
              <Input type="date" value={rec.tripDate} onChange={(e) => set({ tripDate: e.target.value })} />
            </Field>
            <Field label="Pax">
              <Input
                type="number"
                value={rec.pax || ""}
                onChange={(e) => set({ pax: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Vehicle">
              <NativeSelect
                value={rec.vehicle}
                onChange={(e) => set({ vehicle: e.target.value as QueryRecord["vehicle"] })}
              >
                {VEHICLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Amount excl. VAT">
              <Input
                type="number"
                value={rec.amount || ""}
                onChange={(e) => set({ amount: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Owner">
              <Input value={rec.owner} onChange={(e) => set({ owner: e.target.value })} />
            </Field>
            <Field label="Next action">
              <Input value={rec.nextAction} onChange={(e) => set({ nextAction: e.target.value })} />
            </Field>
            <Field label="Next action date">
              <Input
                type="date"
                value={rec.nextActionDate}
                onChange={(e) => set({ nextActionDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={rec.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
          <p className="text-xs text-muted-foreground">
            Last edited by {rec.updatedBy || "—"} · {rec.updatedAt ? formatDateTime(rec.updatedAt) : "not saved yet"}
          </p>
        </Panel>

        <Panel>
          <SectionTitle>Contact log</SectionTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Append-only. Newest first. You can delete a wrong line; you cannot edit history.
          </p>
          <div className="mt-3 space-y-2">
            <NativeSelect value={logDir} onChange={(e) => setLogDir(e.target.value as typeof logDir)}>
              {LOG_DIRECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
            <NativeSelect value={logCh} onChange={(e) => setLogCh(e.target.value as typeof logCh)}>
              {LOG_CHANNELS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
            <Textarea
              placeholder="What was said or sent…"
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
            />
            <Button size="sm" onClick={() => void addLog()}>
              Add entry
            </Button>
          </div>
          <ul className="mt-4 space-y-3">
            {rec.log.map((l) => (
              <li key={l.id} className="rounded-md bg-muted/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {formatDate(l.date)} · {l.direction} · {l.channel}
                  </span>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    onClick={() => void deleteLog(l.id)}
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-1 text-sm">{l.note}</p>
              </li>
            ))}
            {rec.log.length === 0 ? (
              <li className="text-sm text-muted-foreground">No entries yet.</li>
            ) : null}
          </ul>
        </Panel>
      </div>

      <div className="flex items-center justify-between">
        <StatusBadge tone={STAGE_TONE[rec.stage]}>{rec.stage}</StatusBadge>
        <Button
          variant="destructive"
          onClick={async () => {
            if (!confirm(`Delete ${rec.ref}? The audit log will keep a snapshot.`)) return;
            const ok = await removeEntity("queries", rec.id);
            if (ok) void navigate({ to: "/queries" });
          }}
        >
          Delete query
        </Button>
      </div>
    </div>
  );
}
