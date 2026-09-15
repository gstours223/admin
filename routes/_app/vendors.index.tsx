import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankVendor } from "@/lib/crm/blank";
import { VENDOR_STANDING, VENDOR_TYPES, type VendorRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/vendors/")({
  component: VendorsPage,
});

function standingTone(s: VendorRecord["standing"]) {
  if (s === "Preferred") return "success" as const;
  if (s === "Do not use") return "danger" as const;
  if (s === "Backup only") return "warning" as const;
  return "chrome" as const;
}

function VendorsPage() {
  const { data, saveEntity, actor } = useCrm();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VendorRecord | null>(null);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.vendors
      .filter((v) => (!s ? true : `${v.name} ${v.city} ${v.type}`.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.vendors, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supply"
        title="Vendors"
        description="Coach operators, freelance drivers, hotels, ferries and attractions. Standing is the only thing that should block a booking."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setDraft(blankVendor(actor));
              setOpen(true);
            }}
          >
            New vendor
          </Button>
        }
      />
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
      {rows.length === 0 ? (
        <EmptyState title="No vendors yet" />
      ) : (
        <DataTable columns={["Name", "Type", "City", "Standing", "Contact"]}>
          {rows.map((v) => (
            <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link to="/vendors/$id" params={{ id: v.id }} className="font-medium text-primary">
                  {v.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{v.type}</td>
              <td className="px-4 py-3">{v.city}</td>
              <td className="px-4 py-3">
                <StatusBadge tone={standingTone(v.standing)}>{v.standing}</StatusBadge>
              </td>
              <td className="px-4 py-3">{v.contactStatus}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New vendor</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Type">
                <NativeSelect
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as VendorRecord["type"] })}
                >
                  {VENDOR_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Standing">
                <NativeSelect
                  value={draft.standing}
                  onChange={(e) => setDraft({ ...draft, standing: e.target.value as VendorRecord["standing"] })}
                >
                  {VENDOR_STANDING.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!draft?.name.trim()) {
                  toast.error("A name is required.");
                  return;
                }
                const ok = await saveEntity("vendors", draft);
                if (ok) {
                  setOpen(false);
                  void navigate({ to: "/vendors/$id", params: { id: draft.id } });
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
