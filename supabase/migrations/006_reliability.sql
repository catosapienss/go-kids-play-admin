-- ============================================================
-- GoKids Play — Production Hardening: Reliability & Auditing
-- Migration 006
--
-- Goals:
--   1. Idempotency keys for critical writes (payments, refunds, sessions).
--   2. Audit log table for every sensitive action.
--   3. Helper RPC `record_idempotent_action()` — atomic upsert + return prior result.
--
-- Idempotency key flow (client → server):
--   • Client generates a UUIDv4 + action name when the user clicks Pay/Refund/etc.
--   • Client passes the key along with the operation.
--   • Server (RPC) attempts to insert it; if a row with the same key exists,
--     the RPC returns the original result instead of re-running the action.
--
-- This is the foundation — service functions hook into it incrementally.
-- ============================================================

-- ─── 1. Idempotency Keys ──────────────────────────────────────────────────────

create table if not exists public.idempotency_keys (
  key            text primary key,                  -- client UUIDv4
  action         text not null,                     -- "payment.create", "refund.cancel", …
  user_id        uuid references auth.users(id) on delete set null,
  branch_id      uuid references public.branches(id) on delete set null,
  /** Snapshot of the *first* successful response so retries return the same. */
  response       jsonb,
  status         text not null default 'in_flight'
                   check (status in ('in_flight', 'completed', 'failed')),
  error_message  text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  /** Auto-expire stale keys (cron job will purge). */
  expires_at     timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_idempotency_keys_branch  on public.idempotency_keys (branch_id);
create index if not exists idx_idempotency_keys_action  on public.idempotency_keys (action);
create index if not exists idx_idempotency_keys_expires on public.idempotency_keys (expires_at);

alter table public.idempotency_keys enable row level security;

-- Owners can read/write their own keys. Service role (server-side) bypasses RLS.
drop policy if exists "own idempotency keys" on public.idempotency_keys;
create policy "own idempotency keys" on public.idempotency_keys
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── 2. Audit Logs ────────────────────────────────────────────────────────────

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  /** Coarse action category — "payment.create", "session.end", "auth.login", … */
  action        text not null,
  /** Free-form severity — info | warning | error. */
  severity      text not null default 'info'
                  check (severity in ('info', 'warning', 'error')),
  user_id       uuid references auth.users(id) on delete set null,
  branch_id     uuid references public.branches(id) on delete set null,
  /** Optional row id this action mutated (sessions, payments, …). */
  entity_type   text,
  entity_id     uuid,
  /** Arbitrary structured details (amount, error, ip, ua, …). */
  meta          jsonb not null default '{}'::jsonb,
  /** Client-supplied request id; helps tie multi-step flows together. */
  request_id    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_logs_branch     on public.audit_logs (branch_id);
create index if not exists idx_audit_logs_action     on public.audit_logs (action);
create index if not exists idx_audit_logs_user       on public.audit_logs (user_id);
create index if not exists idx_audit_logs_severity   on public.audit_logs (severity);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_entity     on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

-- Admins/super-admins read all (within their branch); managers read their branch.
-- All authenticated users may *write* (we want every action recorded).
drop policy if exists "read audit logs by branch" on public.audit_logs;
create policy "read audit logs by branch" on public.audit_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or branch_id = public.current_branch()
  );

drop policy if exists "write audit logs" on public.audit_logs;
create policy "write audit logs" on public.audit_logs
  for insert to authenticated
  with check (true);

-- Auto-fill branch_id (same pattern as the multi-branch migration).
drop trigger if exists trg_set_branch on public.audit_logs;
create trigger trg_set_branch
  before insert on public.audit_logs
  for each row execute procedure public.set_branch_id_from_profile();

-- ─── 3. RPC: record_idempotent_action ─────────────────────────────────────────
--
-- Returns:
--   { is_replay: bool, response: jsonb | null, status: text }
--
-- Usage from service code:
--
--   1. Call this RPC FIRST with your key.
--   2. If is_replay = true → return response as the operation result, skip work.
--   3. Otherwise do the real work, then call `complete_idempotent_action` with
--      the response payload (or `fail_idempotent_action` on error).

create or replace function public.record_idempotent_action(
  p_key      text,
  p_action   text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.idempotency_keys%rowtype;
begin
  select * into v_existing
    from public.idempotency_keys
    where key = p_key;

  if found then
    return jsonb_build_object(
      'is_replay', true,
      'response',  v_existing.response,
      'status',    v_existing.status
    );
  end if;

  insert into public.idempotency_keys (key, action, user_id, branch_id)
    values (
      p_key,
      p_action,
      auth.uid(),
      (select branch_id from public.profiles where id = auth.uid())
    );

  return jsonb_build_object('is_replay', false, 'response', null, 'status', 'in_flight');
end;
$$;

create or replace function public.complete_idempotent_action(
  p_key      text,
  p_response jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  update public.idempotency_keys
    set response     = p_response,
        status       = 'completed',
        completed_at = now()
    where key = p_key;
$$;

create or replace function public.fail_idempotent_action(
  p_key   text,
  p_error text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.idempotency_keys
    set status        = 'failed',
        error_message = p_error,
        completed_at  = now()
    where key = p_key;
$$;

-- ─── 4. Maintenance: purge expired keys ──────────────────────────────────────
--
-- Call from a cron (Supabase Edge Function or pg_cron) every hour:
--   select public.purge_expired_idempotency_keys();

create or replace function public.purge_expired_idempotency_keys()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.idempotency_keys
      where expires_at < now()
      returning 1
  )
  select count(*)::integer from deleted;
$$;

-- ============================================================
-- End of migration 006
-- ============================================================
