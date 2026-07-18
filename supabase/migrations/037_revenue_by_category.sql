-- ─── 037 — Revenue by category over a date range (read-only, additive) ───────
--
-- Powers the redesigned "Gelir Dağılımı" donut on /raporlar. Returns ONE row of
-- revenue split by business category for [p_from, p_to). Nothing is written,
-- no existing object is altered — this is purely a reporting read.
--
-- SINGLE SOURCE OF TRUTH: each category mirrors EXACTLY the definition the
-- existing report already uses, so the donut slice equals that report's number:
--
--   • Oyun Seansları — payments linked to a play session (session_id not null),
--     sum(total_amount). Same source/column as the customer-insights "spend"
--     (024) and the payment-method chart (get_revenue_breakdown / 028). Using
--     the single total_amount column makes split (cash+card) tenders impossible
--     to double-count. Promotional bonus minutes are free — they never create a
--     payment row — so they contribute ₺0 automatically.
--   • Perakende    — retail_sales.total_amount where NOT voided (final paid
--     amount, already net of any line discount). Same as fetchRetailReport.
--   • Üyelikler    — memberships.price where package_id is not null, by start_at.
--     Same as membership_campaign_report (036). Legacy unlimited/punch
--     memberships are intentionally excluded, as they are there too.
--   • Doğum Günleri — organizations.(total_amount|total_price) by event_date.
--     Same as get_organization_analytics (025).
--
-- Wallet top-ups are deliberately NOT a category: a wallet load is a deposit,
-- not revenue — the revenue is realised when the balance is spent on a session
-- (already counted under Oyun Seansları). Counting loads would double-count.
--
-- Refunds are not category-attributable in the schema, so each slice is the
-- gross of its own source with cancelled/voided already excluded — matching how
-- each report tab presents its own figure. Net-of-refund remains the job of the
-- payment-method chart, which owns the day-level refund ledger.
--
-- Branch scope uses the same tolerant single-shop predicate as every other
-- reporting RPC. Range defaults (today) come from the shared _effective_range.

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
begin
  select d_from, d_to into v_from, v_to from public._effective_range(p_from, p_to);

  -- Oyun Seansları — money collected on play sessions.
  begin
    select coalesce(sum(pay.total_amount), 0)
      into v_sessions
      from public.payments pay
      join public.sessions sess on sess.id = pay.session_id
     where pay.created_at >= v_from and pay.created_at < v_to
       and (public.is_super_admin() or public.current_branch() is null
            or pay.branch_id is null or pay.branch_id = public.current_branch());
  exception when others then v_sessions := 0;
  end;

  -- Perakende — non-voided retail sales, final paid amount.
  begin
    select coalesce(sum(total_amount), 0)
      into v_retail
      from public.retail_sales
     where not voided
       and sold_at >= v_from and sold_at < v_to
       and (public.is_super_admin() or public.current_branch() is null
            or branch_id is null or branch_id = public.current_branch());
  exception when others then v_retail := 0;
  end;

  -- Üyelikler — package-backed monthly memberships sold in range.
  begin
    select coalesce(sum(coalesce(price, 0)), 0)
      into v_memberships
      from public.memberships
     where package_id is not null
       and start_at >= v_from and start_at < v_to
       and (public.is_super_admin() or public.current_branch() is null
            or branch_id is null or branch_id = public.current_branch());
  exception when others then v_memberships := 0;
  end;

  -- Doğum Günleri — organisations by event date.
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

  return jsonb_build_object(
    'sessions',    v_sessions,
    'retail',      v_retail,
    'memberships', v_memberships,
    'birthdays',   v_birthdays,
    'total',       (v_sessions + v_retail + v_memberships + v_birthdays)
  );
end;
$$;

grant execute on function public.revenue_by_category(timestamptz, timestamptz) to authenticated;
