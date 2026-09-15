import type {
  BookingStatus,
  InvoiceLine,
  InvoiceStatus,
  LiveInvoiceStatus,
  QueryStage,
  VatRate,
} from "./types";

export function money(n: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function moneyShort(n: number) {
  if (Math.abs(n) >= 1000) {
    return `€${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  }
  return money(n);
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  const d = parseDate(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateLong(iso: string) {
  if (!iso) return "—";
  const d = parseDate(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function parseDate(iso: string): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: string, days: number) {
  const d = parseDate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function padRef(n: number, width = 4) {
  return String(n).padStart(width, "0");
}

export function lineNet(line: InvoiceLine) {
  return (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
}

export type VatBucket = { vat: VatRate; label: string; net: number; vatAmount: number };

export function invoiceTotals(lines: InvoiceLine[]) {
  const buckets = new Map<VatRate, VatBucket>();
  let net = 0;
  for (const line of lines) {
    const n = lineNet(line);
    net += n;
    const vat = line.vat;
    const existing = buckets.get(vat) ?? {
      vat,
      label: vatLabel(vat),
      net: 0,
      vatAmount: 0,
    };
    existing.net += n;
    existing.vatAmount += vatAmount(n, vat);
    buckets.set(vat, existing);
  }
  const vatTotal = [...buckets.values()].reduce((s, b) => s + b.vatAmount, 0);
  return { net, vat: vatTotal, gross: net + vatTotal, buckets: [...buckets.values()] };
}

export function vatLabel(vat: VatRate) {
  if (vat === "verlegd") return "VAT reverse-charged";
  if (vat === "0") return "VAT 0%";
  return `VAT ${vat}%`;
}

export function vatAmount(net: number, vat: VatRate) {
  if (vat === "verlegd" || vat === "0") return 0;
  return net * (Number(vat) / 100);
}

export function liveInvoiceStatus(
  status: InvoiceStatus,
  dueDate: string,
  type: "normal" | "credit" = "normal",
): LiveInvoiceStatus {
  if (type === "credit") return status;
  const watch: InvoiceStatus[] = ["Sent", "Reminded", "Partly paid", "Disputed"];
  if (!watch.includes(status) || !dueDate) return status;
  const due = parseDate(dueDate);
  if (!due) return status;
  const today = parseDate(todayIso())!;
  if (due < today) return "Overdue";
  return status;
}

export const STAGE_TONE: Record<QueryStage, "neutral" | "chrome" | "success" | "warning" | "danger"> = {
  New: "chrome",
  Qualified: "chrome",
  Quoted: "warning",
  "Follow-up": "warning",
  Won: "success",
  Lost: "danger",
};

export const BOOKING_TONE: Record<
  BookingStatus,
  "neutral" | "chrome" | "success" | "warning" | "danger"
> = {
  Confirmed: "chrome",
  "In progress": "warning",
  Completed: "success",
  Cancelled: "danger",
};

export const INVOICE_TONE: Record<
  LiveInvoiceStatus,
  "neutral" | "chrome" | "success" | "warning" | "danger"
> = {
  Draft: "neutral",
  Sent: "chrome",
  Reminded: "warning",
  "Partly paid": "warning",
  Paid: "success",
  Overdue: "danger",
  Disputed: "danger",
  "Written off": "neutral",
  Credited: "neutral",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
