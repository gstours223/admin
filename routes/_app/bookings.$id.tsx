import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Field, NativeSelect, PageHeader, Panel, SectionTitle } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blankInvoice } from "@/lib/crm/blank";
import { addDays, formatDateTime } from "@/lib/crm/format";
import {
  BOOKING_STATUSES,
  BRANDS,
  PAID_STATES,
  TRIP_TYPES,
  VEHICLES,
  type BookingRecord,
} from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";
import { nid } from "@/lib/utils";

export const Route = createFileRoute("/_app/bookings/$id")({
  component: BookingDetail,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const { data, saveEntity, removeEntity, nextRef, actor } = useCrm();
  const navigate = useNavigate();
  const found = data.bookings.find((b) => b.id === id);
  const [draft, setDraft] = useState<BookingRecord | null>(null);

  if (!found && !(draft && draft.id === id)) {
    return (
      <div>
        <p>That booking is not in this workspace.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/bookings">Back</Link>
        </Button>
      </div>
    );
  }
  const rec: BookingRecord = draft && draft.id === id ? draft : found!;

  const set = (patch: Partial<BookingRecord>) => setDraft({ ...rec, ...patch });

  async function toInvoice() {
    const number = await nextRef("invoice");
    if (!number) return;
    const company = data.companies.find((c) => c.name === rec.company);
    const inv = blankInvoice(actor, number);
    inv.company = rec.company;
    inv.contactName = rec.contactName;
    inv.billPrivate = company?.type === "Private";
    inv.address = company
      ? `${company.street}, ${company.postcode} ${company.city}`
      : "";
    inv.clientBtw = company?.vat || "";
    inv.sendTo = company?.invoiceEmail || "";
    inv.dueDate = addDays(inv.date, company?.termsDays ?? data.settings.termsDays);
    inv.reference = rec.reference;
    inv.lines = [
      {
        id: nid("ln"),
        date: rec.dates[0]?.date || "",
        desc: `${rec.tripType} · ${rec.from} → ${rec.to} · ${rec.pax} pax`,
        qty: 1,
        unitPrice: rec.amount,
        vat: data.settings.defaultVat,
      },
    ];
    const ok = await saveEntity("invoices", inv);
    if (!ok) return;
    await saveEntity("bookings", { ...rec, paid: "Invoiced" });
    toast.success(`Invoice ${number} drafted.`);
    void navigate({ to: "/invoices/$id", params: { id: inv.id } });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={rec.brand}
        title={rec.ref}
        description={rec.company}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void toInvoice()}>
              Create invoice
            </Button>
            <Button
              onClick={async () => {
                const ok = await saveEntity("bookings", rec);
                if (ok) {
                  toast.success("Booking saved.");
                  setDraft(null);
                }
              }}
            >
              Save
            </Button>
          </div>
        }
      />

      <Panel className="space-y-3">
        <SectionTitle>Trip</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Company">
            <Input value={rec.company} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <Field label="Status">
            <NativeSelect
              value={rec.status}
              onChange={(e) => set({ status: e.target.value as BookingRecord["status"] })}
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Trip type">
            <NativeSelect
              value={rec.tripType}
              onChange={(e) => set({ tripType: e.target.value as BookingRecord["tripType"] })}
            >
              {TRIP_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Brand">
            <NativeSelect
              value={rec.brand}
              onChange={(e) => set({ brand: e.target.value as BookingRecord["brand"] })}
            >
              {BRANDS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Contact">
            <Input value={rec.contactName} onChange={(e) => set({ contactName: e.target.value })} />
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
          <Field label="Return from">
            <Input value={rec.returnFrom} onChange={(e) => set({ returnFrom: e.target.value })} />
          </Field>
          <Field label="Pax">
            <Input
              type="number"
              value={rec.pax || ""}
              onChange={(e) => set({ pax: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Amount excl. VAT">
            <Input
              type="number"
              value={rec.amount || ""}
              onChange={(e) => set({ amount: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Paid">
            <NativeSelect
              value={rec.paid}
              onChange={(e) => set({ paid: e.target.value as BookingRecord["paid"] })}
            >
              {PAID_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Their reference">
            <Input value={rec.reference} onChange={(e) => set({ reference: e.target.value })} />
          </Field>
          <Field label="Group leader">
            <Input value={rec.groupLeader} onChange={(e) => set({ groupLeader: e.target.value })} />
          </Field>
          <Field label="Group leader phone">
            <Input value={rec.groupLeaderPhone} onChange={(e) => set({ groupLeaderPhone: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={rec.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </Panel>

      <Panel className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Dates</SectionTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set({
                dates: [
                  ...rec.dates,
                  { date: "", endDate: "", pickupTime: "08:00", returnTime: "18:00", note: "" },
                ],
              })
            }
          >
            Add date
          </Button>
        </div>
        {rec.dates.map((d, i) => (
          <div key={i} className="grid gap-2 rounded-md bg-muted/50 p-3 sm:grid-cols-5">
            <Field label="Date">
              <Input
                type="date"
                value={d.date}
                onChange={(e) => {
                  const dates = rec.dates.slice();
                  dates[i] = { ...d, date: e.target.value };
                  set({ dates });
                }}
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={d.endDate}
                onChange={(e) => {
                  const dates = rec.dates.slice();
                  dates[i] = { ...d, endDate: e.target.value };
                  set({ dates });
                }}
              />
            </Field>
            <Field label="Pickup">
              <Input
                type="time"
                value={d.pickupTime}
                onChange={(e) => {
                  const dates = rec.dates.slice();
                  dates[i] = { ...d, pickupTime: e.target.value };
                  set({ dates });
                }}
              />
            </Field>
            <Field label="Return">
              <Input
                type="time"
                value={d.returnTime}
                onChange={(e) => {
                  const dates = rec.dates.slice();
                  dates[i] = { ...d, returnTime: e.target.value };
                  set({ dates });
                }}
              />
            </Field>
            <Field label="Note">
              <Input
                value={d.note}
                onChange={(e) => {
                  const dates = rec.dates.slice();
                  dates[i] = { ...d, note: e.target.value };
                  set({ dates });
                }}
              />
            </Field>
          </div>
        ))}
      </Panel>

      <Panel className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Units</SectionTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set({
                units: [
                  ...rec.units,
                  {
                    vehicle: "Coach 50",
                    plate: "",
                    driver: "",
                    driver2: "",
                    pax: rec.pax,
                    cost: 0,
                    subcontractor: "",
                  },
                ],
              })
            }
          >
            Add unit
          </Button>
        </div>
        {rec.units.map((u, i) => (
          <div key={i} className="grid gap-2 rounded-md bg-muted/50 p-3 sm:grid-cols-4">
            <Field label="Vehicle">
              <NativeSelect
                value={u.vehicle}
                onChange={(e) => {
                  const units = rec.units.slice();
                  units[i] = { ...u, vehicle: e.target.value as (typeof VEHICLES)[number] };
                  set({ units });
                }}
              >
                {VEHICLES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Plate">
              <Input
                value={u.plate}
                onChange={(e) => {
                  const units = rec.units.slice();
                  units[i] = { ...u, plate: e.target.value };
                  set({ units });
                }}
              />
            </Field>
            <Field label="Driver">
              <Input
                value={u.driver}
                onChange={(e) => {
                  const units = rec.units.slice();
                  units[i] = { ...u, driver: e.target.value };
                  set({ units });
                }}
              />
            </Field>
            <Field label="Second driver">
              <Input
                value={u.driver2}
                onChange={(e) => {
                  const units = rec.units.slice();
                  units[i] = { ...u, driver2: e.target.value };
                  set({ units });
                }}
              />
            </Field>
            <Field label="Subcontractor">
              <Input
                value={u.subcontractor}
                onChange={(e) => {
                  const units = rec.units.slice();
                  units[i] = { ...u, subcontractor: e.target.value };
                  set({ units });
                }}
              />
            </Field>
            <Field label="Cost">
              <Input
                type="number"
                value={u.cost || ""}
                onChange={(e) => {
                  const units = rec.units.slice();
                  units[i] = { ...u, cost: Number(e.target.value) || 0 };
                  set({ units });
                }}
              />
            </Field>
          </div>
        ))}
      </Panel>

      <p className="text-xs text-muted-foreground">
        Last edited by {rec.updatedBy || "—"} · {rec.updatedAt ? formatDateTime(rec.updatedAt) : "not saved yet"}
      </p>
      <Button
        variant="destructive"
        onClick={async () => {
          if (!confirm(`Delete ${rec.ref}?`)) return;
          const ok = await removeEntity("bookings", rec.id);
          if (ok) void navigate({ to: "/bookings" });
        }}
      >
        Delete booking
      </Button>
    </div>
  );
}
