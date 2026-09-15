-- Public website enquiries. Append-only. Staff claim into their workspace;
-- this table is never used as a silent overwrite of live queries.
create table if not exists gst_inbox (
  id          text primary key,
  data        text not null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  claimed_by  text
);
create index if not exists gst_inbox_unclaimed_idx on gst_inbox (claimed_at, created_at desc);
