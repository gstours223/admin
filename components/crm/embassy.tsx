import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, Panel, SectionTitle } from "@/components/crm/ui";
import { money } from "@/lib/crm/format";
import { EMBASSY_RATES, embassyCalculate, type EmbassyVehicle } from "@/lib/crm/logic";
import type { InvoiceLine, VatRate } from "@/lib/crm/types";
import { nid } from "@/lib/utils";

export function EmbassyCalculator({
  defaultVat,
  onAdd,
}: {
  defaultVat: VatRate;
  onAdd: (lines: InvoiceLine[]) => void;
}) {
  const [vehicle, setVehicle] = useState<EmbassyVehicle>("Sedan");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("14:10");
  const [km, setKm] = useState("72");
  const [bookedFor, setBookedFor] = useState("Mr. Kumar");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const result = embassyCalculate({
    vehicle,
    start,
    end,
    km: Number(km) || 0,
    bookedFor,
  });

  return (
    <Panel className="border-l-4 border-l-brand">
      <SectionTitle>Embassy of India rate card</SectionTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        Tender HAG/873/2/2021 · rates excl. 9% BTW. Half day ≤ 6h / 60 km · full day otherwise.
        Extra time billed per commenced 30-minute block.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Vehicle">
          <NativeSelect
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as EmbassyVehicle)}
          >
            <option value="Sedan">{EMBASSY_RATES.Sedan.label}</option>
            <option value="Minivan">{EMBASSY_RATES.Minivan.label}</option>
          </NativeSelect>
        </Field>
        <Field label="Booked for">
          <Input value={bookedFor} onChange={(e) => setBookedFor(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End">
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Kilometres driven">
          <Input type="number" min={0} value={km} onChange={(e) => setKm(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 rounded-md bg-muted/60 px-4 py-3 text-sm">
        <p className="font-medium text-primary">
          {result.tier} · {result.hours.toFixed(1)} h · {result.extraBlocks} extra block
          {result.extraBlocks === 1 ? "" : "s"} · {result.extraKm} extra km
        </p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {result.lines.map((l) => (
            <li key={l.desc}>
              {l.desc} — {l.qty} × {money(l.unitPrice)}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <Button
          variant="brand"
          type="button"
          onClick={() => {
            onAdd(
              result.lines.map((l) => ({
                id: nid("ln"),
                date,
                desc: l.desc,
                qty: l.qty,
                unitPrice: l.unitPrice,
                vat: defaultVat,
              })),
            );
            setStart("08:00");
            setEnd("14:10");
            setKm("");
          }}
        >
          Add lines
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          “Booked for” stays filled — only time and kilometres reset after each add.
        </p>
      </div>
    </Panel>
  );
}
