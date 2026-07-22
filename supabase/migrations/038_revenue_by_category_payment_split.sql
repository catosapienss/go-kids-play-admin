-- ─── 038 — Revenue by category + nakit/kart split (read-only, additive) ──────
--
-- Extends `revenue_by_category` (037) so the "Gelir Dağılımı" card can show a
-- Nakit / Kart breakdown next to the category mix. Signature and every existing
-- key are UNCHANGED — only new keys are added, so an older client keeps working
-- and a newer client degrades to ₺0 splits if this migration hasn't run yet.
--
-- Category definitions are byte-for-byte the ones 037 documented (single source
-- of truth); this migration only adds *how* each category was tendered:
--
--   • Oyun Seansları — payments.cash_amount / card_amount / wallet_amount, with
--     anything unattributed (total minus the three) landing in `other`. Split
--     tenders are therefore counted once per component, never double-counted.
--   • Perakende     — retail_sales.cash_amount / card_amount ('split' rows are
--     already stored as two amounts on the same row); remainder → other.
--   • Üyelikler     — memberships only store a payment_method LABEL, not per-
--     tender amounts, so the whole price goes to that label. 'split' has no
--     recoverable ratio and is reported under `other` (Diğer) rather than being
--     guessed at.
--   • Doğum Günleri — organizations carry no tender information at all, so the
--     whole amount is reported under `other`.
--
-- `other` is the honest bucket: money we know was collected but cannot attribute
-- to nakit or kart. cash + card + wallet + other always equals total.

create or replace function public.revenue_by_category(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from        timestamptz;
  v_to          timestamptz;
  v_sessions    numeric := 0;
  v_retail      numeric := 0;
  v_memberships numeric := 0;
  v_birthdays   numeric := 0;

  v_s_cash   numeric := 0; v_s_card   numeric := 0; v_s_wallet numeric := 0;
  v_r_cash   numeric := 0; v_r_card   numeric := 0;
  v_m_cash   numeric := 0; v_m_card   numeric := 0; v_m_wallet numeric := 0;

  v_s_other  numeric := 0;
  v_r_other  numeric := 0;
  v_m_other  numeric := 0;
begin
  select d_from, d_to into v_from, v_to from public._effective_range(p_from, p_to);

  -- Oyun Seansları — money collected on play sessions, by tender.
  begin
    select coalesce(sum(pay.total_amount), 0),
           coalesce(sum(pay.cash_amount), 0),
           coalesce(sum(pay.card_amount), 0),
           coalesce(sum(pay.wallet_amount), 0)
      into v_sessions, v_s_cash, v_s_card, v_s_wallet
      from public.payments pay
      join public.sessions sess on sess.id = pay.session_id
     where pay.created_at >= v_from and pay.created_at < v_to
       and (public.is_super_admin() or public.current_branch() is null
            or pay.branch_id is null or pay.branch_id = public.current_branch());
  exception when others then
    v_sessions := 0; v_s_cash := 0; v_s_card := 0; v_s_wallet := 0;
  end;

  -- Perakende — non-voided retail sales, by tender.
  begin
    select coalesce(sum(total_amount), 0),
           coalesce(sum(cash_amount), 0),
           coalesce(sum(card_amount), 0)
      into v_retail, v_r_cash, v_r_card
      from public.retail_sales
     where not voided
       and sold_at >= v_from and sold_at < v_to
       and (public.is_super_admin() or public.current_branch() is null
            or branch_id is null or branch_id = public.current_branch());
  exception when others then
    v_retail := 0; v_r_cash := 0; v_r_card := 0;
  end;

  -- Üyelikler — package-backed memberships sold in range, by method label.
  begin
    select coalesce(sum(coalesce(price, 0)), 0),
           coalesce(sum(case when payment_method = 'cash'   then coalesce(price, 0) else 0 end), 0),
           coalesce(sum(case when payment_method = 'card'   then coalesce(price, 0) else 0 end), 0),
           coalesce(sum(case when payment_method = 'wallet' then coalesce(price, 0) else 0 end), 0)
      into v_memberships, v_m_cash, v_m_card, v_m_wallet
      from public.memberships
     where package_id is not null
       and start_at >= v_from and start_at < v_to
       and (public.is_super_admin() or public.current_branch() is null
            or branch_id is null or branch_id = public.current_branch());
  exception when others then
    v_memberships := 0; v_m_cash := 0; v_m_card := 0; v_m_wallet := 0;
  end;

  -- Doğum Günleri — organisations by event date (no tender data available).
  begin
    execute $q$
      select coalesce(sum(coalesce(total_amount, total_price, 0)), 0)
        from public.organizations
       where event_date >= $1 and event_date < $2
         and (public.is_super_admin() or public.current_branch() is null
              or branch_id is null or branch_id = public.current_branch())
    $q$ into v_birthdays using v_from, v_to;
  exception when others then v_birthdays := 0;
  end;

  -- Unattributed remainders — keeps each category's parts equal to its total.
  v_s_other := greatest(v_sessions    - (v_s_cash + v_s_card + v_s_wallet), 0);
  v_r_other := greatest(v_retail      - (v_r_cash + v_r_card), 0);
  v_m_other := greatest(v_memberships - (v_m_cash + v_m_card + v_m_wallet), 0);

  return jsonb_build_object(
    'sessions',    v_sessions,
    'retail',      v_retail,
    'memberships', v_memberships,
    'birthdays',   v_birthdays,
    'total',       (v_sessions + v_retail + v_memberships + v_birthdays),

    -- Per-category tender split (new in 038).
    'sessions_cash',    v_s_cash,
    'sessions_card',    v_s_card,
    'sessions_wallet',  v_s_wallet,
    'sessions_other',   v_s_other,
    'retail_cash',      v_r_cash,
    'retail_card',      v_r_card,
    'retail_wallet',    0,
    'retail_other',     v_r_other,
    'memberships_cash',   v_m_cash,
    'memberships_card',   v_m_card,
    'memberships_wallet', v_m_wallet,
    'memberships_other',  v_m_other,
    'birthdays_cash',   0,
    'birthdays_card',   0,
    'birthdays_wallet', 0,
    'birthdays_other',  v_birthdays,

    -- Whole-range tender split (new in 038).
    'cash',   (v_s_cash + v_r_cash + v_m_cash),
    'card',   (v_s_card + v_r_card + v_m_card),
    'wallet', (v_s_wallet + v_m_wallet),
    'other',  (v_s_other + v_r_other + v_m_other + v_birthdays)
  );
end;
$$;

grant execute on function public.revenue_by_category(timestamptz, timestamptz) to authenticated;
