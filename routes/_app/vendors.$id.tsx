import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Field, NativeSelect, PageHeader, Panel, SectionTitle } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, money } from "@/lib/crm/format";
import {
  CONTACT_STATUSES,
  RATE_BASES,
  VENDOR_STANDING,
  VENDOR_TYPES,
  type VendorRecord,
} from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/vendors/$id")({
  component: VendorDetail,
});

function VendorDetail() {
  const { id } = Route.useParams();
  const { data, saveEntity, removeEntity } = useCrm();
  const navigate = useNavigate();
  const found = data.vendors.find((v) => v.id === id);
  const [draft, setDraft] = useState<VendorRecord | null>(null);
  const rec = draft && draft.id === id ? draft : found;

  if (!found || !rec) {
    return (
      <div>
        <p>That vendor is not in this workspace.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/vendors">Back</Link>
        </Button>
      </div>
    );
  }
  const set = (patch: Partial<VendorRecord>) => setDraft({ ...rec, ...patch });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={rec.type}
        title={rec.name}
        actions={
          <Button
            onClick={async () => {
              const ok = await saveEntity("vendors", rec);
              if (ok) {
                toast.success("Vendor saved.");
                setDraft(null);
              }
            }}
          >
            Save
          </Button>
        }
      />
      <Panel className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={rec.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Type">
            <NativeSelect value={rec.type} onChange={(e) => set({ type: e.target.value as VendorRecord["type"] })}>
              {VENDOR_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Standing">
            <NativeSelect
              value={rec.standing}
              onChange={(e) => set({ standing: e.target.value as VendorRecord["standing"] })}
            >
              {VENDOR_STANDING.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Contact status">
            <NativeSelect
              value={rec.contactStatus}
              onChange={(e) => set({ contactStatus: e.target.value as VendorRecord["contactStatus"] })}
            >
              {CONTACT_STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="City">
            <Input value={rec.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Street">
            <Input value={rec.street} onChange={(e) => set({ street: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={rec.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Invoice email">
            <Input value={rec.invoiceEmail} onChange={(e) => set({ invoiceEmail: e.target.value })} />
          </Field>
          <Field label="Contact">
            <Input value={rec.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="KvK">
            <Input value={rec.kvk} onChange={(e) => set({ kvk: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={rec.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </Panel>
      <Panel className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Rates</SectionTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set({
                rates: [...rec.rates, { service: "", basis: "Per day", price: 0, validUntil: "" }],
              })
            }
          >
            Add rate
          </Button>
        </div>
        {rec.rates.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-4">
            <Field label="Service">
              <Input
                value={r.service}
                onChange={(e) => {
                  const rates = rec.rates.slice();
                  rates[i] = { ...r, service: e.target.value };
                  set({ rates });
                }}
              />
            </Field>
            <Field label="Basis">
              <NativeSelect
                value={r.basis}
                onChange={(e) => {
                  const rates = rec.rates.slice();
                  rates[i] = { ...r, basis: e.target.value as (typeof RATE_BASES)[number] };
                  set({ rates });
                }}
              >
                {RATE_BASES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Price">
              <Input
                type="number"
                value={r.price}
                onChange={(e) => {
                  const rates = rec.rates.slice();
                  rates[i] = { ...r, price: Number(e.target.value) || 0 };
                  set({ rates });
                }}
              />
            </Field>
            <Field label="Valid until">
              <Input
                type="date"
                value={r.validUntil}
                onChange={(e) => {
                  const rates = rec.rates.slice();
                  rates[i] = { ...r, validUntil: e.target.value };
                  set({ rates });
                }}
              />
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-4">{money(r.price)}</p>
          </div>
        ))}
      </Panel>
      <p className="text-xs text-muted-foreground">
        Last edited by {rec.updatedBy || "—"} · {rec.updatedAt ? formatDateTime(rec.updatedAt) : "not saved yet"}
      </p>
      <Button
        variant="destructive"
        onClick={async () => {
          if (!confirm(`Delete ${rec.name}?`)) return;
          const ok = await removeEntity("vendors", rec.id);
          if (ok) void navigate({ to: "/vendors" });
        }}
      >
        Delete vendor
      </Button>
    </div>
  );
}
