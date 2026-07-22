-- ─── Remove the mistaken closing record for 2026-07-22 ──────────────────────
--
-- STATUS: EXECUTED on production 2026-07-22 via Supabase SQL Editor.
--         Kept as the record of what was removed. Do not re-run.
--
-- What the inspection found on 2026-07-22:
--
--   • cash_register_closings — one row, id e6c4513c-9afa-47a4-bf17-8273a2179761,
--     status 'open', closed_at NULL, expected_total 0.00, transaction_count 0.
--     NOT a closing: this is the empty row open_cash_register creates lazily
--     when someone opens /gun-sonu. It never surfaces in the closing history
--     and is recreated on the next page load. LEFT UNTOUCHED.
--
--   • audit_logs (staff.day.closing) — one row, id
--     6587411d-48cc-4262-b258-ef1b2fd07547, 2026-07-22 09:59:06+00, "Sude",
--     cash_count 500, no notes. This was the mistaken record. DELETED.
--
-- The 'cash_register.close' audit trail, all other closings, and every
-- payment / retail / session / wallet row were left untouched.
--
-- Post-delete verification:
--   kalan 22 Tem personel teslimi ......... 0
--   toplam personel teslimi (tüm tarihler)  8
--   toplam kapalı kasa kapanışı ........... 12
--   en son kapalı kasa kapanışı ........... 2026-07-21
--
-- (2026-07-21 as the latest closed closing confirms no closed register closing
--  ever existed for 22 July.)

-- ── The statement that was run ─────────────────────────────────────────────

-- delete from public.audit_logs
-- where id = '6587411d-48cc-4262-b258-ef1b2fd07547'
--   and action = 'staff.day.closing'
-- returning id::text, created_at::text,
--           meta->>'submitted_by' as kisi, meta->>'cash_count' as nakit;
--
-- → 1 row: 6587411d-48cc-4262-b258-ef1b2fd07547 | 2026-07-22 09:59:06.38257+00 | Sude | 500


-- ── Re-verification (safe to run any time; read-only) ──────────────────────

select 'kalan 22 Tem personel teslimi' as kontrol,
       count(*)::text as deger
from public.audit_logs
where action = 'staff.day.closing'
  and coalesce(meta->>'business_date', created_at::date::text) = '2026-07-22'

union all

select 'toplam personel teslimi (tum tarihler)', count(*)::text
from public.audit_logs
where action = 'staff.day.closing'

union all

select 'toplam kapali kasa kapanisi', count(*)::text
from public.cash_register_closings
where status = 'closed'

union all

select 'en son kapali kasa kapanisi',
       coalesce(max(business_date)::text, 'yok')
from public.cash_register_closings
where status = 'closed';
