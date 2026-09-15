import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { DataTable, EmptyState, Field, NativeSelect, PageHeader, StatusBadge } from "@/components/crm/ui";
import { QueryPipeline } from "@/components/crm/pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankQuery } from "@/lib/crm/blank";
import { formatDate, money, STAGE_TONE } from "@/lib/crm/format";
import { findOpenQueryForCompany, mergeQuery } from "@/lib/crm/logic";
import { BRANDS, QUERY_SOURCES, QUERY_STAGES, VEHICLES, type QueryRecord, type QueryStage } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/queries/")({
  component: QueriesPage,
});

function QueriesPage() {
  const { data, saveEntity, nextRef, actor } = useCrm();
  const navigate = useNavigate();
  const [stage, setStage] = useState<QueryStage | "All">("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QueryRecord | null>(null);
  const [mergeTarget, setMergeTarget] = useState<QueryRecord | null>(null);
  const [view, setView] = useState<"board" | "list">("board");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.queries
      .filter((r) => (stage === "All" ? true : r.stage === stage))
      .filter((r) =>
        !s
          ? true
          : `${r.ref} ${r.company} ${r.from} ${r.to} ${r.contactName}`.toLowerCase().includes(s),
      )
      .sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  }, [data.queries, stage, q]);

  async function startNew() {
    const ref = await nextRef("query");
    if (!ref) return;
    setDraft(blankQuery(actor, ref));
    setMergeTarget(null);
    setOpen(true);
  }

  async function create() {
    if (!draft) return;
    if (!draft.company.trim()) {
      toast.error("Company is required.");
      return;
    }
    const existing = findOpenQueryForCompany(data.queries, draft.company);
    if (existing && !mergeTarget) {
      setMergeTarget(existing);
      return;
    }
    if (mergeTarget) {
      const merged = mergeQuery(mergeTarget, draft);
      const ok = await saveEntity("queries", merged);
      if (ok) {
        toast.success(`Merged into ${mergeTarget.ref}. Empty incoming fields were left as they were.`);
        setOpen(false);
        void navigate({ to: "/queries/$id", params: { id: mergeTarget.id } });
      }
      return;
    }
    const ok = await saveEntity("queries", draft);
    if (ok) {
      setOpen(false);
      void navigate({ to: "/queries/$id", params: { id: draft.id } });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Queries"
        description="Every enquiry, with an append-only contact log. Open queries for the same customer merge instead of duplicating."
        actions={
          <div className="flex gap-2">
            <Button
              variant={view === "board" ? "secondary" : "outline"}
              onClick={() => setView("board")}
            >
              Board
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "outline"}
              onClick={() => setView("list")}
            >
              List
            </Button>
            <Button variant="brand" onClick={() => void startNew()}>
              New query
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search ref, customer, route…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-card sm:max-w-sm"
        />
        <NativeSelect
          value={stage}
          onChange={(e) => setStage(e.target.value as QueryStage | "All")}
          className="bg-card sm:w-44"
        >
          <option>All</option>
          {QUERY_STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["All", ...QUERY_STAGES] as const).map((s) => {
          const n = s === "All" ? data.queries.length : data.queries.filter((r) => r.stage === s).length;
          const on = stage === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`h-9 shrink-0 rounded-full px-3 text-xs font-medium ${
                on ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-[var(--shadow-border)]"
              }`}
            >
              {s} {n}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No queries in this view" hint="Start one, or load the sample workspace from the desk." />
      ) : view === "board" ? (
        <QueryPipeline rows={rows} />
      ) : (
        <DataTable columns={["Ref", "Customer", "Trip", "Route", "Stage", "Amount", "Owner"]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link to="/queries/$id" params={{ id: r.id }} className="font-medium text-primary">
                  {r.ref}
                </Link>
              </td>
              <td className="px-4 py-3">{r.company}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.tripDate)}</td>
              <td className="max-w-[14rem] truncate px-4 py-3 text-muted-foreground">
                {r.from} → {r.to}
              </td>
              <td className="px-4 py-3">
                <StatusBadge tone={STAGE_TONE[r.stage]}>{r.stage}</StatusBadge>
              </td>
              <td className="px-4 py-3 tabular">{money(r.amount)}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.owner}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.ref ?? "New query"}</DialogTitle>
          </DialogHeader>
          {mergeTarget ? (
            <div className="rounded-md bg-brand/10 px-3 py-2 text-sm">
              {mergeTarget.company} already has open query {mergeTarget.ref} ({mergeTarget.stage}). Merging
              will append to its log and refresh only fields you actually filled.
            </div>
          ) : null}
          {draft ? (
            <div className="grid gap-3">
              <Field label="Company">
                <Input
                  list="company-names"
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
                <datalist id="company-names">
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand">
                  <NativeSelect
                    value={draft.brand}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value as QueryRecord["brand"] })}
                  >
                    {BRANDS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Source">
                  <NativeSelect
                    value={draft.source}
                    onChange={(e) => setDraft({ ...draft, source: e.target.value as QueryRecord["source"] })}
                  >
                    {QUERY_SOURCES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Contact">
                <Input
                  value={draft.contactName}
                  onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <Input value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
                </Field>
                <Field label="To">
                  <Input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Trip date">
                  <Input
                    type="date"
                    value={draft.tripDate}
                    onChange={(e) => setDraft({ ...draft, tripDate: e.target.value })}
                  />
                </Field>
                <Field label="Pax">
                  <Input
                    type="number"
                    value={draft.pax || ""}
                    onChange={(e) => setDraft({ ...draft, pax: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Vehicle">
                  <NativeSelect
                    value={draft.vehicle}
                    onChange={(e) => setDraft({ ...draft, vehicle: e.target.value as QueryRecord["vehicle"] })}
                  >
                    {VEHICLES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Amount excl. VAT">
                <Input
                  type="number"
                  value={draft.amount || ""}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            {mergeTarget ? (
              <>
                <Button variant="outline" onClick={() => setMergeTarget(null)}>
                  Create separately
                </Button>
                <Button variant="brand" onClick={() => void create()}>
                  Merge into {mergeTarget.ref}
                </Button>
              </>
            ) : (
              <Button onClick={() => void create()}>Save query</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
