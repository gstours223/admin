-- Drivers (working hours) and vehicles (maintenance) — same JSON-blob pattern.

create table if not exists gst_drivers (
  user_id    text not null,
  id         text not null,
  name       text,
  data       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists gst_drivers_user_idx on gst_drivers (user_id);

create table if not exists gst_vehicles (
  user_id    text not null,
  id         text not null,
  plate      text,
  name       text,
  data       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists gst_vehicles_user_idx on gst_vehicles (user_id);
