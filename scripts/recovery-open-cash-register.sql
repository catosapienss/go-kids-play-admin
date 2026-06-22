-- ─── Restore open_cash_register to return UUID (not composite row) ─────────
-- Earlier cascade drop had replaced/broken open_cash_register so it returned
-- "cash_register_closings" (the whole row), causing:
--   invalid input syntax for type uuid: "(b8929189-...,2026-06-22,...,open,...)"
-- when close_cash_register did `v_register_id := public.open_cash_register()`.
--
-- Already executed live on prod — committed for audit.

drop function if exists public.open_cash_register() cascade;

create or replace function public.open_cash_register()
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_branch uuid;
  v_id     uuid;
begin
  begin
    v_branch := public.current_branch();
  exception when others then
    v_branch := null;
  end;
  select id into v_id from public.cash_register_closings
   where status = 'open' and business_date = current_date
     and (branch_id is not distinct from v_branch);
  if v_id is not null then return v_id; end if;
  insert into public.cash_register_closings (branch_id, business_date, status)
    values (v_branch, current_date, 'open')
    returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.open_cash_register() to authenticated;

-- close_cash_register has to be re-installed after the cascade drop above
-- (see recovery-cash-register-v2.sql for the full definition; same body).
notify pgrst, 'reload schema';
