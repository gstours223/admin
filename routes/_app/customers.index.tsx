import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankCompany } from "@/lib/crm/blank";
import { COMPANY_TYPES, type CompanyRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data, saveEntity, actor } = useCrm();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CompanyRecord | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.companies
      .filter((c) =>
        !s ? true : `${c.name} ${c.city} ${c.contactName} ${c.type}`.toLowerCase().includes(s),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.companies, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title="Customers"
        description="Toggle Private to relabel the name field and hide VAT entirely — on the form and on the printed invoice."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setDraft(blankCompany(actor));
              setOpen(true);
            }}
          >
            New customer
          </Button>
        }
      />
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
      {rows.length === 0 ? (
        <EmptyState title="No customers yet" />
      ) : (
        <DataTable columns={["Name", "Type", "City", "Contact", "Terms"]}>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link to="/customers/$id" params={{ id: c.id }} className="font-medium text-primary">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{c.type}</td>
              <td className="px-4 py-3">{c.city}</td>
              <td className="px-4 py-3">{c.contactName}</td>
              <td className="px-4 py-3">{c.termsDays}d</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <Field label="Type">
                <NativeSelect
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as CompanyRecord["type"] })}
                >
                  {COMPANY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={draft.type === "Private" ? "Full name" : "Company name"}>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!draft?.name.trim()) {
                  toast.error("A name is required.");
                  return;
                }
                const ok = await saveEntity("companies", draft);
                if (ok) {
                  setOpen(false);
                  void navigate({ to: "/customers/$id", params: { id: draft.id } });
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
