import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/crm/format";
import type { BookingRecord, ConflictReport } from "@/lib/crm/types";

export function ConflictBanner({
  report,
  bookings,
  onDelete,
}: {
  report: ConflictReport;
  bookings: BookingRecord[];
  onDelete?: (id: string) => void;
}) {
  const byId = new Map(bookings.map((b) => [b.id, b]));
  if (!report.hard.length && !report.soft.length && !report.duplicates.length) return null;

  return (
    <div className="space-y-3">
      {report.hard.map((c) => (
        <div
          key={`${c.a}-${c.b}-${c.field}`}
          className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm sm:flex-row sm:items-center"
        >
          <AlertTriangle className="size-4 shrink-0 text-danger" />
          <p className="flex-1 text-danger">
            Hard conflict — {c.reason}. Both bookings are live.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/bookings/$id" params={{ id: c.a }}>
                {byId.get(c.a)?.ref ?? "Open"}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/bookings/$id" params={{ id: c.b }}>
                {byId.get(c.b)?.ref ?? "Open"}
              </Link>
            </Button>
          </div>
        </div>
      ))}

      {report.soft.map((c) => (
        <div
          key={`${c.date}-${c.vehicle}`}
          className="rounded-xl border border-warning/30 bg-brand/8 px-4 py-3 text-sm text-warning"
        >
          Soft signal — {c.refs.length} live bookings want a {c.vehicle} on {formatDate(c.date)}:{" "}
          {c.refs.join(", ")}. Worth a look; the fleet may cover it.
        </div>
      ))}

      {report.duplicates.map((g) => {
        const rows = g.ids.map((id) => byId.get(id)).filter(Boolean) as BookingRecord[];
        return (
          <div key={g.key} className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium text-primary">Likely duplicate</p>
            <p className="text-xs text-muted-foreground">
              Same customer, first date and route. Compare and delete the stray — never automatic.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-1 pr-3">Ref</th>
                    <th className="py-1 pr-3">Amount</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="py-2 pr-3">
                        <Link className="text-primary underline-offset-2 hover:underline" to="/bookings/$id" params={{ id: b.id }}>
                          {b.ref}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 tabular">€{b.amount.toFixed(2)}</td>
                      <td className="py-2 pr-3">{b.status}</td>
                      <td className="py-2 text-right">
                        {onDelete ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`Delete ${b.ref}? This cannot be undone from here.`)) {
                                void onDelete(b.id);
                              }
                            }}
                          >
                            Delete this one
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
