import { todayIso } from "./format";
import type {
  BookingRecord,
  CompanyRecord,
  ContactLogEntry,
  ContactRecord,
  DriverHoursEntry,
  DriverRecord,
  InvoiceLine,
  InvoiceRecord,
  QueryRecord,
  VehicleMaintEntry,
  VehicleRecord,
  VendorRecord,
} from "./types";
import { nid } from "@/lib/utils";

export function blankCompany(actor: string): CompanyRecord {
  return {
    id: nid("co"),
    name: "",
    type: "Corporate",
    street: "",
    postcode: "",
    city: "Den Haag",
    country: "Nederland",
    vat: "",
    kvk: "",
    termsDays: 14,
    invoiceEmail: "",
    phone: "",
    contactName: "",
    extraHourRate: null,
    extraKmRate: null,
    notes: "",
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankVendor(actor: string): VendorRecord {
  return {
    id: nid("ve"),
    name: "",
    type: "Coach operator",
    standing: "Approved",
    contactStatus: "Not contacted",
    city: "",
    street: "",
    postcode: "",
    country: "Nederland",
    phone: "",
    invoiceEmail: "",
    contactName: "",
    kvk: "",
    rates: [],
    notes: "",
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankContact(actor: string): ContactRecord {
  return {
    id: nid("ct"),
    name: "",
    company: "",
    role: "",
    email: "",
    phone: "",
    billsDirectly: "No",
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankLog(): ContactLogEntry {
  return {
    id: nid("lg"),
    date: todayIso(),
    direction: "Outgoing",
    channel: "Email",
    note: "",
    logged: new Date().toISOString(),
  };
}

export function blankQuery(actor: string, ref: string): QueryRecord {
  return {
    id: nid("q"),
    ref,
    brand: "GS Tours",
    source: "Email",
    company: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    tripDate: "",
    pax: 0,
    from: "",
    to: "",
    vehicle: "Coach 50",
    stage: "New",
    amount: 0,
    owner: actor,
    nextAction: "",
    nextActionDate: "",
    lostReason: "",
    notes: "",
    log: [],
    created: todayIso(),
    moved: todayIso(),
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankBooking(actor: string, ref: string): BookingRecord {
  return {
    id: nid("b"),
    ref,
    brand: "GS Tours",
    status: "Confirmed",
    tripType: "Day trip (dagtocht)",
    company: "",
    contactName: "",
    contactPhone: "",
    dates: [{ date: todayIso(), endDate: "", pickupTime: "08:00", returnTime: "18:00", note: "" }],
    from: "",
    to: "",
    returnFrom: "",
    pax: 0,
    units: [
      {
        vehicle: "Coach 50",
        plate: "",
        driver: "",
        driver2: "",
        pax: 0,
        cost: 0,
        subcontractor: "",
      },
    ],
    groupLeader: "",
    groupLeaderPhone: "",
    amount: 0,
    paid: "Not invoiced",
    reference: "",
    notes: "",
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankLine(vat: InvoiceRecord["lines"][0]["vat"] = "9"): InvoiceLine {
  return {
    id: nid("ln"),
    date: todayIso(),
    desc: "",
    qty: 1,
    unitPrice: 0,
    vat,
  };
}

export function blankInvoice(actor: string, number: string): InvoiceRecord {
  return {
    id: nid("in"),
    number,
    type: "normal",
    originalId: "",
    status: "Draft",
    date: todayIso(),
    dueDate: todayIso(),
    company: "",
    contactName: "",
    address: "",
    clientBtw: "",
    billPrivate: false,
    reference: "",
    lines: [blankLine()],
    amountPaid: 0,
    paidDate: "",
    sendTo: "",
    notes: "",
    sent: [],
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankHours(): DriverHoursEntry {
  return {
    id: nid("hr"),
    date: todayIso(),
    start: "07:00",
    end: "17:00",
    bookingRef: "",
    vehicle: "",
    notes: "",
  };
}

export function blankDriver(actor: string): DriverRecord {
  return {
    id: nid("dr"),
    name: "",
    phone: "",
    email: "",
    license: "",
    notes: "",
    hours: [],
    updatedAt: "",
    updatedBy: actor,
  };
}

export function blankMaint(): VehicleMaintEntry {
  return {
    id: nid("mt"),
    date: todayIso(),
    kind: "Service",
    km: null,
    vendor: "",
    cost: 0,
    notes: "",
  };
}

export function blankVehicle(actor: string): VehicleRecord {
  return {
    id: nid("vh"),
    plate: "",
    kind: "Sedan",
    make: "",
    model: "",
    year: "",
    motUntil: "",
    insuranceUntil: "",
    notes: "",
    log: [],
    updatedAt: "",
    updatedBy: actor,
  };
}
