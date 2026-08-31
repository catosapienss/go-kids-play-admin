-- ─── 042 — Offboarding: Dila, Seda, Sevilay (personnel change, Ağustos 2026) ─
--
-- Three employees have left Go Kids Play. This archives their accounts using
-- the lifecycle helper from 041. Run 041 first.
--
-- ⚠️  READ BEFORE RUNNING
--   This matches on `profiles.username` and then ASSERTS the full_name before
--   touching anything, so a username collision can never archive the wrong
--   person. Two similarly-named colleagues stay untouched by design:
--       • Sude  (username `sude`)  — still employed
--       • Elif  (username `elif`)  — still employed
--   Neither appears in the list below.
--
-- NOTHING IS DELETED. Every profile row survives, so:
--   • `sessions.staff_name` (denormalised text)         → still reads "Dila"
--   • `audit_logs.meta.submitted_by` (staff closings)   → still reads "Dila"
--   • `get_staff_performance` (groups by staff_name)    → still lists them
--   • `staff_shifts` → profiles join                    → still resolves
--   • retail discounts → profiles.full_name lookup      → still resolves
--   The 20 Tem 2026 — Dila — Personel Kapanış row is not read or written here.
--
-- The only row removed anywhere is `staff_quick_auth`, the plaintext-password
-- mirror the lock screen uses to re-sign-in. It holds no history and exists
-- only to let a session be issued as that person — precisely what must stop.

do $$
declare
  rec        record;
  v_id       uuid;
  v_name     text;
  v_disabled boolean;
begin
  for rec in
    select * from (values
      ('dila',    'Dila'),
      ('seda',    'Seda'),
      ('sevilay', 'Sevilay')
    ) as t(username, expected_name)
  loop
    select id, full_name, coalesce(disabled, false)
      into v_id, v_name, v_disabled
      from public.profiles
     where lower(username) = rec.username;

    if v_id is null then
      raise notice 'SKIP — no profile with username %; nothing changed', rec.username;
      continue;
    end if;

    -- Wrong-person guard. Abort the whole migration rather than archive
    -- somebody who merely shares a username slot.
    if v_name is distinct from rec.expected_name then
      raise exception
        'ABORT — username % is "%" but this migration expected "%". Nothing has been changed.',
        rec.username, v_name, rec.expected_name;
    end if;

    perform public.admin_archive_staff(
      v_id,
      'Ayrıldı — personel değişikliği, Ağustos 2026'
    );

    raise notice 'ARCHIVED — % (%) — was already disabled: %', v_name, v_id, v_disabled;
  end loop;
end$$;

-- ── Verification ────────────────────────────────────────────────────────────
--
-- 1) The three are archived, and nobody else changed state:
--
--   select username, full_name, role, is_active, disabled, left_at
--     from public.profiles
--    order by left_at nulls first, role, username;
--
--   Expect left_at SET for dila / seda / sevilay only.
--   Expect cumhuryuksel, eylul, elif, sude untouched (left_at null, active).
--
-- 2) Their password login is blocked at the auth layer:
--
--   select u.email, u.banned_until
--     from auth.users u
--     join public.profiles p on p.id = u.id
--    where p.left_at is not null;
--
-- 3) Their PIN can no longer switch the session (no credential mirror left):
--
--   select p.username
--     from public.profiles p
--     left join public.staff_quick_auth sa on sa.user_id = p.id
--    where p.left_at is not null and sa.user_id is not null;   -- expect 0 rows
--
-- 4) History is intact — these must still return their rows:
--
--   select staff_name, count(*) from public.sessions
--    where staff_name in ('Dila','Seda','Sevilay') group by 1;
--
--   select meta->>'submitted_by' as staff, meta->>'business_date' as gun
--     from public.audit_logs
--    where action = 'staff.day.closing'
--      and meta->>'submitted_by' in ('Dila','Seda','Sevilay')
--    order by 2 desc;

notify pgrst, 'reload schema';
