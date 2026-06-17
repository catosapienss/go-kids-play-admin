-- ─── Enable Supabase Realtime for the operational tables ───────────────────
--
-- Root cause of the "registration doesn't appear in Active Sessions until I
-- refresh" bug: the `supabase_realtime` publication wasn't broadcasting
-- INSERTs on the sessions/payments tables, so the SessionStoreProvider's
-- realtime channel never received the new rows.
--
-- Idempotent: each ADD TABLE is wrapped in DO/EXCEPTION so re-running is safe.

do $$
begin
  begin
    alter publication supabase_realtime add table public.sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.payments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.parents;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.children;
  exception when duplicate_object then null;
  end;
end$$;

-- Verify
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
 order by tablename;
