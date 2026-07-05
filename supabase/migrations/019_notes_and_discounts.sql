-- ─── 019 — Child/Session Notes + Discounts Audit Table ──────────────────────
--
-- Staff feedback release:
--   1. `children.notes`       — persistent per-child note ("Ateşe alerjisi var",
--                               "Annesi arandığında haber ver", …). Shows up in
--                               Hızlı Kayıt, Aktif Oyun Alanı and CRM detail.
--   2. `sessions.child_notes` — snapshot of the note at registration time so
--                               reports keep the historical value even if the
--                               child's note changes later.
--   3. `public.discounts`     — audit table the client-side discount service
--                               (src/lib/services/discount.service.ts) has been
--                               writing to; formalised here so history survives.
--
-- Everything is additive (`if not exists` / `add column if not exists`) —
-- safe to run on the live database with zero downtime.

-- ── 1. Child note (master record) ───────────────────────────────────────────
alter table public.children
  add column if not exists notes text;

-- ── 2. Session note snapshot (historical record for reports) ────────────────
alter table public.sessions
  add column if not exists child_notes text;

-- ── 3. Discounts audit table ────────────────────────────────────────────────
create table if not exists public.discounts (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references public.sessions(id) on delete set null,
  payment_id       uuid,
  parent_id        uuid references public.parents(id)  on delete set null,
  discount_type    text not null check (discount_type in ('percent','fixed')),
  discount_value   numeric(10,2) not null default 0,   -- raw input (10 → %10, 50 → ₺50)
  discount_amount  numeric(10,2) not null default 0,   -- resolved ₺
  base_amount      numeric(10,2),                      -- gross before discount
  reason           text,
  applied_by       uuid references public.profiles(id) on delete set null,
  applied_by_name  text,
  created_at       timestamptz not null default now()
);

create index if not exists discounts_created_at_idx on public.discounts (created_at desc);
create index if not exists discounts_parent_idx     on public.discounts (parent_id, created_at desc);
create index if not exists discounts_session_idx    on public.discounts (session_id);

alter table public.discounts enable row level security;

drop policy if exists "discounts read" on public.discounts;
create policy "discounts read"
  on public.discounts for select
  to authenticated using (true);

drop policy if exists "discounts insert" on public.discounts;
create policy "discounts insert"
  on public.discounts for insert
  to authenticated
  with check (true);
