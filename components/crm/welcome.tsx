import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sampleCounts } from "@/lib/crm/seed";
import { useCrm } from "@/lib/crm/workspace";
import { Mark } from "./mark";

export function WelcomeEmpty() {
  const { loadDemo, previewFile, restoreFile } = useCrm();
  const [busy, setBusy] = useState(false);
  const counts = sampleCounts();

  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-border)]">
      <div className="flex justify-center">
        <Mark className="size-16" />
      </div>
      <h1 className="mt-4 font-display text-3xl text-primary">Your workspace is empty</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing is created until you choose. Load a sample Den Haag workspace to explore every
        module, restore a backup file, or start from scratch.
      </p>
      <div className="mt-6 rounded-lg bg-muted/70 px-4 py-3 text-left text-sm">
        <p className="font-medium text-primary">Sample workspace will add</p>
        <p className="mt-1 text-muted-foreground">
          {counts.companies} customers · {counts.queries} queries · {counts.bookings} bookings ·{" "}
          {counts.invoices} invoices · {counts.drivers} drivers · {counts.vehicles} vehicles ·{" "}
          {counts.vendors} vendors · {counts.contacts} contacts
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Includes a hard plate conflict, Embassy of India rates, driver hours and a vehicle with
          overdue APK. Existing records (none yet) would be upserted, never deleted.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          variant="brand"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void loadDemo().finally(() => setBusy(false));
          }}
        >
          {busy ? "Loading…" : "Load sample workspace"}
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
                  const msg = [
                    `Add: ${preview.add.companies} customers, ${preview.add.queries} queries, ${preview.add.bookings} bookings, ${preview.add.invoices} invoices, ${preview.add.drivers} drivers, ${preview.add.vehicles} vehicles.`,
                    `Update existing: ${preview.update.companies} customers, ${preview.update.queries} queries, ${preview.update.bookings} bookings, ${preview.update.invoices} invoices.`,
                    "Records in the live workspace that are not in this file will be left untouched.",
                    "Apply this restore?",
                  ].join("\n\n");
                  if (!confirm(msg)) return;
                  await restoreFile(parsed);
                } catch {
                  alert("That file could not be read as a GS Tours backup.");
                }
              }}
            />
          </label>
        </Button>
      </div>
    </div>
  );
}
