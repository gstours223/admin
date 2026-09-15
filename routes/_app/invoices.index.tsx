import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankInvoice } from "@/lib/crm/blank";
import { addDays, INVOICE_TONE, formatDate, invoiceTotals, liveInvoiceStatus, money } from "@/lib/crm/format";
import { isPrivateCompany } from "@/lib/crm/logic";
import { INVOICE_STATUSES, type InvoiceRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/invoices/")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const { data, saveEntity, nextRef, actor } = useCrm();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.invoices
      .filter((i) => {
        const live = liveInvoiceStatus(i.status, i.dueDate, i.type);
        if (status === "All") return true;
        return live === status || i.status === status;
      })
      .filter((i) => (!s ? true : `${i.number} ${i.company} ${i.reference}`.toLowerCase().includes(s)))
      .sort((a, b) => b.number.localeCompare(a.number));
  }, [data.invoices, q, status]);

  async function create() {
    const number = await nextRef("invoice");
    if (!number) return;
    const rec = blankInvoice(actor, number);
    const c = data.companies.find((x) => x.name === company);
    rec.company = company;
    rec.contactName = c?.contactName || "";
    rec.address = c ? `${c.street}, ${c.postcode} ${c.city}` : "";
    rec.clientBtw = c?.vat || "";
    rec.billPrivate = isPrivateCompany(c);
    rec.sendTo = c?.invoiceEmail || "";
    rec.dueDate = addDays(rec.date, c?.termsDays ?? data.settings.termsDays);
    if (!company.trim()) {
      toast.error("Pick a customer.");
      return;
    }
    const ok = await saveEntity("invoices", rec);
    if (ok) {
      setOpen(false);
      void navigate({ to: "/invoices/$id", params: { id: rec.id } });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        description="Lines always print in date order. Overdue is derived, never stored. Private individuals never see a VAT-number field."
        actions={
          <Button variant="brand" onClick={() => setOpen(true)}>
            New invoice
          </Button>
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search number or customer…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="bg-card sm:w-44">
          <option>All</option>
          <option>Overdue</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No invoices in this view" />
      ) : (
        <DataTable columns={["Number", "Customer", "Date", "Due", "Status", "Total", "Paid"]}>
          {rows.map((i) => {
            const live = liveInvoiceStatus(i.status, i.dueDate, i.type);
            const t = invoiceTotals(i.lines);
            return (
              <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link to="/invoices/$id" params={{ id: i.id }} className="font-medium text-primary">
                    {i.number}
                    {i.type === "credit" ? " · CN" : ""}
                  </Link>
                </td>
                <td className="px-4 py-3">{i.company}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(i.date)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(i.dueDate)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={INVOICE_TONE[live]}>{live}</StatusBadge>
                </td>
                <td className="px-4 py-3 tabular">{money(t.gross)}</td>
                <td className="px-4 py-3 tabular">{money(i.amountPaid || 0)}</td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
          </DialogHeader>
          <Field label="Customer">
            <Input list="inv-cos" value={company} onChange={(e) => setCompany(e.target.value)} />
            <datalist id="inv-cos">
              {data.companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
          <DialogFooter>
            <Button onClick={() => void create()}>Create draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
