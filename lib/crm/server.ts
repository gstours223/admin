import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { DEFAULT_META, DEFAULT_SETTINGS, emptyWorkspace } from "./defaults";
import { interpolate } from "./format";
import { sortInvoiceLines } from "./logic";
import { sampleWorkspace } from "./seed";
import type {
  AuditEntry,
  BackupFile,
  BookingRecord,
  CompanyRecord,
  ContactRecord,
  DriverRecord,
  EntityName,
  InvoiceRecord,
  InvoiceSendLog,
  MetaRecord,
  QueryRecord,
  SettingsRecord,
  VehicleRecord,
  VendorRecord,
  Workspace,
} from "./types";

const ENTITIES: EntityName[] = [
  "companies",
  "vendors",
  "contacts",
  "queries",
  "bookings",
  "invoices",
  "drivers",
  "vehicles",
];

type Sql = Awaited<ReturnType<typeof getSql>>;

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Stored ${label} could not be read. Nothing was changed.`);
  }
}

async function readRows<T>(sql: Sql, table: string, userId: string): Promise<T[]> {
  const result = await sql.query<{ data: string }>(
    `select data from ${table} where user_id = $1`,
    [userId],
  );
  return result.map((r) => parseJson<T>(r.data, table));
}

async function getPrevious(
  sql: Sql,
  table: string,
  userId: string,
  id: string,
): Promise<{ data: string; updated_at: string } | null> {
  const rows = await sql.query<{ data: string; updated_at: string }>(
    `select data, updated_at from ${table} where user_id = $1 and id = $2`,
    [userId, id],
  );
  return rows[0] ?? null;
}

async function writeAudit(
  sql: Sql,
  userId: string,
  entity: string,
  entityId: string | null,
  action: string,
  snapshot: unknown,
) {
  await sql.query(
    `insert into gst_audit_log (user_id, entity, entity_id, action, snapshot) values ($1, $2, $3, $4, $5)`,
    [userId, entity, entityId, action, snapshot == null ? null : JSON.stringify(snapshot)],
  );
}

type UpsertOk<T> = { ok: true; record: T; updatedAt: string };
type UpsertConflict<T> = { ok: false; conflict: true; current: T; updatedAt: string };
type UpsertErr = { ok: false; conflict: false; error: string };
export type UpsertResult<T> = UpsertOk<T> | UpsertConflict<T> | UpsertErr;

function extrasFor(entity: EntityName, record: Record<string, unknown>): Record<string, string> {
  switch (entity) {
    case "companies":
    case "vendors":
    case "contacts":
    case "drivers":
      return { name: String(record.name ?? "") };
    case "vehicles":
      return { name: String(record.plate ?? ""), plate: String(record.plate ?? "") };
    case "queries":
      return {
        ref: String(record.ref ?? ""),
        company: String(record.company ?? ""),
        stage: String(record.stage ?? ""),
      };
    case "bookings": {
      const dates = (record.dates as { date?: string }[] | undefined) ?? [];
      return {
        ref: String(record.ref ?? ""),
        company: String(record.company ?? ""),
        status: String(record.status ?? ""),
        trip_date: String(dates[0]?.date ?? ""),
      };
    }
    case "invoices":
      return {
        number: String(record.number ?? ""),
        company: String(record.company ?? ""),
        status: String(record.status ?? ""),
      };
    default:
      return {};
  }
}

function tableFor(entity: EntityName) {
  return `gst_${entity}`;
}

function publicSettings(s: SettingsRecord): SettingsRecord {
  return {
    ...s,
    smtpPass: "",
    smtpConfigured: Boolean(s.smtpPass),
  };
}

async function upsertEntity<T extends { id: string; updatedAt?: string }>(opts: {
  sql: Sql;
  userId: string;
  table: string;
  entity: EntityName;
  record: T;
  expectedUpdatedAt?: string | null;
  extra: Record<string, string>;
}): Promise<UpsertResult<T>> {
  const { sql, userId, table, entity, extra } = opts;
  let record = opts.record;
  if (!record?.id) return { ok: false, conflict: false, error: "Record is missing an id." };

  if (entity === "invoices") {
    const inv = record as unknown as InvoiceRecord;
    record = { ...record, lines: sortInvoiceLines(inv.lines ?? []) } as T;
  }

  const prev = await getPrevious(sql, table, userId, record.id);
  if (prev && opts.expectedUpdatedAt && String(prev.updated_at) !== String(opts.expectedUpdatedAt)) {
    return {
      ok: false,
      conflict: true,
      current: parseJson<T>(prev.data, table),
      updatedAt: String(prev.updated_at),
    };
  }

  await writeAudit(
    sql,
    userId,
    entity,
    record.id,
    prev ? "upsert" : "insert",
    prev ? parseJson(prev.data, table) : null,
  );

  const now = new Date().toISOString();
  const next = { ...record, updatedAt: now };
  const extraCols = Object.keys(extra);
  const extraVals = extraCols.map((k) => extra[k]);

  if (prev) {
    const colSet = [
      "data = $2",
      "updated_at = now()",
      ...extraCols.map((c, i) => `${c} = $${i + 3}`),
    ].join(", ");
    await sql.query(
      `update ${table} set ${colSet} where user_id = $1 and id = $${extraCols.length + 3}`,
      [userId, JSON.stringify(next), ...extraVals, record.id],
    );
  } else {
    const cols = ["user_id", "id", "data", ...extraCols];
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    await sql.query(
      `insert into ${table} (${cols.join(", ")}, updated_at) values (${placeholders}, now())`,
      [userId, record.id, JSON.stringify(next), ...extraVals],
    );
  }

  const saved = await getPrevious(sql, table, userId, record.id);
  return {
    ok: true,
    record: next,
    updatedAt: saved ? String(saved.updated_at) : now,
  };
}

async function loadSettings(sql: Sql, userId: string): Promise<SettingsRecord> {
  const settingsRows = await sql.query<{ data: string }>(
    `select data from gst_settings where user_id = $1`,
    [userId],
  );
  return settingsRows[0]
    ? { ...DEFAULT_SETTINGS, ...parseJson<SettingsRecord>(settingsRows[0].data, "settings") }
    : { ...DEFAULT_SETTINGS };
}

async function loadWorkspace(sql: Sql, userId: string): Promise<Workspace> {
  const [companies, vendors, contacts, queries, bookings, invoices, drivers, vehicles] = await Promise.all([
    readRows<CompanyRecord>(sql, "gst_companies", userId),
    readRows<VendorRecord>(sql, "gst_vendors", userId),
    readRows<ContactRecord>(sql, "gst_contacts", userId),
    readRows<QueryRecord>(sql, "gst_queries", userId),
    readRows<BookingRecord>(sql, "gst_bookings", userId),
    readRows<InvoiceRecord>(sql, "gst_invoices", userId),
    readRows<DriverRecord>(sql, "gst_drivers", userId),
    readRows<VehicleRecord>(sql, "gst_vehicles", userId),
  ]);
  const settings = publicSettings(await loadSettings(sql, userId));
  const metaRows = await sql.query<{ data: string }>(
    `select data from gst_meta where user_id = $1`,
    [userId],
  );
  const meta = metaRows[0]
    ? { ...DEFAULT_META, ...parseJson<MetaRecord>(metaRows[0].data, "meta") }
    : { ...DEFAULT_META };
  return { companies, vendors, contacts, queries, bookings, invoices, drivers, vehicles, settings, meta };
}

async function restoreInto(sql: Sql, userId: string, data: BackupFile) {
  for (const entity of ENTITIES) {
    const incoming = data[entity] ?? [];
    for (const rec of incoming) {
      if (!rec || !rec.id) continue;
      const table = tableFor(entity);
      const prev = await getPrevious(sql, table, userId, rec.id);
      await writeAudit(sql, userId, entity, rec.id, "restore", prev ? parseJson(prev.data, table) : null);
      const extra = extrasFor(entity, rec as unknown as Record<string, unknown>);
      const extraCols = Object.keys(extra);
      const extraVals = extraCols.map((k) => extra[k]);
      if (prev) {
        const colSet = [
          "data = $2",
          "updated_at = now()",
          ...extraCols.map((c, i) => `${c} = $${i + 3}`),
        ].join(", ");
        await sql.query(
          `update ${table} set ${colSet} where user_id = $1 and id = $${extraCols.length + 3}`,
          [userId, JSON.stringify(rec), ...extraVals, rec.id],
        );
      } else {
        const cols = ["user_id", "id", "data", ...extraCols];
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        await sql.query(
          `insert into ${table} (${cols.join(", ")}, updated_at) values (${placeholders}, now())`,
          [userId, rec.id, JSON.stringify(rec), ...extraVals],
        );
      }
    }
  }
  if (data.settings) {
    const incoming = { ...data.settings };
    if (!incoming.smtpPass) {
      const prev = await loadSettings(sql, userId);
      incoming.smtpPass = prev.smtpPass || "";
    }
    delete incoming.smtpConfigured;
    await writeAudit(sql, userId, "settings", "1", "restore", null);
    await sql.query(
      `insert into gst_settings (user_id, data, updated_at) values ($1, $2, now())
       on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
      [userId, JSON.stringify(incoming)],
    );
  }
  if (data.meta) {
    await sql.query(
      `insert into gst_meta (user_id, data, updated_at) values ($1, $2, now())
       on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
      [userId, JSON.stringify(data.meta)],
    );
  }
}

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; data: Workspace } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      return { ok: true, data: await loadWorkspace(sql, context.userId) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load the workspace.";
      return { ok: false, error: message };
    }
  });

type UpsertInput = {
  entity: EntityName;
  record: { id: string };
  expectedUpdatedAt?: string | null;
};

export const upsertRecord = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: UpsertInput) => input)
  .handler(async ({ context, data }) => {
    try {
      if (!ENTITIES.includes(data.entity)) {
        return { ok: false as const, conflict: false as const, error: "Unknown entity." };
      }
      const sql = await getSql();
      const result = await upsertEntity({
        sql,
        userId: context.userId,
        table: tableFor(data.entity),
        entity: data.entity,
        record: data.record,
        expectedUpdatedAt: data.expectedUpdatedAt,
        extra: extrasFor(data.entity, data.record as Record<string, unknown>),
      });
      if (result.ok) {
        return { ok: true as const, record: result.record, updatedAt: result.updatedAt };
      }
      if (result.conflict) {
        return {
          ok: false as const,
          conflict: true as const,
          current: result.current,
          updatedAt: result.updatedAt,
        };
      }
      return { ok: false as const, conflict: false as const, error: result.error };
    } catch (err) {
      return {
        ok: false as const,
        conflict: false as const,
        error: err instanceof Error ? err.message : "Save failed.",
      };
    }
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { entity: EntityName; id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      if (!ENTITIES.includes(data.entity) || !data.id) {
        return { ok: false, error: "Invalid delete." };
      }
      const sql = await getSql();
      const table = tableFor(data.entity);
      const prev = await getPrevious(sql, table, context.userId, data.id);
      await writeAudit(
        sql,
        context.userId,
        data.entity,
        data.id,
        "delete",
        prev ? parseJson(prev.data, table) : null,
      );
      await sql.query(`delete from ${table} where user_id = $1 and id = $2`, [
        context.userId,
        data.id,
      ]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
    }
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SettingsRecord) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      const prev = await loadSettings(sql, context.userId);
      const next: SettingsRecord = { ...data };
      if (!next.smtpPass) next.smtpPass = prev.smtpPass || "";
      delete next.smtpConfigured;
      await writeAudit(sql, context.userId, "settings", "1", "upsert", prev);
      await sql.query(
        `insert into gst_settings (user_id, data, updated_at) values ($1, $2, now())
         on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
        [context.userId, JSON.stringify(next)],
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not save settings." };
    }
  });

export const saveMeta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: MetaRecord) => input)
  .handler(async ({ context, data }): Promise<{ ok: true; meta: MetaRecord } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      await sql.query(
        `insert into gst_meta (user_id, data, updated_at) values ($1, $2, now())
         on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
        [context.userId, JSON.stringify(data)],
      );
      return { ok: true, meta: data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not save numbering." };
    }
  });

export const allocateRefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: "query" | "booking" | "invoice" }) => input)
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: true; ref: string; meta?: MetaRecord; nextNumber?: number } | { ok: false; error: string }> => {
      try {
        const sql = await getSql();
        if (data.kind === "invoice") {
          const settings = await loadSettings(sql, context.userId);
          const year = new Date().getFullYear();
          const n = settings.nextNumber || 1;
          const ref = `${settings.numberPrefix || ""}${year}-${String(n).padStart(4, "0")}`;
          const next = { ...settings, nextNumber: n + 1 };
          delete next.smtpConfigured;
          await sql.query(
            `insert into gst_settings (user_id, data, updated_at) values ($1, $2, now())
             on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
            [context.userId, JSON.stringify(next)],
          );
          return { ok: true, ref, nextNumber: next.nextNumber };
        }
        const rows = await sql.query<{ data: string }>(
          `select data from gst_meta where user_id = $1`,
          [context.userId],
        );
        const meta = rows[0]
          ? { ...DEFAULT_META, ...parseJson<MetaRecord>(rows[0].data, "meta") }
          : { ...DEFAULT_META };
        if (data.kind === "query") meta.qSeq += 1;
        else meta.bSeq += 1;
        const ref =
          data.kind === "query"
            ? `Q-${String(meta.qSeq).padStart(4, "0")}`
            : `B-${String(meta.bSeq).padStart(4, "0")}`;
        await sql.query(
          `insert into gst_meta (user_id, data, updated_at) values ($1, $2, now())
           on conflict (user_id) do update set data = excluded.data, updated_at = now()`,
          [context.userId, JSON.stringify(meta)],
        );
        return { ok: true, ref, meta };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not allocate a number." };
      }
    },
  );

export const downloadBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; backup: BackupFile } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      const backup = await loadWorkspace(sql, context.userId);
      const stored = await loadSettings(sql, context.userId);
      backup.settings = publicSettings(stored);
      return { ok: true, backup };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not build a backup." };
    }
  });

export type RestorePreview = {
  add: Record<EntityName | "settings" | "meta", number>;
  update: Record<EntityName | "settings" | "meta", number>;
  invalid: number;
};

function emptyCounts(): RestorePreview["add"] {
  return {
    companies: 0,
    vendors: 0,
    contacts: 0,
    queries: 0,
    bookings: 0,
    invoices: 0,
    drivers: 0,
    vehicles: 0,
    settings: 0,
    meta: 0,
  };
}

export const previewRestore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: BackupFile) => input)
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: true; preview: RestorePreview } | { ok: false; error: string }> => {
      try {
        const sql = await getSql();
        const add = emptyCounts();
        const update = emptyCounts();
        let invalid = 0;
        for (const entity of ENTITIES) {
          const incoming = data[entity] ?? [];
          for (const rec of incoming) {
            if (!rec || !rec.id) {
              invalid += 1;
              continue;
            }
            const prev = await getPrevious(sql, tableFor(entity), context.userId, rec.id);
            if (prev) update[entity] += 1;
            else add[entity] += 1;
          }
        }
        if (data.settings) {
          const s = await sql.query(`select 1 from gst_settings where user_id = $1`, [context.userId]);
          if (s[0]) update.settings = 1;
          else add.settings = 1;
        }
        if (data.meta) {
          const s = await sql.query(`select 1 from gst_meta where user_id = $1`, [context.userId]);
          if (s[0]) update.meta = 1;
          else add.meta = 1;
        }
        return { ok: true, preview: { add, update, invalid } };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
      }
    },
  );

export const applyRestore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: BackupFile) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      await restoreInto(sql, context.userId, data);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Restore failed. Nothing further was written.",
      };
    }
  });

export const loadSample = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      await restoreInto(sql, context.userId, sampleWorkspace());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not load the sample workspace." };
    }
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; rows: AuditEntry[] } | { ok: false; error: string }> => {
    try {
      const sql = await getSql();
      const rows = await sql.query<{
        id: number;
        entity: string;
        entity_id: string | null;
        action: string;
        snapshot: string | null;
        at: string;
      }>(
        `select id, entity, entity_id, action, snapshot, at from gst_audit_log
         where user_id = $1 order by at desc, id desc limit 80`,
        [context.userId],
      );
      return {
        ok: true,
        rows: rows.map((r) => ({
          id: r.id,
          entity: r.entity,
          entityId: r.entity_id,
          action: r.action,
          snapshot: r.snapshot,
          at: typeof r.at === "string" ? r.at : new Date(r.at).toISOString(),
        })),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not read the audit log." };
    }
  });

function filenameFor(inv: InvoiceRecord) {
  const kind = inv.type === "credit" ? "credit" : "invoice";
  return `${kind}-${inv.number || inv.id}.pdf`;
}

export const renderInvoicePdf = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(
    async ({
      context,
      data,
    }): Promise<
      { ok: true; pdfBase64: string; filename: string } | { ok: false; error: string }
    > => {
      try {
        const sql = await getSql();
        const prev = await getPrevious(sql, "gst_invoices", context.userId, data.id);
        if (!prev) return { ok: false, error: "That invoice is not in this workspace." };
        const { buildInvoicePdf, bytesToBase64 } = await import("./invoice-pdf");
        const invoice = parseJson<InvoiceRecord>(prev.data, "invoice");
        const settings = await loadSettings(sql, context.userId);
        const bytes = await buildInvoicePdf(invoice, settings);
        return { ok: true, pdfBase64: bytesToBase64(bytes), filename: filenameFor(invoice) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not build the PDF." };
      }
    },
  );

export type SendInvoiceInput = {
  id: string;
  to: string;
  subject: string;
  body: string;
  kind: "invoice" | "reminder";
};

export type SendInvoiceResult =
  | {
      ok: true;
      sent: true;
      record: InvoiceRecord;
      via: "smtp";
    }
  | {
      ok: true;
      sent: false;
      pdfBase64: string;
      filename: string;
      mailto: string;
      error: string;
    }
  | { ok: false; error: string };

export const sendInvoiceMail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SendInvoiceInput) => input)
  .handler(async ({ context, data }): Promise<SendInvoiceResult> => {
    try {
      const to = data.to.trim();
      if (!to || !to.includes("@")) return { ok: false, error: "A valid recipient email is required." };
      const sql = await getSql();
      const prev = await getPrevious(sql, "gst_invoices", context.userId, data.id);
      if (!prev) return { ok: false, error: "That invoice is not in this workspace." };
      const invoice = parseJson<InvoiceRecord>(prev.data, "invoice");
      const settings = await loadSettings(sql, context.userId);
      const { buildInvoicePdf, bytesToBase64 } = await import("./invoice-pdf");
      const bytes = await buildInvoicePdf(invoice, settings);
      const filename = filenameFor(invoice);
      const pdfBase64 = bytesToBase64(bytes);
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;

      const host = (settings.smtpHost || "").trim();
      const user = (settings.smtpUser || "").trim();
      const pass = settings.smtpPass || "";
      const from = (settings.smtpFrom || settings.email || user).trim();

      if (!host || !user || !pass) {
        return {
          ok: true,
          sent: false,
          pdfBase64,
          filename,
          mailto,
          error:
            "SMTP is not configured. Add Hostinger mailbox details in Settings, or download the PDF and send it yourself.",
        };
      }

      try {
        const nodemailer = (await import("nodemailer")).default;
        const port = Number(settings.smtpPort) || 465;
        const transport = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
        await transport.sendMail({
          from: `"${settings.tradingName || settings.legalName}" <${from}>`,
          to,
          subject: data.subject || `Invoice ${invoice.number}`,
          text: data.body,
          attachments: [{ filename, content: Buffer.from(bytes), contentType: "application/pdf" }],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "The mail server refused the message.";
        return { ok: true, sent: false, pdfBase64, filename, mailto, error: message };
      }

      const entry: InvoiceSendLog = {
        at: new Date().toISOString(),
        to,
        by: context.userId,
        via: "smtp",
        kind: data.kind,
      };
      const nextStatus =
        data.kind === "reminder"
          ? invoice.status === "Draft"
            ? "Reminded"
            : invoice.status === "Sent"
              ? "Reminded"
              : invoice.status
          : invoice.status === "Draft"
            ? "Sent"
            : invoice.status;
      const next: InvoiceRecord = {
        ...invoice,
        sendTo: to,
        status: nextStatus,
        sent: [...(invoice.sent ?? []), entry],
        updatedAt: new Date().toISOString(),
      };
      const saved = await upsertEntity({
        sql,
        userId: context.userId,
        table: "gst_invoices",
        entity: "invoices",
        record: next,
        extra: extrasFor("invoices", next as unknown as Record<string, unknown>),
      });
      if (!saved.ok) {
        return {
          ok: true,
          sent: true,
          via: "smtp",
          record: next,
        };
      }
      await writeAudit(sql, context.userId, "invoices", invoice.id, "send", { to, kind: data.kind });
      return { ok: true, sent: true, via: "smtp", record: saved.record as InvoiceRecord };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not send the invoice." };
    }
  });

export { emptyWorkspace };
