import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { downloadBackup, listAudit } from "@/lib/crm/server";
import { Field, NativeSelect, PageHeader, Panel, SectionTitle } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/crm/format";
import { VAT_RATES, type AuditEntry, type SettingsRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data, patchSettings, previewFile, restoreFile, loadDemo } = useCrm();
  const [s, setS] = useState<SettingsRecord>(data.settings);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => setS(data.settings), [data.settings]);

  useEffect(() => {
    void listAudit().then((res) => {
      if (!res.ok) setAuditError(res.error);
      else setAudit(res.rows);
    });
  }, [data]);

  const set = (patch: Partial<SettingsRecord>) => setS({ ...s, ...patch });

  async function onBackup() {
    const res = await downloadBackup();
    if (!res.ok) {
      alert(res.error);
      return;
    }
    const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gstours-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="Settings"
        description="Letterhead, bank, numbering and the restore flow that never deletes records the file doesn't mention."
        actions={<Button onClick={() => void patchSettings(s)}>Save settings</Button>}
      />

      <Panel className="space-y-3">
        <SectionTitle>Letterhead</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name">
            <Input value={s.legalName} onChange={(e) => set({ legalName: e.target.value })} />
          </Field>
          <Field label="Trading name">
            <Input value={s.tradingName} onChange={(e) => set({ tradingName: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <Input value={s.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </Field>
          <Field label="Website">
            <Input value={s.website} onChange={(e) => set({ website: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={s.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={s.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={s.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Postcode">
            <Input value={s.postcode} onChange={(e) => set({ postcode: e.target.value })} />
          </Field>
          <Field label="City">
            <Input value={s.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={s.country} onChange={(e) => set({ country: e.target.value })} />
          </Field>
          <Field label="KvK">
            <Input value={s.kvk} onChange={(e) => set({ kvk: e.target.value })} />
          </Field>
          <Field label="BTW">
            <Input value={s.btw} onChange={(e) => set({ btw: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle>Bank & numbering</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank">
            <Input value={s.bankName} onChange={(e) => set({ bankName: e.target.value })} />
          </Field>
          <Field label="Account name">
            <Input value={s.accountName} onChange={(e) => set({ accountName: e.target.value })} />
          </Field>
          <Field label="IBAN">
            <Input value={s.iban} onChange={(e) => set({ iban: e.target.value })} />
          </Field>
          <Field label="BIC">
            <Input value={s.bic} onChange={(e) => set({ bic: e.target.value })} />
          </Field>
          <Field label="Number prefix">
            <Input value={s.numberPrefix} onChange={(e) => set({ numberPrefix: e.target.value })} />
          </Field>
          <Field label="Next invoice number">
            <Input
              type="number"
              value={s.nextNumber}
              onChange={(e) => set({ nextNumber: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="Default VAT">
            <NativeSelect
              value={s.defaultVat}
              onChange={(e) => set({ defaultVat: e.target.value as SettingsRecord["defaultVat"] })}
            >
              {VAT_RATES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Default terms (days)">
            <Input
              type="number"
              value={s.termsDays}
              onChange={(e) => set({ termsDays: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Watermark letters">
            <Input value={s.watermark} onChange={(e) => set({ watermark: e.target.value })} />
          </Field>
          <Field label="Thanks line" className="sm:col-span-2">
            <Input value={s.thanks} onChange={(e) => set({ thanks: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle>Email templates</SectionTitle>
        <p className="text-xs text-muted-foreground">
          Placeholders: {"{{number}}"} {"{{company}}"} {"{{contact}}"} {"{{due}}"} {"{{signature}}"}
        </p>
        <Field label="Invoice subject">
          <Input value={s.mailInvoiceSubject} onChange={(e) => set({ mailInvoiceSubject: e.target.value })} />
        </Field>
        <Field label="Invoice body">
          <Textarea value={s.mailInvoice} onChange={(e) => set({ mailInvoice: e.target.value })} />
        </Field>
        <Field label="Reminder subject">
          <Input value={s.mailReminderSubject} onChange={(e) => set({ mailReminderSubject: e.target.value })} />
        </Field>
        <Field label="Reminder body">
          <Textarea value={s.mailReminder} onChange={(e) => set({ mailReminder: e.target.value })} />
        </Field>
        <Field label="Signature">
          <Textarea value={s.signature} onChange={(e) => set({ signature: e.target.value })} />
        </Field>
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle>Send invoices (Hostinger)</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Mailboxes at gstours.nl go through Hostinger. Use the full address as the username, port
          465, and the mailbox password. The password is stored with your workspace and never shown
          again — leave the field blank to keep the current one.
          {s.smtpConfigured ? " A password is already stored." : " No password stored yet — sending will offer a PDF download instead."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SMTP host">
            <Input
              value={s.smtpHost}
              onChange={(e) => set({ smtpHost: e.target.value })}
              placeholder="smtp.hostinger.com"
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={s.smtpPort}
              onChange={(e) => set({ smtpPort: Number(e.target.value) || 465 })}
            />
          </Field>
          <Field label="Username (mailbox)">
            <Input
              value={s.smtpUser}
              onChange={(e) => set({ smtpUser: e.target.value })}
              placeholder="factuur@gstours.nl"
            />
          </Field>
          <Field label="Password" hint="Leave blank to keep the stored password.">
            <Input
              type="password"
              value={s.smtpPass}
              onChange={(e) => set({ smtpPass: e.target.value })}
              autoComplete="new-password"
              placeholder={s.smtpConfigured ? "Stored — type to replace" : ""}
            />
          </Field>
          <Field label="From address" className="sm:col-span-2">
            <Input
              value={s.smtpFrom}
              onChange={(e) => set({ smtpFrom: e.target.value })}
              placeholder="factuur@gstours.nl"
            />
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle>Backup & restore</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Restore only upserts. Records that exist here but not in the file are never deleted. Every
          write is snapshotted to the audit log first. Nothing runs on page load.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void onBackup()}>
            Download backup
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              Restore from file
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const parsed = JSON.parse(await file.text());
                    const preview = await previewFile(parsed);
                    if (!preview) return;
                    const lines = [
                      "This will upsert records from the file. Nothing currently in the workspace will be deleted just because it is missing from the file.",
                      "",
                      `Add: customers ${preview.add.companies}, queries ${preview.add.queries}, bookings ${preview.add.bookings}, invoices ${preview.add.invoices}, drivers ${preview.add.drivers}, vehicles ${preview.add.vehicles}, vendors ${preview.add.vendors}, contacts ${preview.add.contacts}.`,
                      `Update: customers ${preview.update.companies}, queries ${preview.update.queries}, bookings ${preview.update.bookings}, invoices ${preview.update.invoices}.`,
                      preview.invalid ? `${preview.invalid} rows skipped (no id).` : "",
                      "",
                      "Apply this restore?",
                    ]
                      .filter(Boolean)
                      .join("\n");
                    if (!confirm(lines)) return;
                    await restoreFile(parsed);
                  } catch {
                    alert("That file could not be read as a GS Tours backup.");
                  }
                }}
              />
            </label>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (
                !confirm(
                  "Load the sample Den Haag workspace? Matching ids will be updated. Records not in the sample stay. This is an explicit upsert, not a wipe.",
                )
              )
                return;
              void loadDemo();
            }}
          >
            Load sample workspace
          </Button>
        </div>
      </Panel>

      <Panel>
        <SectionTitle>Audit log</SectionTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Append-only. Pre-write snapshots. Never truncated automatically.
        </p>
        {auditError ? (
          <p className="mt-3 text-sm text-danger">{auditError}</p>
        ) : (
          <ul className="mt-3 max-h-80 overflow-y-auto divide-y divide-border text-sm">
            {(audit ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{a.action}</span> {a.entity}
                  {a.entityId ? ` · ${a.entityId}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(a.at)}</span>
              </li>
            ))}
            {audit && audit.length === 0 ? (
              <li className="py-4 text-muted-foreground">No writes yet.</li>
            ) : null}
          </ul>
        )}
      </Panel>
    </div>
  );
}
