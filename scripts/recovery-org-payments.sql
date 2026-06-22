-- ─── Organization payments (deposits, installments, refunds) ────────────────
-- Stores per-organization payment events so /dogum-gunleri/[id] can show
-- "kapora alindi" and the running balance.

create table if not exists public.organization_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount          numeric(10,2) not null check (amount > 0),
  method          text not null check (method in ('cash','card','transfer','wallet')),
  kind            text not null default 'deposit'
                  check (kind in ('deposit','installment','full','refund')),
  note            text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists org_payments_org_idx on public.organization_payments(organization_id, created_at desc);

alter table public.organization_payments enable row level security;

drop policy if exists "org_payments read"   on public.organization_payments;
drop policy if exists "org_payments insert" on public.organization_payments;
drop policy if exists "org_payments delete admin" on public.organization_payments;

create policy "org_payments read"
  on public.organization_payments for select to authenticated using (true);

create policy "org_payments insert"
  on public.organization_payments for insert to authenticated with check (auth.uid() is not null);

create policy "org_payments delete admin"
  on public.organization_payments for delete to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin'))
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.organization_payments;
  exception when duplicate_object then null;
  end;
end$$;

-- Convenience: paid total per org (signed: refunds subtract)
create or replace view public.v_org_payment_totals as
  select organization_id,
         coalesce(sum(case when kind = 'refund' then -amount else amount end), 0)::numeric as paid_total,
         count(*)::int as payment_count
    from public.organization_payments
   group by organization_id;

grant select on public.v_org_payment_totals to authenticated;

select 'organization_payments installed' as status;
