export const BRANDS = [
  "GS Tours",
  "BusBus.nl",
  "HollandCoach.nl",
  "Taxibedrijf Wassenaar",
  "Schengen Holidays",
] as const;
export type Brand = (typeof BRANDS)[number];

export const QUERY_SOURCES = [
  "Website",
  "Email",
  "WhatsApp",
  "Phone",
  "Travel agent",
  "Repeat client",
  "Referral",
] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

export const VEHICLES = [
  "Sedan",
  "MPV / Van",
  "Minibus 8",
  "Minibus 19",
  "Midi coach 25",
  "Midi coach 35",
  "Coach 50",
  "Coach 60+",
] as const;
export type VehicleKind = (typeof VEHICLES)[number];

export const QUERY_STAGES = [
  "New",
  "Qualified",
  "Quoted",
  "Follow-up",
  "Won",
  "Lost",
] as const;
export type QueryStage = (typeof QUERY_STAGES)[number];

export const OPEN_STAGES: QueryStage[] = ["New", "Qualified", "Quoted", "Follow-up"];

export const LOST_REASONS = [
  "Price too high",
  "No availability",
  "Client never replied",
  "Client cancelled trip",
  "Went to competitor",
  "Other",
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const LOG_DIRECTIONS = ["Outgoing", "Incoming"] as const;
export type LogDirection = (typeof LOG_DIRECTIONS)[number];

export const LOG_CHANNELS = ["Email", "Phone call", "WhatsApp", "In person", "Other"] as const;
export type LogChannel = (typeof LOG_CHANNELS)[number];

export const BOOKING_STATUSES = ["Confirmed", "In progress", "Completed", "Cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TRIP_TYPES = [
  "Day trip (dagtocht)",
  "Multi-day tour",
  "One-way transfer",
  "Return transfer",
  "Shuttle / pendel",
  "LDC",
  "Airport transfer",
  "Wedding / event",
  "Other",
] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const PAID_STATES = ["Not invoiced", "Invoiced", "Paid"] as const;
export type PaidState = (typeof PAID_STATES)[number];

export const INVOICE_STATUSES = [
  "Draft",
  "Sent",
  "Reminded",
  "Partly paid",
  "Paid",
  "Disputed",
  "Written off",
  "Credited",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type LiveInvoiceStatus = InvoiceStatus | "Overdue";

export const VAT_RATES = ["9", "21", "0", "verlegd"] as const;
export type VatRate = (typeof VAT_RATES)[number];

export const COMPANY_TYPES = [
  "Embassy / Diplomatic",
  "Corporate",
  "MICE / Events",
  "Travel agent",
  "Private",
  "Other",
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const VENDOR_TYPES = [
  "Coach operator",
  "Taxi / sedan",
  "Minibus operator",
  "Driver (freelance)",
  "Hotel",
  "Guide",
  "Ferry / tolls",
  "Attraction / experience",
  "Restaurant",
  "Other",
] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

export const VENDOR_STANDING = ["Preferred", "Approved", "Backup only", "Do not use"] as const;
export type VendorStanding = (typeof VENDOR_STANDING)[number];

export const CONTACT_STATUSES = ["Not contacted", "Emailed", "Rate received", "Agreed"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const RATE_BASES = [
  "Per day",
  "Per half day",
  "Per hour",
  "Per km",
  "Per transfer",
  "Per person",
  "Fixed",
] as const;
export type RateBasis = (typeof RATE_BASES)[number];

export const MAINT_KINDS = ["Service", "Repair", "Tyres", "APK", "Damage", "Other"] as const;
export type MaintKind = (typeof MAINT_KINDS)[number];

export type ContactLogEntry = {
  id: string;
  date: string;
  direction: LogDirection;
  channel: LogChannel;
  note: string;
  logged: string;
};

export type QueryRecord = {
  id: string;
  ref: string;
  brand: Brand;
  source: QuerySource;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  tripDate: string;
  pax: number;
  from: string;
  to: string;
  vehicle: VehicleKind;
  stage: QueryStage;
  amount: number;
  owner: string;
  nextAction: string;
  nextActionDate: string;
  lostReason: LostReason | "";
  notes: string;
  log: ContactLogEntry[];
  created: string;
  moved: string;
  updatedAt: string;
  updatedBy: string;
};

export type BookingDate = {
  date: string;
  endDate: string;
  pickupTime: string;
  returnTime: string;
  note: string;
};

export type BookingUnit = {
  vehicle: VehicleKind;
  plate: string;
  driver: string;
  driver2: string;
  pax: number;
  cost: number;
  subcontractor: string;
};

export type BookingRecord = {
  id: string;
  ref: string;
  brand: Brand;
  status: BookingStatus;
  tripType: TripType;
  company: string;
  contactName: string;
  contactPhone: string;
  dates: BookingDate[];
  from: string;
  to: string;
  returnFrom: string;
  pax: number;
  units: BookingUnit[];
  groupLeader: string;
  groupLeaderPhone: string;
  amount: number;
  paid: PaidState;
  reference: string;
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

export type InvoiceLine = {
  id: string;
  date: string;
  desc: string;
  qty: number;
  unitPrice: number;
  vat: VatRate;
};

export type InvoiceSendLog = {
  at: string;
  to: string;
  by: string;
  via: "smtp" | "download";
  kind: "invoice" | "reminder";
};

export type InvoiceRecord = {
  id: string;
  number: string;
  type: "normal" | "credit";
  originalId: string;
  status: InvoiceStatus;
  date: string;
  dueDate: string;
  company: string;
  contactName: string;
  address: string;
  clientBtw: string;
  billPrivate: boolean;
  reference: string;
  lines: InvoiceLine[];
  amountPaid: number;
  paidDate: string;
  sendTo: string;
  notes: string;
  sent?: InvoiceSendLog[];
  updatedAt: string;
  updatedBy: string;
};

export type CompanyRecord = {
  id: string;
  name: string;
  type: CompanyType;
  street: string;
  postcode: string;
  city: string;
  country: string;
  vat: string;
  kvk: string;
  termsDays: number;
  invoiceEmail: string;
  phone: string;
  contactName: string;
  extraHourRate: number | null;
  extraKmRate: number | null;
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

export type VendorRate = {
  service: string;
  basis: RateBasis;
  price: number;
  validUntil: string;
};

export type VendorRecord = {
  id: string;
  name: string;
  type: VendorType;
  standing: VendorStanding;
  contactStatus: ContactStatus;
  city: string;
  street: string;
  postcode: string;
  country: string;
  phone: string;
  invoiceEmail: string;
  contactName: string;
  kvk: string;
  rates: VendorRate[];
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

export type ContactRecord = {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  billsDirectly: "Yes - bill them directly" | "No";
  updatedAt: string;
  updatedBy: string;
};

export type DriverHoursEntry = {
  id: string;
  date: string;
  start: string;
  end: string;
  bookingRef: string;
  vehicle: string;
  notes: string;
};

export type DriverRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  license: string;
  notes: string;
  hours: DriverHoursEntry[];
  updatedAt: string;
  updatedBy: string;
};

export type VehicleMaintEntry = {
  id: string;
  date: string;
  kind: MaintKind;
  km: number | null;
  vendor: string;
  cost: number;
  notes: string;
};

export type VehicleRecord = {
  id: string;
  plate: string;
  kind: VehicleKind;
  make: string;
  model: string;
  year: string;
  motUntil: string;
  insuranceUntil: string;
  notes: string;
  log: VehicleMaintEntry[];
  updatedAt: string;
  updatedBy: string;
};

export type SettingsRecord = {
  legalName: string;
  tradingName: string;
  tagline: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
  city: string;
  country: string;
  kvk: string;
  btw: string;
  bankName: string;
  accountName: string;
  iban: string;
  bic: string;
  numberPrefix: string;
  nextNumber: number;
  defaultVat: VatRate;
  termsDays: number;
  watermark: string;
  thanks: string;
  mailInvoiceSubject: string;
  mailInvoice: string;
  mailReminderSubject: string;
  mailReminder: string;
  signature: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpConfigured?: boolean;
};

export type MetaRecord = {
  qSeq: number;
  bSeq: number;
};

export type AuditEntry = {
  id: number;
  entity: string;
  entityId: string | null;
  action: string;
  snapshot: string | null;
  at: string;
};

export type Workspace = {
  companies: CompanyRecord[];
  vendors: VendorRecord[];
  contacts: ContactRecord[];
  queries: QueryRecord[];
  bookings: BookingRecord[];
  invoices: InvoiceRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
  settings: SettingsRecord;
  meta: MetaRecord;
};

export type BackupFile = Workspace;

export type EntityName =
  | "companies"
  | "vendors"
  | "contacts"
  | "queries"
  | "bookings"
  | "invoices"
  | "drivers"
  | "vehicles";

export type HardConflict = {
  kind: "hard";
  a: string;
  b: string;
  reason: string;
  field: "driver" | "plate";
  value: string;
};

export type SoftConflict = {
  kind: "soft";
  date: string;
  vehicle: VehicleKind;
  refs: string[];
};

export type DuplicateGroup = {
  kind: "duplicate";
  key: string;
  ids: string[];
};

export type ConflictReport = {
  hard: HardConflict[];
  soft: SoftConflict[];
  duplicates: DuplicateGroup[];
};
