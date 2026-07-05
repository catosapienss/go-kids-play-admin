-- ─── 020 — Daily Sequential Label Numbers (atomic, venue-wide) ──────────────
--
-- Replaces the old client-side localStorage counter (per-browser, resets per
-- device, two tablets both started at 1) with a single atomic server counter.
--
-- Every session row = one child entering the playground. A BEFORE INSERT
-- trigger assigns the next number for the current TR-local calendar day, so:
--
--   • Numbering is per-CHILD (one parent + 3 kids → 3 consecutive numbers).
--   • The counter resets automatically at 00:00 Europe/Istanbul.
--   • Assignment is atomic + concurrency-safe (INSERT … ON CONFLICT DO UPDATE
--     serialises concurrent registrations on the per-day row).
--   • No gaps from rolled-back inserts (counter bump shares the txn).
--   • sessions.daily_seq is the SINGLE source of truth — label printing,
--     dashboard "today's entries", reports and end-of-day all read it (the
--     max daily_seq of the day == number of children entered today).
--
-- Additive + idempotent — safe to run on the live database.

-- ── 1. Column on sessions ───────────────────────────────────────────────────
alter table public.sessions
  add column if not exists daily_seq int;

create index if not exists sessions_daily_seq_idx on public.sessions (daily_seq);

-- ── 2. Per-day counter table ────────────────────────────────────────────────
create table if not exists public.daily_label_counters (
  seq_date    date primary key,
  last_value  int  not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.daily_label_counters enable row level security;

drop policy if exists "daily_label_counters read" on public.daily_label_counters;
create policy "daily_label_counters read"
  on public.daily_label_counters for select
  to authenticated using (true);
-- Writes happen ONLY through the SECURITY DEFINER trigger below (which bypasses
-- RLS as the function owner), so no insert/update policy is granted to clients.

-- ── 3. Atomic assignment trigger ────────────────────────────────────────────
create or replace function public.assign_session_daily_seq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_next int;
begin
  -- Respect an explicitly-provided value (used by the backfill below).
  if new.daily_seq is not null then
    return new;
  end if;

  -- TR-local calendar day → the counter flips exactly at 00:00 Istanbul time.
  v_date := (now() at time zone 'Europe/Istanbul')::date;

  insert into public.daily_label_counters (seq_date, last_value)
       values (v_date, 1)
  on conflict (seq_date)
       do update set last_value = public.daily_label_counters.last_value + 1,
                     updated_at = now()
    returning last_value into v_next;

  new.daily_seq := v_next;
  return new;
end;
$$;

drop trigger if exists trg_assign_session_daily_seq on public.sessions;
create trigger trg_assign_session_daily_seq
  before insert on public.sessions
  for each row execute function public.assign_session_daily_seq();

-- ── 4. Backfill TODAY's existing sessions in entry order ────────────────────
-- Keeps numbering continuous if the migration runs mid-day. New inserts then
-- continue from the seeded counter value.
do $$
declare
  v_date date := (now() at time zone 'Europe/Istanbul')::date;
  v_max  int  := 0;
  r      record;
begin
  for r in
    select id
      from public.sessions
     where daily_seq is null
       and (created_at at time zone 'Europe/Istanbul')::date = v_date
     order by created_at asc
  loop
    v_max := v_max + 1;
    update public.sessions set daily_seq = v_max where id = r.id;
  end loop;

  if v_max > 0 then
    insert into public.daily_label_counters (seq_date, last_value)
         values (v_date, v_max)
    on conflict (seq_date)
         do update set last_value = greatest(public.daily_label_counters.last_value, excluded.last_value),
                       updated_at = now();
  end if;
end $$;
