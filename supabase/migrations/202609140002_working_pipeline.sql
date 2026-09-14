-- Additive migration. Apply after 001; never reset an existing database.
alter table public.captures add column title text not null default 'New capture';
alter table public.captures add column input_data jsonb not null default '{}';
alter table public.captures add column understanding jsonb;
alter table public.captures add column result_summary text;
alter table public.captures add column revision int not null default 1;
alter table public.captures add column request_key text unique;
alter table public.captures add column project_id uuid references public.projects;
alter table public.captures add column is_demo boolean not null default false;
alter table public.media_assets add column status text not null default 'pending';
alter table public.media_assets add column client_key uuid;
create unique index media_client_key on public.media_assets(capture_id,client_key);
alter table public.jobs add column revision int not null default 1;
alter table public.owner_profiles add column context jsonb not null default '{}';
alter table public.knowledge_items add column pipeline_key text unique;
create table public.budget_reservations(job_id uuid references public.jobs on delete cascade,attempt int not null,owner_id uuid not null references public.owner_profiles,capture_id uuid not null references public.captures,amount_usd numeric not null check(amount_usd>0),usage_note text not null default 'Conservative reservation; actual provider billing not reconciled',created_at timestamptz not null default now(),primary key(job_id,attempt));
create table public.worker_heartbeats(worker_id text primary key,last_seen timestamptz not null default now());
create table public.capture_submissions(id uuid primary key,capture_id uuid not null references public.captures on delete cascade,created_at timestamptz not null default now());
-- Every table, including worker/raw-event tables omitted from migration 001, is private.
do $$declare t text;begin foreach t in array array['raw_events','media_assets','observations','knowledge_chunks','entities','item_entities','jobs','workflow_steps','approvals','research_runs','claims','research_sources','audit_log','budget_reservations','worker_heartbeats','capture_submissions'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
-- Browser clients cannot write around server policy. The API verifies the owner on every request.
do $$declare t text;begin foreach t in array array['owner_profiles','goals','projects','raw_events','captures','media_assets','observations','knowledge_items','knowledge_chunks','entities','item_entities','actions','artifacts','jobs','workflow_steps','approvals','research_runs','claims','research_sources','audit_log','budget_reservations','worker_heartbeats','capture_submissions'] loop execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
grant select on public.owner_profiles,public.goals,public.projects,public.captures,public.knowledge_items,public.actions,public.artifacts to authenticated;
grant usage,select on sequence public.audit_log_id_seq to service_role;

create function public.capture_manual(p_owner uuid,p_request uuid,p_url text,p_note text,p_text text,p_project uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;begin
 perform 1 from owner_profiles where id=p_owner for update; if not found then raise exception 'Owner profile missing';end if;
 select id into cid from captures where request_key=p_owner||':'||p_request; if cid is not null then return cid;end if;
 if (select count(*) from captures where owner_id=p_owner and created_at>now()-interval '1 hour')>=60 then raise exception 'Capture rate limit reached';end if;
 if p_project is not null and not exists(select 1 from projects where id=p_project and owner_id=p_owner) then raise exception 'Unknown project';end if;
 insert into captures(owner_id,source_kind,source_url,owner_note,input_data,request_key,project_id) values(p_owner,'manual',nullif(p_url,''),p_note,jsonb_build_object('text',p_text),p_owner||':'||p_request,p_project) returning id into cid;
 insert into jobs(capture_id,kind,idempotency_key) values(cid,'process_capture',cid||':1');return cid;
end$$;

create function public.resume_capture(p_owner uuid,p_capture uuid,p_submission uuid,p_text text default '',p_asset uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare c captures;jid uuid;begin
 select * into c from captures where id=p_capture and owner_id=p_owner for update; if not found then raise exception 'Capture not found';end if;
 if exists(select 1 from capture_submissions where id=p_submission and capture_id=p_capture) then select id into jid from jobs where capture_id=p_capture order by created_at desc limit 1;return jid;end if;
 if exists(select 1 from jobs where capture_id=p_capture and status='executing' and lease_expires_at>now()) then raise exception 'Processing active; retry after it finishes';end if;
 if p_asset is not null then update media_assets set status='ready' where id=p_asset and capture_id=p_capture and status='pending';if not found then raise exception 'Upload already attached or missing';end if;end if;
 insert into capture_submissions(id,capture_id) values(p_submission,p_capture);
 update jobs set status='superseded',lease_owner=null,lease_expires_at=null where capture_id=p_capture and status in('queued','retrying','executing');
 update captures set revision=revision+1,state='received',input_data=jsonb_set(input_data,'{text}',to_jsonb(concat_ws(E'\n',input_data->>'text',nullif(p_text,'')))),updated_at=now() where id=p_capture;
 insert into jobs(capture_id,kind,revision,idempotency_key) values(p_capture,'process_capture',c.revision+1,p_capture||':'||(c.revision+1)) returning id into jid;return jid;
end$$;

create function public.ingest_meta_batch(p_owner uuid,p_batch_key text,p_payload jsonb,p_messages jsonb) returns void language plpgsql security definer set search_path=public as $$
declare m jsonb;rid uuid;cid uuid;begin
 perform 1 from owner_profiles where id=p_owner for update; if not found then raise exception 'Owner profile missing';end if;
 insert into raw_events(provider,event_id,disposition,payload) values('instagram','batch:'||p_batch_key,'envelope',p_payload) on conflict(event_id) do nothing;
 for m in select * from jsonb_array_elements(p_messages) loop
  insert into raw_events(provider,event_id,message_id,sender_id,disposition,payload) values('instagram',m->>'eventId',m->>'messageId',m->>'senderId',m->>'disposition',m->'raw') on conflict(event_id) do nothing returning id into rid;
  if rid is not null and m->>'disposition'='accepted' then
   insert into captures(owner_id,raw_event_id,source_kind,owner_note,input_data) values(p_owner,rid,'instagram_dm',m->>'text',m) returning id into cid;
   insert into jobs(capture_id,kind,idempotency_key) values(cid,'process_capture',cid||':1');
  end if;rid:=null;
 end loop;
end$$;

create or replace function public.claim_jobs(p_worker text,p_limit int default 1,p_lease_seconds int default 180) returns setof public.jobs language plpgsql security definer set search_path=public as $$
begin
 update jobs set status='dead_letter',lease_owner=null,lease_expires_at=null,last_error='{"message":"Retry limit reached after lease expiry"}' where status='executing' and lease_expires_at<now() and attempt>=max_attempts;
 return query update jobs j set status='executing',attempt=attempt+1,lease_owner=p_worker,lease_expires_at=now()+make_interval(secs=>least(600,greatest(30,p_lease_seconds))) where j.id in(
 select x.id from jobs x join captures c on c.id=x.capture_id join owner_profiles o on o.id=c.owner_id where not o.automation_paused and x.revision=c.revision and x.attempt<x.max_attempts and ((x.status in('queued','retrying') and x.run_after<=now()) or (x.status='executing' and x.lease_expires_at<now())) order by x.run_after for update of x skip locked limit least(3,greatest(1,p_limit))) returning j.*;
end$$;
create function public.renew_job(p_job uuid,p_worker text) returns boolean language plpgsql security definer set search_path=public as $$begin update jobs set lease_expires_at=now()+interval '180 seconds' where id=p_job and status='executing' and lease_owner=p_worker and lease_expires_at>now();return found;end$$;
create function public.reserve_budget(p_job uuid,p_worker text,p_amount numeric,p_daily numeric,p_capture numeric) returns boolean language plpgsql security definer set search_path=public as $$
declare c captures;begin
 select c0.* into c from captures c0 join jobs j on j.capture_id=c0.id where j.id=p_job and j.lease_owner=p_worker and j.lease_expires_at>now();if not found then return false;end if;
 perform 1 from owner_profiles where id=c.owner_id and not automation_paused for update;if not found then return false;end if;
 if exists(select 1 from budget_reservations where job_id=p_job and attempt=(select attempt from jobs where id=p_job)) then return true;end if;
 if p_amount<=0 or p_amount>p_capture or p_amount>p_daily then return false;end if;
 if (select coalesce(sum(amount_usd),0) from budget_reservations where owner_id=c.owner_id and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))+p_amount>p_daily then return false;end if;
 if (select coalesce(sum(amount_usd),0) from budget_reservations where capture_id=c.id)+p_amount>p_capture then return false;end if;
 insert into budget_reservations(job_id,attempt,owner_id,capture_id,amount_usd) values(p_job,(select attempt from jobs where id=p_job),c.owner_id,c.id,p_amount);return true;
end$$;
create function public.checkpoint_job(p_job uuid,p_worker text,p_stage text,p_output jsonb,p_prompt text,p_models jsonb) returns void language plpgsql security definer set search_path=public as $$begin
 perform 1 from jobs where id=p_job and lease_owner=p_worker and status='executing' and lease_expires_at>now() for update;if not found then raise exception 'Lease lost';end if;
 insert into workflow_steps(job_id,stage,status,output,prompt_version,model_config,started_at,finished_at) values(p_job,p_stage,'completed',p_output,p_prompt,p_models,now(),now()) on conflict(job_id,stage) do update set output=excluded.output,status='completed',finished_at=now();
end$$;

create function public.complete_capture(p_job uuid,p_worker text,p_result jsonb) returns void language plpgsql security definer set search_path=public as $$
declare j jobs;c captures;aid uuid;kid uuid;item jsonb;begin
 select * into j from jobs where id=p_job and lease_owner=p_worker and status='executing' and lease_expires_at>now() for update;if not found then raise exception 'Lease lost';end if;
 select * into c from captures where id=j.capture_id and revision=j.revision for update;if not found then raise exception 'Capture changed';end if;
 if p_result->'artifact' is not null and p_result->'artifact'<>'null'::jsonb then
  item:=p_result->'artifact';
  if p_result->>'actionType' not in ('save_reference','research','create_brief','create_script','create_checklist','create_experiment','update_project') then raise exception 'Disallowed action';end if;
  insert into actions(owner_id,capture_id,project_id,type,intended_result,inputs,status,permission_basis,idempotency_key,result) values(c.owner_id,c.id,c.project_id,p_result->>'actionType',item->>'title',jsonb_build_object('revision',c.revision,'evidence',p_result->'understanding'->'evidence','project_id',c.project_id),'completed','Private internal output allowed',c.id||':'||(p_result->>'actionType'),jsonb_build_object('kind',item->>'kind')) on conflict(idempotency_key) do update set intended_result=excluded.intended_result,status='completed',inputs=excluded.inputs,result=excluded.result returning id into aid;
  insert into artifacts(owner_id,capture_id,action_id,title,kind,content,idempotency_key) values(c.owner_id,c.id,aid,item->>'title',item->>'kind',item->>'content',c.id||':'||(p_result->>'actionType')) on conflict(idempotency_key) do update set title=excluded.title,content=excluded.content,kind=excluded.kind;
  insert into knowledge_items(owner_id,capture_id,title,body,kind,pipeline_key) values(c.owner_id,c.id,item->>'title',item->>'content',item->>'kind',c.id||':knowledge') on conflict(pipeline_key) do update set title=excluded.title,body=excluded.body returning id into kid;
  delete from knowledge_chunks where knowledge_item_id=kid;
  insert into knowledge_chunks(knowledge_item_id,content,embedding) values(kid,left(item->>'content',16000),case when p_result->'embedding' is not null and p_result->'embedding'<>'null'::jsonb then (p_result->>'embedding')::vector(1536) else null end);
 end if;
 delete from observations where capture_id=c.id and provenance->>'pipeline'='v2';
 for item in select * from jsonb_array_elements(coalesce(p_result->'understanding'->'evidence','[]'::jsonb)) loop
  insert into observations(capture_id,kind,start_ms,content,provenance) values(c.id,item->>'kind',(item->>'atMs')::int,item->>'text',jsonb_build_object('pipeline','v2','sourceId',item->>'sourceId','job',j.id));
 end loop;
 update captures set title=coalesce(p_result->>'title',title),state=(p_result->>'state')::capture_state,content_state=p_result->>'contentState',coverage=p_result->'coverage',understanding=p_result->'understanding',inferred_intent=p_result->'understanding'->>'inferredIntent',explicit_intent=owner_note,result_summary=p_result->>'summary',updated_at=now() where id=c.id;
 update jobs set status='completed',lease_owner=null,lease_expires_at=null where id=j.id;
 insert into audit_log(owner_id,actor,event,subject_type,subject_id,detail) values(c.owner_id,'worker','capture_completed','capture',c.id,jsonb_build_object('job',j.id,'revision',j.revision));
end$$;
create function public.fail_job(p_job uuid,p_worker text,p_message text,p_blocked boolean default false) returns void language plpgsql security definer set search_path=public as $$declare j jobs;begin
 select * into j from jobs where id=p_job and lease_owner=p_worker and status='executing' and lease_expires_at>now() for update;if not found then return;end if;
 update jobs set status=case when p_blocked then 'blocked' when attempt>=max_attempts then 'dead_letter' else 'retrying' end,run_after=now()+make_interval(secs=>least(3600,10*power(2,attempt)::int)),lease_owner=null,lease_expires_at=null,last_error=jsonb_build_object('message',p_message) where id=j.id;
 update captures set state=case when p_blocked or j.attempt>=j.max_attempts then 'failed'::capture_state else 'retrying'::capture_state end,result_summary=p_message,updated_at=now() where id=j.capture_id and revision=j.revision;
end$$;
create function public.retry_capture(p_owner uuid,p_capture uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform 1 from captures where id=p_capture and owner_id=p_owner for update;if not found then raise exception 'Capture missing';end if;
 update jobs set status='queued',attempt=0,run_after=now(),last_error=null where capture_id=p_capture and revision=(select revision from captures where id=p_capture) and status in('blocked','dead_letter','retrying');
 if not found then raise exception 'No failed job to retry';end if;
 update captures set state='received',result_summary='Queued for retry',updated_at=now() where id=p_capture;
end$$;
create function public.search_knowledge(p_owner uuid,p_query text,p_embedding vector(1536) default null) returns table(id uuid,capture_id uuid,title text,body text,rank double precision) language sql stable security definer set search_path=public as $$
 select k.id,k.capture_id,k.title,left(k.body,5000),max(case when p_embedding is not null and c.embedding is not null then 1-(c.embedding<=>p_embedding) else ts_rank(c.ts,websearch_to_tsquery('english',p_query))::double precision end) as rank from knowledge_items k join knowledge_chunks c on c.knowledge_item_id=k.id where k.owner_id=p_owner and ((p_embedding is not null and c.embedding is not null) or c.ts@@websearch_to_tsquery('english',p_query)) group by k.id order by rank desc limit 6;
$$;
-- Remove public execution on ALL application security-definer functions (001 included).
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname=any(array['ingest_instagram_event','claim_jobs','capture_manual','resume_capture','ingest_meta_batch','renew_job','reserve_budget','checkpoint_job','complete_capture','fail_job','retry_capture','search_knowledge']) loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end$$;
-- Private bucket. Uploads use short-lived, exact-path signed upload tokens issued after owner auth.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kdn-media','kdn-media',false,26214400,array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png']) on conflict(id) do nothing;
create function public.prepare_media_asset(p_owner uuid,p_capture uuid,p_request uuid,p_mime text,p_bytes bigint) returns jsonb language plpgsql security definer set search_path=public as $$declare a media_assets;begin
 perform 1 from captures where id=p_capture and owner_id=p_owner for update;if not found then raise exception 'Capture missing';end if;
 select * into a from media_assets where capture_id=p_capture and client_key=p_request;if found then return to_jsonb(a);end if;
 if (select count(*) from media_assets where capture_id=p_capture)>=3 then raise exception 'Maximum three uploads per capture';end if;
 if p_bytes<1 or p_bytes>26214400 or p_mime not in('video/mp4','video/quicktime','video/webm','image/jpeg','image/png') then raise exception 'Invalid upload';end if;
 insert into media_assets(capture_id,client_key,storage_path,mime_type,bytes,status,provenance) values(p_capture,p_request,p_owner||'/'||p_capture||'/'||p_request,p_mime,p_bytes,'pending','{"source":"owner_upload"}') returning * into a;return to_jsonb(a);
end$$;
revoke all on function public.prepare_media_asset from public,anon,authenticated;
grant execute on function public.prepare_media_asset to service_role;
create function public.link_capture_project(p_owner uuid,p_capture uuid,p_project uuid) returns void language plpgsql security definer set search_path=public as $$begin
 perform 1 from captures where id=p_capture and owner_id=p_owner for update;if not found then raise exception 'Capture missing';end if;
 if not exists(select 1 from projects where id=p_project and owner_id=p_owner) then raise exception 'Project missing';end if;
 if exists(select 1 from jobs where capture_id=p_capture and status='executing' and lease_expires_at>now()) then raise exception 'Processing active; wait before changing destination';end if;
 update captures set project_id=p_project,updated_at=now() where id=p_capture;
end$$;
revoke all on function public.link_capture_project from public,anon,authenticated;
grant execute on function public.link_capture_project to service_role;
