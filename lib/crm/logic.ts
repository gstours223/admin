import type {
  BookingRecord,
  CompanyRecord,
  ConflictReport,
  DuplicateGroup,
  HardConflict,
  InvoiceLine,
  QueryRecord,
  SoftConflict,
  VehicleKind,
} from "./types";
import { OPEN_STAGES } from "./types";

/** §7.1 — dated lines first (asc), undated sink to the bottom keeping relative order. */
export function sortInvoiceLines(lines: InvoiceLine[]): InvoiceLine[] {
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => {
      const ad = a.line.date || "";
      const bd = b.line.date || "";
      if (ad && bd) return ad === bd ? a.index - b.index : ad < bd ? -1 : 1;
      if (ad && !bd) return -1;
      if (!ad && bd) return 1;
      return a.index - b.index;
    })
    .map((x) => x.line);
}

function dayRange(date: string, endDate: string) {
  const start = date;
  const end = endDate || date;
  return { start, end };
}

function rangesOverlap(a: { start: string; end: string }, b: { start: string; end: string }) {
  if (!a.start || !b.start) return false;
  return a.start <= b.end && b.start <= a.end;
}

function bookingRanges(b: BookingRecord) {
  if (b.dates.length) return b.dates.map((d) => dayRange(d.date, d.endDate));
  return [];
}

function liveBookings(list: BookingRecord[]) {
  return list.filter((b) => b.status !== "Cancelled");
}

/** §7.2 — hard driver/plate conflicts, soft vehicle-type signals, likely duplicates. */
export function detectConflicts(bookings: BookingRecord[]): ConflictReport {
  const live = liveBookings(bookings);
  const hard: HardConflict[] = [];
  const seenHard = new Set<string>();

  const pushHard = (a: BookingRecord, b: BookingRecord, field: "driver" | "plate", value: string) => {
    const key = [a.id, b.id, field, value].sort().join("|");
    if (seenHard.has(key)) return;
    seenHard.add(key);
    const label = field === "driver" ? "driver" : "numberplate";
    hard.push({
      kind: "hard",
      a: a.id,
      b: b.id,
      field,
      value,
      reason: `${label} “${value}” is on both ${a.ref} and ${b.ref}`,
    });
  };

  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const A = live[i];
      const B = live[j];
      const overlap = bookingRanges(A).some((ra) => bookingRanges(B).some((rb) => rangesOverlap(ra, rb)));
      if (!overlap) continue;
      const aDrivers = A.units.flatMap((u) => [u.driver, u.driver2].filter(Boolean));
      const bDrivers = B.units.flatMap((u) => [u.driver, u.driver2].filter(Boolean));
      for (const d of aDrivers) {
        if (bDrivers.some((x) => x.trim().toLowerCase() === d.trim().toLowerCase())) {
          pushHard(A, B, "driver", d);
        }
      }
      const aPlates = A.units.map((u) => u.plate).filter(Boolean);
      const bPlates = B.units.map((u) => u.plate).filter(Boolean);
      for (const p of aPlates) {
        if (bPlates.some((x) => x.trim().toLowerCase() === p.trim().toLowerCase())) {
          pushHard(A, B, "plate", p);
        }
      }
    }
  }

  const byDayVehicle = new Map<string, Map<VehicleKind, string[]>>();
  for (const b of live) {
    const days = new Set<string>();
    for (const r of bookingRanges(b)) {
      if (!r.start) continue;
      const start = new Date(r.start);
      const end = new Date(r.end || r.start);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.add(d.toISOString().slice(0, 10));
      }
    }
    const types = [...new Set(b.units.map((u) => u.vehicle).filter(Boolean))];
    for (const day of days) {
      if (!byDayVehicle.has(day)) byDayVehicle.set(day, new Map());
      const m = byDayVehicle.get(day)!;
      for (const v of types) {
        const arr = m.get(v) ?? [];
        arr.push(b.ref);
        m.set(v, arr);
      }
    }
  }
  const soft: SoftConflict[] = [];
  for (const [date, m] of byDayVehicle) {
    for (const [vehicle, refs] of m) {
      const unique = [...new Set(refs)];
      if (unique.length >= 2) soft.push({ kind: "soft", date, vehicle, refs: unique });
    }
  }

  const groups = new Map<string, string[]>();
  for (const b of bookings) {
    const first = b.dates[0]?.date || "";
    const key = `${(b.company || "").trim().toLowerCase()}|${first}|${(b.from || "").trim().toLowerCase()}|${(b.to || "").trim().toLowerCase()}`;
    if (!b.company || !first) continue;
    const arr = groups.get(key) ?? [];
    arr.push(b.id);
    groups.set(key, arr);
  }
  const duplicates: DuplicateGroup[] = [];
  for (const [key, ids] of groups) {
    if (ids.length >= 2) duplicates.push({ kind: "duplicate", key, ids });
  }

  return { hard, soft, duplicates };
}

export function hardConflictIds(report: ConflictReport) {
  const ids = new Set<string>();
  for (const c of report.hard) {
    ids.add(c.a);
    ids.add(c.b);
  }
  return ids;
}

export function findOpenQueryForCompany(queries: QueryRecord[], company: string, exceptId?: string) {
  const name = company.trim().toLowerCase();
  if (!name) return null;
  return (
    queries.find(
      (q) =>
        q.id !== exceptId &&
        q.company.trim().toLowerCase() === name &&
        OPEN_STAGES.includes(q.stage),
    ) ?? null
  );
}

/** §7.3 — merge incoming into existing; never blank a filled field with an empty one. */
export function mergeQuery(existing: QueryRecord, incoming: Partial<QueryRecord>): QueryRecord {
  const next: QueryRecord = { ...existing };
  const keys: (keyof QueryRecord)[] = [
    "brand",
    "source",
    "contactName",
    "contactEmail",
    "contactPhone",
    "tripDate",
    "from",
    "to",
    "vehicle",
    "owner",
    "nextAction",
    "nextActionDate",
    "notes",
  ];
  for (const k of keys) {
    const val = incoming[k];
    if (val === undefined || val === null || val === "") continue;
    (next as unknown as Record<string, unknown>)[k] = val;
  }
  if (typeof incoming.pax === "number" && incoming.pax > 0) next.pax = incoming.pax;
  if (typeof incoming.amount === "number" && incoming.amount > 0) next.amount = incoming.amount;
  if (incoming.log?.length) {
    next.log = [...incoming.log, ...existing.log];
  }
  return next;
}

export const EMBASSY_RATES = {
  Sedan: {
    half: 280,
    full: 550,
    extraBlock: 21,
    extraKm: 1,
    label: "Sedan (Mercedes S-Class / Volvo XC90)",
  },
  Minivan: {
    half: 320,
    full: 610,
    extraBlock: 22,
    extraKm: 1.2,
    label: "Minivan/MPV (Mercedes V-Class / Vito)",
  },
} as const;

export type EmbassyVehicle = keyof typeof EMBASSY_RATES;

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM <= startM) endM += 24 * 60;
  return endM - startM;
}

export type EmbassyResult = {
  hours: number;
  tier: "Half Day" | "Full Day";
  includedKm: number;
  includedHours: number;
  extraBlocks: number;
  extraKm: number;
  lines: { desc: string; qty: number; unitPrice: number }[];
};

/** §7.7 — Embassy of India tender HAG/873/2/2021. */
export function embassyCalculate(opts: {
  vehicle: EmbassyVehicle;
  start: string;
  end: string;
  km: number;
  bookedFor: string;
}): EmbassyResult {
  const rate = EMBASSY_RATES[opts.vehicle];
  const mins = minutesBetween(opts.start || "00:00", opts.end || "00:00");
  const hours = mins / 60;
  const half = hours <= 6;
  const tier: "Half Day" | "Full Day" = half ? "Half Day" : "Full Day";
  const includedHours = half ? 6 : 12;
  const includedKm = half ? 60 : 120;
  const packagePrice = half ? rate.half : rate.full;
  const extraMins = Math.max(0, mins - includedHours * 60);
  const extraBlocks = extraMins > 0 ? Math.ceil(extraMins / 30) : 0;
  const extraKm = Math.max(0, Math.round((opts.km || 0) - includedKm));
  const who = opts.bookedFor.trim() ? `For ${opts.bookedFor.trim()}: ` : "";
  const veh = opts.vehicle === "Sedan" ? "Sedan" : "Minivan";
  const lines: EmbassyResult["lines"] = [
    {
      desc: `${who}${tier} hire — ${veh}, ${opts.start}–${opts.end}, ${hours.toFixed(1).replace(/\.0$/, "")}h / ${opts.km || 0} km`,
      qty: 1,
      unitPrice: packagePrice,
    },
  ];
  if (extraBlocks > 0) {
    lines.push({
      desc: `${who}Extra time — ${extraBlocks} × 30 min beyond ${tier.toLowerCase()}`,
      qty: extraBlocks,
      unitPrice: rate.extraBlock,
    });
  }
  if (extraKm > 0) {
    lines.push({
      desc: `${who}Extra kilometres — ${extraKm} km beyond ${includedKm} km allowance`,
      qty: extraKm,
      unitPrice: rate.extraKm,
    });
  }
  return { hours, tier, includedKm, includedHours, extraBlocks, extraKm, lines };
}

export function isEmbassyCompany(name: string) {
  return /embassy of india/i.test(name || "");
}

export function isPrivateCompany(c: CompanyRecord | undefined) {
  return c?.type === "Private";
}

export function bookingFirstDate(b: BookingRecord) {
  return b.dates[0]?.date || "";
}
