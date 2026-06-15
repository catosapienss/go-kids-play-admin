-- ============================================================
-- GoKids Play — Manual Entry Code (temporary QR replacement)
-- Migration 008
--
-- Purpose:
--   Until the mobile app ships QR scanning, each parent is assigned a short,
--   human-readable code (e.g. "PLAY-4821" / "GKP-1932" / "KID-7741"). The
--   parent says the code on arrival; the cashier types it; the parent's
--   profile + children are loaded instantly — no need to search by name.
--
-- Architecture:
--   • `entry_method` enum on `entry_codes` — already supports both manual
--     codes (now) and QR payloads (later) — so when QR ships we just add
--     a new row type, no schema migration.
--   • `expires_at` (nullable) — codes can be perpetual loyalty IDs OR
--     short-lived single-use tokens.
--   • `last_used_at` — for "active" / "dormant" lifecycle, plus the
--     auto-expire job below.
-- ============================================================

-- ─── 1. entry_codes table ─────────────────────────────────────────────────────

create table if not exists public.entry_codes (
  code          text primary key,                  -- "PLAY-4821"
  parent_id     uuid not null references public.parents(id) on delete cascade,
  /** "manual" today; future values: "qr", "nfc". */
  entry_method  text not null default 'manual'
                  check (entry_method in ('manual', 'qr', 'nfc')),
  /** active | revoked. Revoked codes stay in the table for audit. */
  status        text not null default 'active'
                  check (status in ('active', 'revoked')),
  branch_id     uuid references public.branches(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  /** null = perpetual loyalty code; set = single-use token. */
  expires_at    timestamptz,
  /** How many sessions opened with this code. */
  use_count     integer not null default 0,
  is_demo       boolean not null default false
);

create index if not exists idx_entry_codes_parent  on public.entry_codes (parent_id);
create index if not exists idx_entry_codes_branch  on public.entry_codes (branch_id);
create index if not exists idx_entry_codes_status  on public.entry_codes (status);
create index if not exists idx_entry_codes_expires on public.entry_codes (expires_at) where expires_at is not null;

-- Only one *active* manual code per parent (enforced via partial unique index).
create unique index if not exists uq_one_active_manual_code_per_parent
  on public.entry_codes (parent_id, entry_method)
  where status = 'active' and entry_method = 'manual';

-- ─── 2. RLS — branch-scoped, same pattern as the operational tables ──────────

alter table public.entry_codes enable row level security;

drop policy if exists "branch scoped read"  on public.entry_codes;
create policy "branch scoped read" on public.entry_codes
  for select to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch());

drop policy if exists "branch scoped write" on public.entry_codes;
create policy "branch scoped write" on public.entry_codes
  for all to authenticated
  using (public.is_super_admin() or branch_id = public.current_branch())
  with check (public.is_super_admin() or branch_id = public.current_branch());

-- Auto-fill branch_id on insert.
drop trigger if exists trg_set_branch on public.entry_codes;
create trigger trg_set_branch
  before insert on public.entry_codes
  for each row execute procedure public.set_branch_id_from_profile();

-- ─── 3. RPC: get_or_create_entry_code ─────────────────────────────────────────
--
-- The cashier app calls this after a successful registration. Returns the
-- existing active code for the parent (so reprinting receipts shows the same
-- code) or creates a new one with collision detection.

create or replace function public.get_or_create_entry_code(p_parent_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_code     text;
  v_attempts integer := 0;
  v_prefix   text;
  v_digits   text;
begin
  -- Reuse existing active code if any.
  select code into v_existing
    from public.entry_codes
    where parent_id = p_parent_id
      and status = 'active'
      and entry_method = 'manual'
    limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Generate a new unique code. Up to 20 attempts to avoid extremely rare
  -- collisions; the 4-digit space (10k) is huge relative to a single branch.
  loop
    v_attempts := v_attempts + 1;
    v_prefix := (array['PLAY', 'GKP', 'KID'])[1 + floor(random() * 3)::integer];
    v_digits := lpad(floor(random() * 10000)::text, 4, '0');
    v_code   := v_prefix || '-' || v_digits;

    -- Try to insert; uniqueness on `code` PK + partial index guard concurrency.
    begin
      insert into public.entry_codes (code, parent_id)
      values (v_code, p_parent_id);
      return v_code;
    exception when unique_violation then
      if v_attempts >= 20 then
        raise exception 'could not generate unique entry code after 20 attempts';
      end if;
    end;
  end loop;
end;
$$;

-- ─── 4. RPC: lookup_entry_code ────────────────────────────────────────────────
--
-- Cashier types the code → this returns the parent + child data needed to
-- populate the Hızlı Kayıt screen instantly. Returns null if the code is
-- unknown, revoked, or expired (UI shows a friendly "code not found").

create or replace function public.lookup_entry_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.entry_codes%rowtype;
  v_parent jsonb;
  v_children jsonb;
begin
  select * into v_code
    from public.entry_codes
    where code = upper(trim(p_code));

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_code.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- Touch last_used_at to keep "active codes" telemetry honest.
  update public.entry_codes set last_used_at = now() where code = v_code.code;

  -- Hydrate parent + children.
  select to_jsonb(p) into v_parent
    from public.parents p
    where p.id = v_code.parent_id;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_children
    from public.children c
    where c.parent_id = v_code.parent_id;

  return jsonb_build_object(
    'ok',       true,
    'code',     v_code.code,
    'parent',   v_parent,
    'children', v_children
  );
end;
$$;

-- ─── 5. RPC: consume_entry_code (single-use tokens, optional) ────────────────
--
-- Reserved for future single-use scenarios (e.g. one-time guest codes). For
-- perpetual loyalty codes (the default today), the cashier doesn't call this —
-- the code just gets reused on each visit.

create or replace function public.consume_entry_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.entry_codes
    set use_count    = use_count + 1,
        last_used_at = now()
    where code = upper(trim(p_code))
      and status = 'active';

  -- If the code was single-use, mark it revoked so the next lookup fails.
  update public.entry_codes
    set status = 'revoked'
    where code = upper(trim(p_code))
      and expires_at is not null
      and use_count >= 1;
end;
$$;

-- ─── 6. Maintenance: purge old expired codes (for cron) ──────────────────────

create or replace function public.purge_expired_entry_codes()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.entry_codes
      where expires_at is not null
        and expires_at < now() - interval '30 days'
        and status = 'revoked'
      returning 1
  )
  select count(*)::integer from deleted;
$$;

-- ============================================================
-- End of migration 008
-- ============================================================
