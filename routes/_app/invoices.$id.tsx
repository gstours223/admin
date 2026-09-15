import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { InvoiceDocument, printDocument } from "@/components/crm/document";
import { EmbassyCalculator } from "@/components/crm/embassy";
import { Field, NativeSelect, PageHeader, Panel, SectionTitle } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { blankInvoice, blankLine } from "@/lib/crm/blank";
import { formatDateTime, interpolate, invoiceTotals, liveInvoiceStatus, money, todayIso } from "@/lib/crm/format";
import { isEmbassyCompany, isPrivateCompany, sortInvoiceLines } from "@/lib/crm/logic";
import { renderInvoicePdf, sendInvoiceMail } from "@/lib/crm/server";
import { INVOICE_STATUSES, VAT_RATES, type InvoiceLine, type InvoiceRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/invoices/$id")({
  component: InvoiceDetail,
});

function downloadBase64Pdf(b64: string, filename: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { data, saveEntity, removeEntity, nextRef, actor, reload } = useCrm();
  const navigate = useNavigate();
  const found = data.invoices.find((i) => i.id === id);
  const [draft, setDraft] = useState<InvoiceRecord | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendKind, setSendKind] = useState<"invoice" | "reminder">("invoice");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (!found && !(draft && draft.id === id)) {
    return (
      <div>
        <p>That invoice is not in this workspace.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/invoices">Back</Link>
        </Button>
      </div>
    );
  }
  const rec: InvoiceRecord = draft && draft.id === id ? draft : found!;

  const company = data.companies.find((c) => c.name === rec.company);
  const privateBill = rec.billPrivate || isPrivateCompany(company);
  const embassy = isEmbassyCompany(rec.company);
  const totals = invoiceTotals(rec.lines);
  const live = liveInvoiceStatus(rec.status, rec.dueDate, rec.type);

  const vars = {
    number: rec.number,
    company: rec.company,
    contact: rec.contactName || rec.company,
    due: rec.dueDate,
    signature: data.settings.signature,
  };
  const mailPreview = interpolate(data.settings.mailInvoice, vars);

  const set = (patch: Partial<InvoiceRecord>) => setDraft({ ...rec, ...patch });

  function setLine(i: number, patch: Partial<InvoiceLine>) {
    const lines = rec.lines.slice();
    lines[i] = { ...lines[i], ...patch };
    set({ lines });
  }

  function addLines(extra: InvoiceLine[]) {
    set({ lines: [...rec.lines, ...extra] });
  }

  function openSend(kind: "invoice" | "reminder") {
    setSendKind(kind);
    setSendTo(rec.sendTo || company?.invoiceEmail || "");
    setSendSubject(
      interpolate(kind === "reminder" ? data.settings.mailReminderSubject : data.settings.mailInvoiceSubject, vars),
    );
    setSendBody(interpolate(kind === "reminder" ? data.settings.mailReminder : data.settings.mailInvoice, vars));
    setSendOpen(true);
  }

  async function persistIfDirty() {
    if (!(draft && draft.id === rec.id)) return true;
    const ok = await saveEntity("invoices", rec);
    if (ok) setDraft(null);
    return ok;
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      if (!(await persistIfDirty())) return;
      const res = await renderInvoicePdf({ data: { id: rec.id } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      downloadBase64Pdf(res.pdfBase64, res.filename);
    } finally {
      setPdfBusy(false);
    }
  }

  async function sendNow() {
    setSending(true);
    try {
      if (!(await persistIfDirty())) return;
      const res = await sendInvoiceMail({
        data: { id: rec.id, to: sendTo, subject: sendSubject, body: sendBody, kind: sendKind },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.sent) {
        toast.success(`Invoice emailed to ${sendTo}.`);
        setSendOpen(false);
        await reload();
        return;
      }
      downloadBase64Pdf(res.pdfBase64, res.filename);
      toast.error(res.error);
      window.location.href = res.mailto;
    } finally {
      setSending(false);
    }
  }

  async function creditNote() {
    const number = await nextRef("invoice");
    if (!number) return;
    const cn = blankInvoice(actor, number);
    cn.type = "credit";
    cn.originalId = rec.id;
    cn.status = "Credited";
    cn.company = rec.company;
    cn.contactName = rec.contactName;
    cn.address = rec.address;
    cn.clientBtw = rec.clientBtw;
    cn.billPrivate = rec.billPrivate;
    cn.reference = `Credit against ${rec.number}`;
    cn.lines = rec.lines.map((l) => ({ ...l, id: l.id + "-c", unitPrice: -Math.abs(l.unitPrice) }));
    const ok = await saveEntity("invoices", cn);
    if (!ok) return;
    await saveEntity("invoices", { ...rec, status: "Credited" });
    toast.success(`Credit note ${number} created.`);
    void navigate({ to: "/invoices/$id", params: { id: cn.id } });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={rec.type === "credit" ? "Credit note" : "Invoice"}
        title={rec.number}
        description={`${rec.company} · ${live}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowPdf((v) => !v)}>
              {showPdf ? "Hide PDF" : "Preview PDF"}
            </Button>
            <Button variant="outline" onClick={() => void downloadPdf()} disabled={pdfBusy}>
              {pdfBusy ? "Building…" : "Download PDF"}
            </Button>
            {rec.type === "normal" ? (
              <>
                <Button variant="brand" onClick={() => openSend("invoice")}>
                  Send to client
                </Button>
                <Button variant="outline" onClick={() => openSend("reminder")}>
                  Reminder
                </Button>
                <Button variant="outline" onClick={() => void creditNote()}>
                  Credit note
                </Button>
              </>
            ) : null}
            <Button
              onClick={async () => {
                const ok = await saveEntity("invoices", rec);
                if (ok) {
                  toast.success("Invoice saved. Lines stored in date order.");
                  setDraft(null);
                }
              }}
            >
              Save
            </Button>
          </div>
        }
      />

      {showPdf ? (
        <div className="space-y-3">
          <Button variant="brand" onClick={printDocument}>
            Print / save PDF
          </Button>
          <InvoiceDocument invoice={{ ...rec, billPrivate: privateBill }} settings={data.settings} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-3 lg:col-span-2">
          <SectionTitle>Bill to</SectionTitle>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rec.billPrivate}
              onChange={(e) => set({ billPrivate: e.target.checked })}
            />
            Private individual — hide VAT number
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={privateBill ? "Full name" : "Company or organisation"}>
              <Input
                list="inv-cos-d"
                value={rec.company}
                onChange={(e) => {
                  const name = e.target.value;
                  const c = data.companies.find((x) => x.name === name);
                  set({
                    company: name,
                    billPrivate: rec.billPrivate || isPrivateCompany(c),
                    contactName: c?.contactName || rec.contactName,
                    address: c ? `${c.street}, ${c.postcode} ${c.city}` : rec.address,
                    clientBtw: c?.vat || rec.clientBtw,
                    sendTo: c?.invoiceEmail || rec.sendTo,
                  });
                }}
              />
              <datalist id="inv-cos-d">
                {data.companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Contact">
              <Input value={rec.contactName} onChange={(e) => set({ contactName: e.target.value })} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea value={rec.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            {privateBill ? null : (
              <Field label="Client VAT">
                <Input value={rec.clientBtw} onChange={(e) => set({ clientBtw: e.target.value })} />
              </Field>
            )}
            <Field label="Send to">
              <Input value={rec.sendTo} onChange={(e) => set({ sendTo: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={rec.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={rec.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={rec.status}
                onChange={(e) => set({ status: e.target.value as InvoiceRecord["status"] })}
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Reference">
              <Input value={rec.reference} onChange={(e) => set({ reference: e.target.value })} />
            </Field>
            <Field label="Amount paid">
              <Input
                type="number"
                value={rec.amountPaid || ""}
                onChange={(e) => set({ amountPaid: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Paid date">
              <Input type="date" value={rec.paidDate} onChange={(e) => set({ paidDate: e.target.value })} />
            </Field>
          </div>
        </Panel>
        <Panel>
          <SectionTitle>Totals</SectionTitle>
          {totals ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Net</dt>
                <dd className="tabular">{money(totals.net)}</dd>
              </div>
              {totals.buckets.map((b) => (
                <div key={b.vat} className="flex justify-between">
                  <dt className="text-muted-foreground">{b.label}</dt>
                  <dd className="tabular">{b.vat === "verlegd" ? "—" : money(b.vatAmount)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-display text-2xl text-primary">
                <dt>Gross</dt>
                <dd className="tabular">{money(totals.gross)}</dd>
              </div>
              <p className="pt-2 text-xs text-muted-foreground">Live status: {live} (Overdue is never stored)</p>
            </dl>
          ) : null}
          <div className="mt-4 rounded-md bg-muted/60 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
            <p className="font-medium text-foreground">Mail preview</p>
            {mailPreview}
          </div>
          {(rec.sent ?? []).length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Sent log</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {(rec.sent ?? []).slice().reverse().map((s, i) => (
                  <li key={s.at + i}>
                    {formatDateTime(s.at)} · {s.kind} · {s.to} · {s.via}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>

      {embassy ? (
        <EmbassyCalculator defaultVat={data.settings.defaultVat} onAdd={addLines} />
      ) : null}

      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Lines</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addLines([
                  {
                    ...blankLine(data.settings.defaultVat),
                    date: todayIso(),
                    desc: "Extra hours",
                    qty: 1,
                    unitPrice: company?.extraHourRate || 0,
                  },
                ])
              }
            >
              + Extra hours
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addLines([
                  {
                    ...blankLine(data.settings.defaultVat),
                    date: todayIso(),
                    desc: "Extra kilometres",
                    qty: 1,
                    unitPrice: company?.extraKmRate || 0,
                  },
                ])
              }
            >
              + Extra km
            </Button>
            <Button size="sm" variant="outline" onClick={() => addLines([blankLine(data.settings.defaultVat)])}>
              Add line
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Displayed in entry order here; saved and printed in date order, undated lines last.
          Extra hours / km use this customer’s stored rates
          {company?.extraHourRate || company?.extraKmRate
            ? ` (${company.extraHourRate ? `€${company.extraHourRate}/h` : ""}${company.extraHourRate && company.extraKmRate ? ", " : ""}${company.extraKmRate ? `€${company.extraKmRate}/km` : ""}).`
            : " — set them on the customer record so the price fills in."}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 pr-2">Qty</th>
                <th className="py-2 pr-2">Unit</th>
                <th className="py-2 pr-2">VAT</th>
                <th className="py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {rec.lines.map((l, i) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="py-2 pr-2">
                    <Input type="date" value={l.date} onChange={(e) => setLine(i, { date: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2">
                    <Input value={l.desc} onChange={(e) => setLine(i, { desc: e.target.value })} />
                  </td>
                  <td className="w-20 py-2 pr-2">
                    <Input
                      type="number"
                      value={l.qty}
                      onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="w-28 py-2 pr-2">
                    <Input
                      type="number"
                      value={l.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="w-28 py-2 pr-2">
                    <NativeSelect
                      value={l.vat}
                      onChange={(e) => setLine(i, { vat: e.target.value as InvoiceLine["vat"] })}
                    >
                      {VAT_RATES.map((v) => (
                        <option key={v} value={v}>
                          {v === "verlegd" ? "Reverse-charged" : `${v}%`}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => set({ lines: rec.lines.filter((_, j) => j !== i) })}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Print order: {sortInvoiceLines(rec.lines).map((l) => l.date || "undated").join(" → ")}
        </p>
      </Panel>

      <p className="text-xs text-muted-foreground">
        Last edited by {rec.updatedBy || "—"} · {rec.updatedAt ? formatDateTime(rec.updatedAt) : "not saved yet"}
      </p>
      <Button
        variant="destructive"
        onClick={async () => {
          if (!confirm(`Delete ${rec.number}?`)) return;
          const ok = await removeEntity("invoices", rec.id);
          if (ok) void navigate({ to: "/invoices" });
        }}
      >
        Delete invoice
      </Button>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{sendKind === "reminder" ? "Send reminder" : "Send invoice"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {data.settings.smtpConfigured
                ? "Will send from your Hostinger mailbox with the PDF attached."
                : "SMTP is not configured yet. We’ll still build the PDF, download it, and open a mail draft so you can attach it yourself. Add the mailbox password in Settings to send directly."}
            </p>
            <Field label="To">
              <Input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
            </Field>
            <Field label="Subject">
              <Input value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            </Field>
            <Field label="Message">
              <Textarea rows={8} value={sendBody} onChange={(e) => setSendBody(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void sendNow()} disabled={sending}>
              {sending ? "Sending…" : data.settings.smtpConfigured ? "Send" : "Download PDF & open mail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
