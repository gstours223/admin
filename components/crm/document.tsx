import { formatDate, invoiceTotals, liveInvoiceStatus, money, vatLabel } from "@/lib/crm/format";
import { sortInvoiceLines } from "@/lib/crm/logic";
import { QUOTE_TERMS } from "@/lib/crm/terms";
import type { InvoiceRecord, QueryRecord, SettingsRecord } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

type Kind = "invoice" | "quote";

function watermarkLabel(status: ReturnType<typeof liveInvoiceStatus>, type: InvoiceRecord["type"]) {
  if (type === "credit") return "CREDIT NOTE";
  if (status === "Draft" || status === "Sent") return "";
  if (status === "Paid") return "PAID";
  if (status === "Overdue") return "OVERDUE";
  if (status === "Partly paid") return "PART PAID";
  if (status === "Disputed") return "DISPUTED";
  if (status === "Written off") return "WRITTEN OFF";
  if (status === "Credited") return "CREDITED";
  return "";
}

function Letterhead({
  settings,
  title,
  credit,
}: {
  settings: SettingsRecord;
  title: string;
  credit?: boolean;
}) {
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-t-[2px]">
        <span className="w-28 bg-brand" />
        <span className="flex-1 bg-primary" />
      </div>
      <div className="flex items-start justify-between gap-6 px-1 pt-5">
        <div className="flex min-w-0 items-start gap-4">
          <img
            src="/logo.jpg"
            alt=""
            className="h-16 w-auto shrink-0 object-contain sm:h-[4.5rem]"
          />
          <div className="min-w-0">
            <p className="font-display text-3xl font-semibold tracking-wide text-primary">
              {settings.tradingName || settings.legalName}
            </p>
            <p className="mt-0.5 text-xs font-medium tracking-wide text-brand uppercase">
              {settings.tagline}
            </p>
            <p className="mt-2 text-sm font-semibold text-primary underline decoration-brand decoration-2 underline-offset-4">
              {settings.website}
            </p>
          </div>
        </div>
        <p
          className={cn(
            "font-display text-3xl font-semibold tracking-[0.18em] text-primary uppercase",
            credit && "text-danger",
          )}
        >
          {title}
        </p>
      </div>
    </div>
  );
}

function PartyBlock({
  leftLabel,
  left,
  settings,
  meta,
  hideVat,
}: {
  leftLabel: string;
  left: { name: string; address: string; contact?: string; vat?: string };
  settings: SettingsRecord;
  meta: { label: string; value: string }[];
  hideVat?: boolean;
}) {
  const kvkLine = [
    settings.kvk ? `KvK ${settings.kvk}` : "",
    hideVat || !settings.btw ? "" : `VAT ${settings.btw}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      <div>
        <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{leftLabel}</p>
        <p className="mt-1 font-medium">{left.name}</p>
        {left.contact ? <p className="text-sm text-muted-foreground">{left.contact}</p> : null}
        <p className="whitespace-pre-line text-sm text-muted-foreground">{left.address}</p>
        {left.vat && !hideVat ? (
          <p className="text-sm text-muted-foreground">VAT {left.vat}</p>
        ) : null}
      </div>
      <div className="sm:text-right">
        <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">From</p>
        <p className="mt-1 font-medium">{settings.legalName}</p>
        <p className="text-sm text-muted-foreground">
          {settings.address}, {settings.postcode} {settings.city}
        </p>
        {kvkLine ? <p className="text-sm text-muted-foreground">{kvkLine}</p> : null}
        <dl className="mt-3 space-y-0.5 text-sm">
          {meta.map((m) => (
            <div key={m.label} className="flex justify-between gap-4 sm:justify-end">
              <dt className="text-muted-foreground">{m.label}</dt>
              <dd className="font-medium">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function LineTable({
  lines,
  credit,
}: {
  lines: InvoiceRecord["lines"];
  credit?: boolean;
}) {
  const sorted = sortInvoiceLines(lines);
  return (
    <table className="mt-8 w-full text-sm">
      <thead>
        <tr className={cn("text-left text-[10px] tracking-[0.16em] text-primary-foreground uppercase", credit ? "bg-danger" : "bg-primary")}>
          <th className="px-3 py-2 font-medium">Date</th>
          <th className="px-3 py-2 font-medium">Description</th>
          <th className="px-3 py-2 text-right font-medium">Qty</th>
          <th className="px-3 py-2 text-right font-medium">Unit</th>
          <th className="px-3 py-2 text-right font-medium">VAT</th>
          <th className="px-3 py-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((l) => (
          <tr key={l.id} className="border-b border-hairline">
            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{l.date ? formatDate(l.date) : ""}</td>
            <td className="px-3 py-2">{l.desc}</td>
            <td className="px-3 py-2 text-right tabular">{l.qty}</td>
            <td className="px-3 py-2 text-right tabular">{money(l.unitPrice)}</td>
            <td className="px-3 py-2 text-right">{l.vat === "verlegd" ? "RC" : `${l.vat}%`}</td>
            <td className="px-3 py-2 text-right tabular">{money(l.qty * l.unitPrice)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ lines }: { lines: InvoiceRecord["lines"] }) {
  const t = invoiceTotals(lines);
  return (
    <div className="mt-6 ml-auto w-full max-w-xs text-sm">
      <div className="flex justify-between py-1">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular">{money(t.net)}</span>
      </div>
      {t.buckets.map((b) => (
        <div key={b.vat} className="flex justify-between py-1">
          <span className="text-muted-foreground">{vatLabel(b.vat)}</span>
          <span className="tabular">{b.vat === "verlegd" ? "—" : money(b.vatAmount)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t-2 border-primary pt-2 font-display text-xl text-primary">
        <span>Total</span>
        <span className="tabular">{money(t.gross)}</span>
      </div>
    </div>
  );
}

function Footer({ settings }: { settings: SettingsRecord }) {
  const parts = [
    settings.legalName,
    settings.kvk ? `KvK ${settings.kvk}` : "",
    settings.btw ? `VAT ${settings.btw}` : "",
    settings.email,
    settings.phone,
  ].filter(Boolean);
  return (
    <p className="mt-10 text-center text-[10px] tracking-wide text-muted-foreground">
      {parts.join(" · ")}
    </p>
  );
}

export function InvoiceDocument({
  invoice,
  settings,
}: {
  invoice: InvoiceRecord;
  settings: SettingsRecord;
}) {
  const live = liveInvoiceStatus(invoice.status, invoice.dueDate, invoice.type);
  const stamp = watermarkLabel(live, invoice.type);
  const hideVat = invoice.billPrivate;
  const title = invoice.type === "credit" ? "Credit note" : "Invoice";
  const payBits = [settings.bankName, settings.accountName].filter(Boolean).join(" · ");
  const ibanBits = [settings.iban, settings.bic ? `BIC ${settings.bic}` : ""].filter(Boolean).join(" · ");

  return (
    <article
      data-print-doc
      className="relative overflow-hidden rounded-xl bg-card px-6 py-6 text-ink shadow-[var(--shadow-border)] sm:px-10 sm:py-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.05]"
      >
        <span className="font-display text-[140px] font-semibold tracking-[0.2em] text-primary">
          {settings.watermark || "GS"}
        </span>
      </div>
      {stamp ? (
        <div className="pointer-events-none absolute top-24 right-8 rotate-12 font-display text-5xl font-semibold tracking-[0.2em] text-danger/40 uppercase">
          {stamp}
        </div>
      ) : null}
      <Letterhead settings={settings} title={title} credit={invoice.type === "credit"} />
      <PartyBlock
        leftLabel="Invoice to"
        left={{
          name: invoice.company,
          address: invoice.address,
          contact: invoice.contactName,
          vat: invoice.clientBtw,
        }}
        settings={settings}
        hideVat={hideVat}
        meta={[
          { label: "Number", value: invoice.number },
          { label: "Date", value: formatDate(invoice.date) },
          { label: invoice.type === "credit" ? "Credit date" : "Due", value: formatDate(invoice.dueDate) },
          ...(invoice.reference ? [{ label: "Reference", value: invoice.reference }] : []),
        ]}
      />
      <LineTable lines={invoice.lines} credit={invoice.type === "credit"} />
      <Totals lines={invoice.lines} />
      {invoice.type === "normal" ? (
        <div className="mt-8 rounded-md bg-muted/70 px-4 py-3 text-sm">
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Payment</p>
          {payBits ? <p className="mt-1">{payBits}</p> : null}
          {ibanBits ? <p className="tabular">{ibanBits}</p> : null}
          {!payBits && !ibanBits ? (
            <p className="mt-1 text-muted-foreground">Add IBAN in Settings to print bank details here.</p>
          ) : null}
        </div>
      ) : null}
      {settings.thanks ? <p className="mt-6 text-sm text-muted-foreground">{settings.thanks}</p> : null}
      <Footer settings={settings} />
    </article>
  );
}

export function QuoteDocument({
  query,
  settings,
  validUntil,
}: {
  query: QueryRecord;
  settings: SettingsRecord;
  validUntil: string;
}) {
  const lines: InvoiceRecord["lines"] = [
    {
      id: "q1",
      date: query.tripDate,
      desc: `${query.vehicle} · ${query.from} → ${query.to} · ${query.pax} pax`,
      qty: 1,
      unitPrice: query.amount,
      vat: settings.defaultVat,
    },
  ];
  return (
    <article
      data-print-doc
      className="relative overflow-hidden rounded-xl bg-card px-6 py-6 text-ink shadow-[var(--shadow-border)] sm:px-10 sm:py-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.05]"
      >
        <span className="font-display text-[140px] font-semibold tracking-[0.2em] text-primary">
          {settings.watermark || "GS"}
        </span>
      </div>
      <Letterhead settings={settings} title="Quotation" />
      <PartyBlock
        leftLabel="Quote for"
        left={{
          name: query.company,
          address: [query.contactName, query.contactEmail, query.contactPhone].filter(Boolean).join("\n"),
        }}
        settings={settings}
        meta={[
          { label: "Quote", value: query.ref },
          { label: "Date", value: formatDate(query.created) },
          { label: "Valid until", value: formatDate(validUntil) },
          { label: "Travel date", value: formatDate(query.tripDate) },
        ]}
      />
      <LineTable lines={lines} />
      <Totals lines={lines} />
      <p className="mt-6 max-w-xl text-sm text-muted-foreground">
        This is a quotation, not a request for payment. Full banking details will be provided on
        the proforma invoice once the journey is confirmed.
      </p>
      <div className="mt-8 space-y-4">
        <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Terms and conditions
        </p>
        {QUOTE_TERMS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-primary">{c.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{c.body}</p>
          </div>
        ))}
      </div>
      <Footer settings={settings} />
    </article>
  );
}

export function printDocument() {
  window.print();
}

export type { Kind };
