-- ─── 031 — Fix End-of-Day closing history visibility (role → permission) ─────
--
-- BUG: A Manager's day-end close SUCCEEDS and writes a row (verified: branch =
-- the sole "Merkez" branch, same as the owner's closings). But the closing
-- HISTORY (and today's closed-register read) was gated by:
--     is_super_admin() OR branch_id = current_branch()
-- In this single-shop deployment EVERY profile has branch_id = NULL while every
-- closing row has branch_id = <Merkez uuid>. So for anyone who is not
-- super_admin, `branch_id = current_branch()` is `<uuid> = NULL` → NULL (false)
-- → they see NO closings at all — including the one they just created. Only the
-- super_admin owner passes the gate, so it "only works for the owner".
--
-- FIX: make the reads NULL/branch tolerant so visibility depends on branch
-- context (and permission), never on role. Same pattern migration 024 used for
-- the reporting RPCs. When real multi-branch is configured later (profiles get a
-- branch_id), the branch filter starts scoping again automatically.
--
-- Writes are unchanged (close_cash_register is SECURITY DEFINER + keeps its
-- explicit manager/admin/super_admin gate). Additive; nothing dropped that
-- isn't immediately recreated.

-- ── RLS read: tolerant of NULL branch context (fixes getTodayRegister for mgrs)
drop policy if exists "branch scoped read" on public.cash_register_closings;
create policy "branch scoped read" on public.cash_register_closings
  for select to authenticated
  using (
    public.is_super_admin()
    or public.current_branch() is null
    or branch_id is null
    or branch_id = public.current_branch()
  );

-- ── RLS write: same tolerance (belt-and-suspenders; RPC still gates the role)
drop policy if exists "branch scoped write" on public.cash_register_closings;
create policy "branch scoped write" on public.cash_register_closings
  for all to authenticated
  using (
    public.is_super_admin()
    or public.current_branch() is null
    or branch_id is null
    or branch_id = public.current_branch()
  )
  with check (
    public.is_super_admin()
    or public.current_branch() is null
    or branch_id is null
    or branch_id = public.current_branch()
  );

-- ── History RPC: same tolerant filter so every authorized user sees the same
--    history regardless of role.
create or replace function public.list_recent_closings(p_limit integer default 20)
returns setof public.cash_register_closings
language sql
stable
security definer
set search_path = public
as $$
  select * from public.cash_register_closings
    where status = 'closed'
      and (
        public.is_super_admin()
        or public.current_branch() is null
        or branch_id is null
        or branch_id = public.current_branch()
      )
    order by closed_at desc
    limit greatest(1, least(p_limit, 100));
$$;
