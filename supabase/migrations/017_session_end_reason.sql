-- ─── 017 — Manual session termination with reason ──────────────────────────
--
-- Adds the columns needed to record WHY a session was ended early, who
-- ended it, and whether the actual end time fell before the planned end.
-- A new RPC `end_session_with_reason()` is the production write path —
-- the old `end_session()` continues to work for legacy callers but does
-- NOT capture reason/note (UI now always uses the new path).

alter table public.sessions add column if not exists end_reason text;
alter table public.sessions add column if not exists end_note   text;
alter table public.sessions add column if not exists ended_by   uuid references public.profiles(id);
alter table public.sessions add column if not exists ended_at   timestamptz;
alter table public.sessions add column if not exists early_exit boolean not null default false;

-- Index for the manager history panel (status='completed', most-recent first).
create index if not exists sessions_completed_recent_idx
  on public.sessions (status, ended_at desc nulls last)
  where status = 'completed';

-- ── End-with-reason RPC ────────────────────────────────────────────────────
create or replace function public.end_session_with_reason(
  p_session_id uuid,
  p_reason     text default 'other',
  p_note       text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now      timestamptz := now();
  v_end      timestamptz;
  v_dur      int;
  v_status   text;
  v_early    boolean;
begin
  select end_time, duration_minutes, status
    into v_end, v_dur, v_status
    from public.sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'session % not found', p_session_id;
  end if;

  if v_status = 'completed' then
    return json_build_object(
      'session_id', p_session_id,
      'already_completed', true
    );
  end if;

  -- Early exit only meaningful for timed sessions whose planned end is in
  -- the future. Free-play (duration_minutes = 0) is never "early".
  v_early := (v_end is not null and v_now < v_end and coalesce(v_dur, 0) > 0);

  update public.sessions
     set status     = 'completed',
         ended_at   = v_now,
         ended_by   = auth.uid(),
         end_reason = coalesce(nullif(p_reason, ''), 'other'),
         end_note   = nullif(trim(p_note), ''),
         early_exit = v_early
   where id = p_session_id;

  return json_build_object(
    'session_id', p_session_id,
    'ended_at',   v_now,
    'early_exit', v_early
  );
end;
$$;

grant execute on function public.end_session_with_reason(uuid, text, text) to authenticated;

-- ── Reporting view ─────────────────────────────────────────────────────────
-- Convenience read model for the manager history panel.
create or replace view public.session_completion_log as
  select
    s.id,
    s.child_name,
    s.parent_name,
    s.parent_phone,
    s.start_time,
    s.end_time         as planned_end,
    s.ended_at         as actual_end,
    s.duration_minutes,
    s.end_reason,
    s.end_note,
    s.early_exit,
    p.full_name        as ended_by_name,
    p.username         as ended_by_username
  from public.sessions s
  left join public.profiles p on p.id = s.ended_by
  where s.status = 'completed'
  order by s.ended_at desc nulls last;

grant select on public.session_completion_log to authenticated;
