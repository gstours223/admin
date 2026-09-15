import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankContact } from "@/lib/crm/blank";
import type { ContactRecord } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const { data, saveEntity, removeEntity, actor } = useCrm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ContactRecord | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.contacts
      .filter((c) =>
        !s ? true : `${c.name} ${c.company} ${c.email} ${c.role}`.toLowerCase().includes(s),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.contacts, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Contacts"
        description="Who we actually talk to. Bills-directly flags the person who should receive the invoice, not just the organisation."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setDraft(blankContact(actor));
              setOpen(true);
            }}
          >
            New contact
          </Button>
        }
      />
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card sm:max-w-sm" />
      {rows.length === 0 ? (
        <EmptyState title="No contacts yet" />
      ) : (
        <DataTable columns={["Name", "Company", "Role", "Email", "Phone", "Bill directly", ""]}>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3">{c.company}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.role}</td>
              <td className="px-4 py-3">{c.email}</td>
              <td className="px-4 py-3">{c.phone}</td>
              <td className="px-4 py-3 text-xs">{c.billsDirectly.startsWith("Yes") ? "Yes" : "No"}</td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(c);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete ${c.name}?`)) void removeEntity("contacts", c.id);
                  }}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft && data.contacts.some((c) => c.id === draft.id) ? "Edit contact" : "New contact"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Company">
                <Input
                  list="ct-cos"
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
                <datalist id="ct-cos">
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Role">
                <Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </Field>
              <Field label="Bills directly">
                <NativeSelect
                  value={draft.billsDirectly}
                  onChange={(e) =>
                    setDraft({ ...draft, billsDirectly: e.target.value as ContactRecord["billsDirectly"] })
                  }
                >
                  <option>No</option>
                  <option>Yes - bill them directly</option>
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
                const ok = await saveEntity("contacts", draft);
                if (ok) setOpen(false);
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
