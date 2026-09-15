import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, invoiceTotals, liveInvoiceStatus, vatLabel } from "./format";
import { sortInvoiceLines } from "./logic";
import { LOGO_JPG_BASE64 } from "./logo-bytes";
import type { InvoiceRecord, SettingsRecord } from "./types";

const NAVY = rgb(16 / 255, 62 / 255, 98 / 255);
const ORANGE = rgb(236 / 255, 121 / 255, 32 / 255);
const INK = rgb(0.12, 0.14, 0.16);
const MUTED = rgb(0.38, 0.42, 0.47);
const RULE = rgb(0.86, 0.87, 0.88);
const PAPER = rgb(0.996, 0.988, 0.965);

function pdfMoney(n: number) {
  const formatted = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
  return `EUR ${formatted}`;
}

function winAnsi(text: string) {
  return (text || "")
    .replace(/€/g, "EUR")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x00-\xff]/g, "");
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const raw = winAnsi(text).replace(/\r\n/g, "\n");
  const out: string[] = [];
  for (const paragraph of raw.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
      else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

function stampLabel(inv: InvoiceRecord) {
  const live = liveInvoiceStatus(inv.status, inv.dueDate, inv.type);
  if (inv.type === "credit") return "CREDIT NOTE";
  if (live === "Paid") return "PAID";
  if (live === "Overdue") return "OVERDUE";
  if (live === "Partly paid") return "PART PAID";
  if (live === "Disputed") return "DISPUTED";
  if (live === "Written off") return "WRITTEN OFF";
  if (live === "Credited") return "CREDITED";
  return "";
}

export async function buildInvoicePdf(invoice: InvoiceRecord, settings: SettingsRecord): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo = null as Awaited<ReturnType<PDFDocument["embedJpg"]>> | null;
  try {
    logo = await pdf.embedJpg(Buffer.from(LOGO_JPG_BASE64, "base64"));
  } catch {
    logo = null;
  }

  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: PAPER });

  const margin = 40;
  const width = pageSize[0];
  const hideVat = invoice.billPrivate;
  const title = invoice.type === "credit" ? "CREDIT NOTE" : "INVOICE";
  const lines = sortInvoiceLines(invoice.lines ?? []);
  const totals = invoiceTotals(lines);

  const drawHeaderBar = (p: PDFPage) => {
    p.drawRectangle({ x: 0, y: pageSize[1] - 6, width: 110, height: 6, color: ORANGE });
    p.drawRectangle({ x: 110, y: pageSize[1] - 6, width: width - 110, height: 6, color: NAVY });
  };
  drawHeaderBar(page);

  let y = pageSize[1] - 28;
  if (logo) {
    const logoH = 52;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, { x: margin, y: y - logoH, width: logoW, height: logoH });
  }
  const nameX = margin + (logo ? 78 : 0);
  page.drawText(winAnsi(settings.tradingName || settings.legalName), {
    x: nameX,
    y: y - 18,
    size: 16,
    font: bold,
    color: NAVY,
  });
  if (settings.tagline) {
    page.drawText(settings.tagline.toUpperCase(), {
      x: nameX,
      y: y - 32,
      size: 8,
      font: bold,
      color: ORANGE,
    });
  }
  if (settings.website) {
    page.drawText(settings.website, {
      x: nameX,
      y: y - 46,
      size: 9,
      font,
      color: NAVY,
    });
  }
  const titleW = bold.widthOfTextAtSize(title, 18);
  page.drawText(title, {
    x: width - margin - titleW,
    y: y - 22,
    size: 18,
    font: bold,
    color: invoice.type === "credit" ? rgb(0.62, 0.16, 0.16) : NAVY,
  });
  y -= 72;

  const stamp = stampLabel(invoice);
  if (stamp) {
    page.drawText(stamp, {
      x: 300,
      y: 420,
      size: 36,
      font: bold,
      color: rgb(0.62, 0.16, 0.16),
      rotate: degrees(28),
      opacity: 0.12,
    });
  }

  const leftX = margin;
  const rightX = 320;
  page.drawText("INVOICE TO", { x: leftX, y, size: 8, font: bold, color: MUTED });
  page.drawText("FROM", { x: rightX, y, size: 8, font: bold, color: MUTED });
  y -= 14;

  const leftLines = [
    invoice.company,
    invoice.contactName,
    ...wrap(font, invoice.address || "", 9, 250),
    !hideVat && invoice.clientBtw ? `VAT ${invoice.clientBtw}` : "",
  ].filter(Boolean);
  const fromBits = [
    settings.legalName,
    [settings.address, settings.postcode, settings.city].filter(Boolean).join(", "),
    [`KvK ${settings.kvk}`, hideVat || !settings.btw ? "" : `VAT ${settings.btw}`]
      .filter(Boolean)
      .join("  ·  "),
    settings.phone,
    settings.email,
  ].filter(Boolean);

  const meta = [
    ["Number", invoice.number],
    ["Date", formatDate(invoice.date)],
    [invoice.type === "credit" ? "Credit date" : "Due", formatDate(invoice.dueDate)],
    invoice.reference ? ["Reference", invoice.reference] : null,
  ].filter(Boolean) as [string, string][];

  const blockH = Math.max(leftLines.length, fromBits.length) * 12 + meta.length * 12 + 8;
  leftLines.forEach((t, i) => {
    page.drawText(winAnsi(String(t).slice(0, 80)), { x: leftX, y: y - i * 12, size: 9, font: i === 0 ? bold : font, color: INK });
  });
  fromBits.forEach((t, i) => {
    page.drawText(winAnsi(String(t).slice(0, 70)), { x: rightX, y: y - i * 12, size: 9, font: i === 0 ? bold : font, color: INK });
  });
  let my = y - fromBits.length * 12 - 8;
  for (const [k, v] of meta) {
    page.drawText(winAnsi(k), { x: rightX, y: my, size: 9, font, color: MUTED });
    const vw = bold.widthOfTextAtSize(winAnsi(v), 9);
    page.drawText(winAnsi(v), { x: width - margin - vw, y: my, size: 9, font: bold, color: INK });
    my -= 12;
  }
  y -= blockH + 10;

  const cols = { date: 48, desc: 220, qty: 40, unit: 70, vat: 40, amt: 70 };
  const tableX = margin;
  const tableW = width - margin * 2;
  const headerH = 18;
  page.drawRectangle({
    x: tableX,
    y: y - headerH,
    width: tableW,
    height: headerH,
    color: invoice.type === "credit" ? rgb(0.62, 0.16, 0.16) : NAVY,
  });
  const headers: [string, number, "left" | "right"][] = [
    ["Date", cols.date, "left"],
    ["Description", cols.desc, "left"],
    ["Qty", cols.qty, "right"],
    ["Unit", cols.unit, "right"],
    ["VAT", cols.vat, "right"],
    ["Amount", cols.amt, "right"],
  ];
  let hx = tableX + 6;
  for (const [label, w, align] of headers) {
    const tw = bold.widthOfTextAtSize(label, 8);
    const x = align === "right" ? hx + w - tw - 4 : hx;
    page.drawText(label, { x, y: y - 12, size: 8, font: bold, color: rgb(1, 1, 1) });
    hx += w;
  }
  y -= headerH + 6;

  const ensureSpace = (need: number) => {
    if (y - need < 70) {
      page = pdf.addPage(pageSize);
      page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: PAPER });
      drawHeaderBar(page);
      y = pageSize[1] - 36;
    }
  };

  for (const line of lines) {
    const descLines = wrap(font, line.desc || "", 9, cols.desc - 8);
    const rowH = Math.max(16, descLines.length * 11 + 6);
    ensureSpace(rowH + 4);
    const dateStr = line.date ? formatDate(line.date) : "";
    const qtyStr = String(line.qty ?? 0);
    const unitStr = pdfMoney(line.unitPrice);
    const vatStr = line.vat === "verlegd" ? "RC" : `${line.vat}%`;
    const amtStr = pdfMoney((line.qty || 0) * (line.unitPrice || 0));
    let cx = tableX + 6;
    page.drawText(dateStr, { x: cx, y: y - 10, size: 8, font, color: MUTED });
    cx += cols.date;
    descLines.forEach((dl, i) => {
      page.drawText(dl, { x: cx, y: y - 10 - i * 11, size: 9, font, color: INK });
    });
    cx += cols.desc;
    const right = (text: string, colW: number, x0: number) => {
      const tw = font.widthOfTextAtSize(text, 9);
      page.drawText(text, { x: x0 + colW - tw - 4, y: y - 10, size: 9, font, color: INK });
    };
    right(qtyStr, cols.qty, cx);
    cx += cols.qty;
    right(unitStr, cols.unit, cx);
    cx += cols.unit;
    right(vatStr, cols.vat, cx);
    cx += cols.vat;
    right(amtStr, cols.amt, cx);
    y -= rowH;
    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableW, y },
      thickness: 0.4,
      color: RULE,
    });
    y -= 4;
  }

  ensureSpace(90);
  const totX = 340;
  const row = (label: string, value: string, strong = false) => {
    page.drawText(label, { x: totX, y, size: strong ? 11 : 9, font: strong ? bold : font, color: strong ? NAVY : MUTED });
    const tw = (strong ? bold : font).widthOfTextAtSize(value, strong ? 11 : 9);
    page.drawText(value, {
      x: width - margin - tw,
      y,
      size: strong ? 11 : 9,
      font: strong ? bold : font,
      color: strong ? NAVY : INK,
    });
    y -= strong ? 16 : 13;
  };
  row("Subtotal", pdfMoney(totals.net));
  for (const b of totals.buckets) {
    row(vatLabel(b.vat), b.vat === "verlegd" ? "—" : pdfMoney(b.vatAmount));
  }
  page.drawLine({
    start: { x: totX, y: y + 8 },
    end: { x: width - margin, y: y + 8 },
    thickness: 1.4,
    color: NAVY,
  });
  row("Total", pdfMoney(totals.gross), true);

  if (invoice.type === "normal") {
    ensureSpace(70);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 52, width: tableW, height: 56, color: rgb(0.95, 0.96, 0.97) });
    page.drawText("PAYMENT", { x: margin + 10, y: y - 14, size: 8, font: bold, color: MUTED });
    const pay1 = [settings.bankName, settings.accountName].filter(Boolean).join("  ·  ");
    const pay2 = [settings.iban, settings.bic ? `BIC ${settings.bic}` : ""].filter(Boolean).join("  ·  ");
    if (pay1) page.drawText(pay1, { x: margin + 10, y: y - 28, size: 9, font, color: INK });
    if (pay2) page.drawText(pay2, { x: margin + 10, y: y - 42, size: 9, font, color: INK });
    if (!pay1 && !pay2) {
      page.drawText("Bank details will be confirmed on the letterhead in Settings.", {
        x: margin + 10,
        y: y - 28,
        size: 9,
        font,
        color: MUTED,
      });
    }
    y -= 64;
  }

  if (settings.thanks) {
    ensureSpace(24);
    const thanks = wrap(font, settings.thanks, 9, tableW);
    thanks.forEach((t) => {
      page.drawText(t, { x: margin, y, size: 9, font, color: MUTED });
      y -= 12;
    });
  }

  const pages = pdf.getPages();
  const foot = [
    settings.legalName,
    settings.kvk ? `KvK ${settings.kvk}` : "",
    hideVat || !settings.btw ? "" : `VAT ${settings.btw}`,
    settings.email,
    settings.phone,
  ]
    .filter(Boolean)
    .join("  ·  ");
  for (const p of pages) {
    const tw = font.widthOfTextAtSize(foot, 7);
    p.drawText(foot, { x: (width - tw) / 2, y: 28, size: 7, font, color: MUTED });
  }

  return pdf.save();
}

export function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}
