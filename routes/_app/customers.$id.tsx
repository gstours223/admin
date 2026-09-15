import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Field, NativeSelect, PageHeader, Panel, SectionTitle } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/crm/format";
import { COMPANY_TYPES, type CompanyRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/customers/$id")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { data, saveEntity, removeEntity } = useCrm();
  const navigate = useNavigate();
  const found = data.companies.find((c) => c.id === id);
  const [draft, setDraft] = useState<CompanyRecord | null>(null);
  const rec = draft && draft.id === id ? draft : found;
  const isPrivate = rec?.type === "Private";

  if (!found || !rec) {
    return (
      <div>
        <p>That customer is not in this workspace.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/customers">Back</Link>
        </Button>
      </div>
    );
  }

  const set = (patch: Partial<CompanyRecord>) => setDraft({ ...rec, ...patch });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={rec.type}
        title={rec.name}
        actions={
          <Button
            onClick={async () => {
              const ok = await saveEntity("companies", rec);
              if (ok) {
                toast.success("Customer saved.");
                setDraft(null);
              }
            }}
          >
            Save
          </Button>
        }
      />
      <Panel className="space-y-3">
        <SectionTitle>Details</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={!isPrivate ? "default" : "outline"}
            onClick={() => set({ type: rec.type === "Private" ? "Corporate" : rec.type })}
          >
            Company or organisation
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isPrivate ? "default" : "outline"}
            onClick={() => set({ type: "Private", vat: "", kvk: "" })}
          >
            Private individual
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Private billing hides the VAT number here and on the printed invoice — it is not left blank.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {isPrivate ? null : (
            <Field label="Type">
              <NativeSelect
                value={rec.type}
                onChange={(e) => set({ type: e.target.value as CompanyRecord["type"] })}
              >
                {COMPANY_TYPES.filter((t) => t !== "Private").map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label={isPrivate ? "Full name" : "Company name"}>
            <Input value={rec.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Street">
            <Input value={rec.street} onChange={(e) => set({ street: e.target.value })} />
          </Field>
          <Field label="Postcode">
            <Input value={rec.postcode} onChange={(e) => set({ postcode: e.target.value })} />
          </Field>
          <Field label="City">
            <Input value={rec.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={rec.country} onChange={(e) => set({ country: e.target.value })} />
          </Field>
          {isPrivate ? null : (
            <>
              <Field label="VAT">
                <Input value={rec.vat} onChange={(e) => set({ vat: e.target.value })} />
              </Field>
              <Field label="KvK">
                <Input value={rec.kvk} onChange={(e) => set({ kvk: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Terms (days)">
            <Input
              type="number"
              value={rec.termsDays}
              onChange={(e) => set({ termsDays: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Invoice email">
            <Input value={rec.invoiceEmail} onChange={(e) => set({ invoiceEmail: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={rec.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Contact name">
            <Input value={rec.contactName} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="Extra hour rate (excl. VAT)" hint="Used by + Extra hours on invoices">
            <Input
              type="number"
              value={rec.extraHourRate ?? ""}
              onChange={(e) =>
                set({ extraHourRate: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Extra km rate (excl. VAT)" hint="Used by + Extra km on invoices">
            <Input
              type="number"
              value={rec.extraKmRate ?? ""}
              onChange={(e) =>
                set({ extraKmRate: e.target.value === "" ? null : Number(e.target.value) })
              }
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
      <Button
        variant="destructive"
        onClick={async () => {
          if (!confirm(`Delete ${rec.name}?`)) return;
          const ok = await removeEntity("companies", rec.id);
          if (ok) void navigate({ to: "/customers" });
        }}
      >
        Delete customer
      </Button>
    </div>
  );
}
