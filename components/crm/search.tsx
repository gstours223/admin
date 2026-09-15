import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCrm } from "@/lib/crm/workspace";

export function CommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data } = useCrm();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const hits = useMemo(() => {
    if (!query) return [];
    const out: { to: string; params?: { id: string }; label: string; hint: string }[] = [];
    for (const c of data.companies) {
      if (`${c.name} ${c.city} ${c.contactName}`.toLowerCase().includes(query)) {
        out.push({ to: "/customers/$id", params: { id: c.id }, label: c.name, hint: "Customer" });
      }
    }
    for (const r of data.queries) {
      if (`${r.ref} ${r.company} ${r.from} ${r.to}`.toLowerCase().includes(query)) {
        out.push({ to: "/queries/$id", params: { id: r.id }, label: r.ref, hint: r.company });
      }
    }
    for (const b of data.bookings) {
      if (`${b.ref} ${b.company} ${b.from} ${b.to}`.toLowerCase().includes(query)) {
        out.push({ to: "/bookings/$id", params: { id: b.id }, label: b.ref, hint: b.company });
      }
    }
    for (const i of data.invoices) {
      if (`${i.number} ${i.company}`.toLowerCase().includes(query)) {
        out.push({ to: "/invoices/$id", params: { id: i.id }, label: i.number, hint: i.company });
      }
    }
    for (const v of data.vendors) {
      if (`${v.name} ${v.city}`.toLowerCase().includes(query)) {
        out.push({ to: "/vendors/$id", params: { id: v.id }, label: v.name, hint: "Vendor" });
      }
    }
    for (const d of data.drivers) {
      if (`${d.name} ${d.phone} ${d.license}`.toLowerCase().includes(query)) {
        out.push({ to: "/drivers", label: d.name, hint: "Driver" });
      }
    }
    for (const vh of data.vehicles) {
      if (`${vh.plate} ${vh.make} ${vh.model} ${vh.kind}`.toLowerCase().includes(query)) {
        out.push({ to: "/vehicles", label: vh.plate, hint: vh.kind });
      }
    }
    return out.slice(0, 12);
  }, [data, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Customer, query, booking, invoice, driver, plate…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="max-h-72 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.label + h.hint}>
              <Link
                to={h.to}
                params={h.params}
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-secondary"
              >
                <span>{h.label}</span>
                <span className="text-xs text-muted-foreground">{h.hint}</span>
              </Link>
            </li>
          ))}
          {query && hits.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
