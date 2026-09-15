import type { SettingsRecord, MetaRecord, Workspace } from "./types";

export const DEFAULT_SETTINGS: SettingsRecord = {
  legalName: "GS TAXI & TOURS",
  tradingName: "GS Tours",
  tagline: "Coach · taxi · chauffeur · Den Haag",
  website: "www.gstours.nl",
  email: "info@gstours.nl",
  phone: "+31 6 3939 4040",
  address: "Hoefkade 761",
  postcode: "2525 LG",
  city: "Den Haag",
  country: "Nederland",
  kvk: "97885525",
  btw: "",
  bankName: "",
  accountName: "GS TAXI & TOURS",
  iban: "",
  bic: "",
  numberPrefix: "",
  nextNumber: 1,
  defaultVat: "9",
  termsDays: 14,
  watermark: "GS",
  thanks: "Thank you for travelling with us. We look forward to the next journey.",
  mailInvoiceSubject: "Invoice {{number}} — {{company}}",
  mailInvoice:
    "Dear {{contact}},\n\nPlease find invoice {{number}} attached, due {{due}}.\n\nKind regards,\n{{signature}}",
  mailReminderSubject: "Reminder: invoice {{number}} is due",
  mailReminder:
    "Dear {{contact}},\n\nThis is a friendly reminder that invoice {{number}} was due on {{due}}.\n\nKind regards,\n{{signature}}",
  signature: "Planning desk\nGS Tours",
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  smtpUser: "factuur@gstours.nl",
  smtpPass: "",
  smtpFrom: "factuur@gstours.nl",
  smtpConfigured: false,
};

export const DEFAULT_META: MetaRecord = { qSeq: 0, bSeq: 0 };

export function emptyWorkspace(): Workspace {
  return {
    companies: [],
    vendors: [],
    contacts: [],
    queries: [],
    bookings: [],
    invoices: [],
    drivers: [],
    vehicles: [],
    settings: { ...DEFAULT_SETTINGS },
    meta: { ...DEFAULT_META },
  };
}

export function isWorkspaceEmpty(w: Workspace) {
  return (
    w.companies.length === 0 &&
    w.vendors.length === 0 &&
    w.contacts.length === 0 &&
    w.queries.length === 0 &&
    w.bookings.length === 0 &&
    w.invoices.length === 0 &&
    w.drivers.length === 0 &&
    w.vehicles.length === 0
  );
}
