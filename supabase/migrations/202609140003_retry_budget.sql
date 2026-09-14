-- Manual retries must use a new attempt number, never an old paid reservation.
-- Existing captures, checkpoints, artifacts and reservations are preserved.
create or replace function public.retry_capture(p_owner uuid,p_capture uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform 1 from captures where id=p_capture and owner_id=p_owner for update;
  if not found then raise exception 'Capture missing'; end if;
  update jobs set status='queued',max_attempts=greatest(max_attempts,attempt+5),
    run_after=now(),last_error=null
  where capture_id=p_capture
    and revision=(select revision from captures where id=p_capture)
    and status in('blocked','dead_letter','retrying');
  if not found then raise exception 'No failed job to retry'; end if;
  update captures set state='received',result_summary='Queued for retry',updated_at=now()
  where id=p_capture;
end$$;
revoke all on function public.retry_capture(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_capture(uuid,uuid) to service_role;
