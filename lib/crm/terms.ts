export type TermClause = { title: string; body: string };

export const QUOTE_TERMS: TermClause[] = [
  {
    title: "1. Validity",
    body: "This quotation is valid for 14 days from the date shown, unless a shorter validity is stated on the face of the quote. Prices are in euro, exclusive of BTW unless otherwise indicated.",
  },
  {
    title: "2. Confirmation",
    body: "A booking is confirmed only when we have accepted it in writing (including email or WhatsApp) and, where required, a deposit has been received. Until then vehicle availability is not guaranteed.",
  },
  {
    title: "3. Cancellation by the client",
    body: "Cancellation more than 14 days before the first travel date: no charge. 8–14 days: 25% of the quoted amount. 48 hours–7 days: 50%. Inside 48 hours, or no-show: 100%. Credit notes are issued where a cancellation fee is less than any amount already invoiced.",
  },
  {
    title: "4. Waiting time and schedule changes",
    body: "The quoted price covers the hours and kilometres described. Waiting time beyond the agreed window, extra stops, and route changes are charged at the extra-hour and extra-kilometre rates shown on the client record or, if none, at our standard rates then in force.",
  },
  {
    title: "5. Passenger numbers and luggage",
    body: "The vehicle is specified for the passenger count given. A material increase in pax or oversized luggage may require a larger vehicle at additional cost. Children count as passengers.",
  },
  {
    title: "6. Subcontracting",
    body: "We may perform the journey with our own fleet or with an approved subcontractor operating to the same brief. The contracting party remains GS Tours B.V. unless a different legal name is shown on the invoice.",
  },
  {
    title: "7. Payment",
    body: "Private individuals: payable before departure unless agreed otherwise. Organisations: according to the payment terms on the invoice (default 14 days). Full banking details are provided on the proforma invoice. Overdue amounts may be suspended from further work.",
  },
  {
    title: "8. Liability",
    body: "We carry statutory passenger and carrier insurance. We are not liable for delays caused by traffic, weather, border control, or events outside our reasonable control, nor for loss of onward connections unless caused by our proven negligence.",
  },
  {
    title: "9. Force majeure",
    body: "Strikes, severe weather, civil unrest, epidemic restrictions, and comparable events release both parties from performance for the duration of the event. Prepayments for a cancelled journey are refunded or rebooked at the client’s choice.",
  },
  {
    title: "10. Governing law",
    body: "This quotation and any resulting contract are governed by Dutch law. The competent court is the court of Den Haag, the Netherlands.",
  },
];
