-- ─── 022 — Daily Operations Log (Shift Notes) ──────────────────────────────
--
-- A shared, per-day operational log. Staff jot quick shift notes ("Çorap
-- yok satıldı", "POS yeniden başlatıldı", "Boyama setleri dolduruldu") that
-- managers/owners review during End-of-Day closing.
--
-- Completely independent — NOT stored inside customer records. Each note
-- auto-captures date/time (created_at), staff (created_by + name snapshot),
-- and branch. No manual timestamp entry.
--
-- Additive + idempotent — safe on the live database.

create extension if not exists pgcrypto;

create table if not exists public.daily_operation_notes (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid,                                   -- nullable (single-shop today)
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text,                                   -- snapshot so history survives profile edits
  note            text not null check (length(btrim(note)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists daily_operation_notes_created_idx
  on public.daily_operation_notes (created_at desc);
create index if not exists daily_operation_notes_branch_idx
  on public.daily_operation_notes (branch_id, created_at desc);

alter table public.daily_operation_notes enable row level security;

-- Read: any authenticated user (the app scopes to the active branch/day).
drop policy if exists "op_notes read" on public.daily_operation_notes;
create policy "op_notes read"
  on public.daily_operation_notes for select
  to authenticated using (true);

-- Insert: staff may create; the row must be attributed to themselves.
drop policy if exists "op_notes insert" on public.daily_operation_notes;
create policy "op_notes insert"
  on public.daily_operation_notes for insert
  to authenticated
  with check (created_by = auth.uid());

-- Update: a user may edit their OWN note. Managers/admins may edit any.
drop policy if exists "op_notes update" on public.daily_operation_notes;
create policy "op_notes update"
  on public.daily_operation_notes for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles
                where id = auth.uid() and role in ('manager','admin','super_admin'))
  );

-- Delete: the creator OR a manager/admin/owner.
drop policy if exists "op_notes delete" on public.daily_operation_notes;
create policy "op_notes delete"
  on public.daily_operation_notes for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles
                where id = auth.uid() and role in ('manager','admin','super_admin'))
  );

-- Keep updated_at fresh on edits.
create or replace function public.touch_op_note_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_op_note on public.daily_operation_notes;
create trigger trg_touch_op_note
  before update on public.daily_operation_notes
  for each row execute function public.touch_op_note_updated_at();
