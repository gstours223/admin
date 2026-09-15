import { Link } from "@tanstack/react-router";
import { QUERY_STAGES, type QueryRecord } from "@/lib/crm/types";
import { formatDate, money, STAGE_TONE } from "@/lib/crm/format";
import { StatusBadge } from "./ui";

export function QueryPipeline({ rows }: { rows: QueryRecord[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {QUERY_STAGES.map((stage) => {
        const list = rows.filter((r) => r.stage === stage);
        return (
          <div
            key={stage}
            className="w-64 shrink-0 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{stage}</p>
              <span className="text-xs tabular text-muted-foreground">{list.length}</span>
            </div>
            <ul className="space-y-2">
              {list.map((q) => (
                <li key={q.id}>
                  <Link
                    to="/queries/$id"
                    params={{ id: q.id }}
                    className="block rounded-md bg-muted/60 px-3 py-2 hover:bg-secondary"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{q.ref}</span>
                      <StatusBadge tone={STAGE_TONE[q.stage]}>{q.brand.split(" ")[0]}</StatusBadge>
                    </span>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{q.company}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.from} → {q.to}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(q.tripDate)} · {money(q.amount)}
                    </p>
                  </Link>
                </li>
              ))}
              {list.length === 0 ? (
                <li className="px-1 py-6 text-center text-xs text-muted-foreground">Empty</li>
              ) : null}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
