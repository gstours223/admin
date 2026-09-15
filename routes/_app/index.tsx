import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WelcomeEmpty } from "@/components/crm/welcome";
import { Kpi, PageHeader, StatusBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import {
  BOOKING_TONE,
  INVOICE_TONE,
  STAGE_TONE,
  formatDate,
  invoiceTotals,
  liveInvoiceStatus,
  money,
  moneyShort,
} from "@/lib/crm/format";
import { detectConflicts, hardConflictIds } from "@/lib/crm/logic";
import { OPEN_STAGES } from "@/lib/crm/types";
import { useCrm } from "@/lib/crm/workspace";

export const Route = createFileRoute("/_app/")({
  component: DeskPage,
});

function DeskPage() {
  const { status, error, empty, data, reload } = useCrm();
  const { queries, bookings, invoices, companies, drivers, vehicles } = data;

  const openQ = queries.filter((q) => OPEN_STAGES.includes(q.stage));
  const liveB = bookings.filter((b) => b.status !== "Cancelled" && b.status !== "Completed");
  const unpaid = invoices.filter((i) => {
    const st = liveInvoiceStatus(i.status, i.dueDate, i.type);
    return st === "Sent" || st === "Overdue" || st === "Reminded" || st === "Partly paid";
  });
  const unpaidTotal = unpaid.reduce((s, i) => s + invoiceTotals(i.lines).gross - (i.amountPaid || 0), 0);
  const overdue = invoices.filter((i) => liveInvoiceStatus(i.status, i.dueDate, i.type) === "Overdue");
  const report = detectConflicts(bookings);
  const hardIds = hardConflictIds(report);

  const revenue = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    return months.slice(0, now.getMonth() + 1).map((month, i) => {
      const start = `${now.getFullYear()}-${String(i + 1).padStart(2, "0")}-01`;
      const endM = i + 2;
      const end =
        endM === 13 ? `${now.getFullYear() + 1}-01-01` : `${now.getFullYear()}-${String(endM).padStart(2, "0")}-01`;
      const total = invoices
        .filter((inv) => inv.paidDate && inv.paidDate >= start && inv.paidDate < end)
        .reduce((s, inv) => s + (inv.amountPaid || invoiceTotals(inv.lines).gross), 0);
      return { month, total };
    });
  }, [invoices]);

  if (status === "loading") {
    return <div className="h-64 animate-pulse rounded-xl bg-card shadow-[var(--shadow-border)]" />;
  }
  if (status === "error") {
    return (
      <div className="rounded-xl bg-danger/10 p-6 text-danger">
        <p className="font-medium">The workspace could not be loaded.</p>
        <p className="mt-1 text-sm">{error}</p>
        <p className="mt-2 text-sm">Nothing was changed. Retry when you are ready — we will not invent missing data.</p>
        <Button className="mt-4" variant="outline" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    );
  }
  if (empty) {
    return <WelcomeEmpty />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={data.settings.city}
        title="Planning desk"
        description="Open queries, live journeys, unpaid invoices, drivers on the clock and the fleet."
        actions={
          <Button asChild variant="brand">
            <Link to="/queries">New query</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open queries" value={String(openQ.length)} hint="Not won or lost" />
        <Kpi label="Live bookings" value={String(liveB.length)} hint={`${hardIds.size} in hard conflict`} />
        <Kpi label="Unpaid" value={moneyShort(unpaidTotal)} hint={`${overdue.length} overdue`} />
        <Kpi
          label="Fleet"
          value={`${vehicles.length} / ${drivers.length}`}
          hint={`${vehicles.length} vehicles · ${drivers.length} drivers`}
        />
      </div>

      {report.hard.length > 0 ? (
        <div className="rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger">
          {report.hard.length} hard driver/plate conflict{report.hard.length === 1 ? "" : "s"} on the board.{" "}
          <Link to="/bookings" className="underline underline-offset-2">
            Review bookings
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-3">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Paid this year
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue}>
                <CartesianGrid stroke="rgb(16 62 98 / 0.08)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#5c6b78" />
                <YAxis tick={{ fontSize: 11 }} stroke="#5c6b78" />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="total" fill="#103E62" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Follow-ups
          </p>
          <ul className="mt-3 divide-y divide-border">
            {openQ
              .filter((q) => q.nextAction)
              .slice(0, 6)
              .map((q) => (
                <li key={q.id} className="py-2.5">
                  <Link to="/queries/$id" params={{ id: q.id }} className="block">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{q.ref}</span>
                      <StatusBadge tone={STAGE_TONE[q.stage]}>{q.stage}</StatusBadge>
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {q.company} · {q.nextAction}
                      {q.nextActionDate ? ` · ${formatDate(q.nextActionDate)}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            {openQ.filter((q) => q.nextAction).length === 0 ? (
              <li className="py-6 text-sm text-muted-foreground">No next actions parked.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Coming up
          </p>
          <ul className="mt-3 divide-y divide-border">
            {bookings
              .filter((b) => b.status !== "Cancelled")
              .slice()
              .sort((a, b) => (a.dates[0]?.date || "").localeCompare(b.dates[0]?.date || ""))
              .slice(0, 6)
              .map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to="/bookings/$id" params={{ id: b.id }} className="min-w-0">
                    <span className="font-medium">{b.ref}</span>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.company} · {formatDate(b.dates[0]?.date || "")}
                    </p>
                  </Link>
                  <StatusBadge tone={hardIds.has(b.id) ? "danger" : BOOKING_TONE[b.status]}>
                    {hardIds.has(b.id) ? "Conflict" : b.status}
                  </StatusBadge>
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Money out
          </p>
          <ul className="mt-3 divide-y divide-border">
            {unpaid.slice(0, 6).map((i) => {
              const live = liveInvoiceStatus(i.status, i.dueDate, i.type);
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to="/invoices/$id" params={{ id: i.id }} className="min-w-0">
                    <span className="font-medium">{i.number}</span>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.company} · due {formatDate(i.dueDate)}
                    </p>
                  </Link>
                  <StatusBadge tone={INVOICE_TONE[live]}>{live}</StatusBadge>
                </li>
              );
            })}
            {unpaid.length === 0 ? (
              <li className="py-6 text-sm text-muted-foreground">Nothing outstanding.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {companies.length} customers on file. Use Drivers for hours and Vehicles for APK and repairs.
      </p>
    </div>
  );
}
