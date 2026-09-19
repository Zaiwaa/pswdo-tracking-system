-- Pangasinan DROMIC Web System
-- Run in Supabase SQL Editor on a new project.
create extension if not exists pgcrypto;

create type public.user_role as enum ('lgu','pswdo','viewer','admin');
create type public.incident_status as enum ('ACTIVE','CLOSED','ARCHIVED');
create type public.cycle_status as enum ('OPEN','CLOSED','ARCHIVED');
create type public.report_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','RETURNED_FOR_CORRECTION','RESUBMITTED','VALIDATED','INCLUDED_IN_SITREP','ARCHIVED');
create type public.version_status as enum ('SUBMITTED','RETURNED','VALIDATED','INCLUDED_IN_SITREP');
create type public.sitrep_status as enum ('DRAFT','FINALIZED','DISTRIBUTED','ARCHIVED');
create type public.validation_severity as enum ('RED','ORANGE','BLUE');

create table public.lgus (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  kind text not null default 'Municipality',
  workbook_row integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.barangays (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid not null references public.lgus(id) on delete cascade,
  code text,
  name text not null,
  active boolean not null default true,
  unique(lgu_id,name)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  office_position text,
  requested_lgu_name text,
  role public.user_role not null default 'lgu',
  lgu_id uuid references public.lgus(id),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  start_date date not null,
  description text,
  reporting_frequency text,
  status public.incident_status not null default 'ACTIVE',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.reporting_cycles (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  sitrep_number integer not null,
  reporting_date date not null default current_date,
  cutoff_at timestamptz not null,
  deadline_at timestamptz,
  prepared_by text,
  status public.cycle_status not null default 'OPEN',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(incident_id,sitrep_number)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  reporting_cycle_id uuid not null references public.reporting_cycles(id),
  lgu_id uuid not null references public.lgus(id),
  prepared_by text,
  office_position text,
  report_date date not null default current_date,
  report_time time not null default localtime,
  reporting_period text,
  status public.report_status not null default 'DRAFT',
  zero_report boolean not null default false,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id),
  validated_at timestamptz,
  validated_by uuid references public.profiles(id),
  validation_error_count integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reporting_cycle_id,lgu_id)
);
create table public.barangay_reports (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id,barangay_id)
);
create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  version_number integer not null,
  status public.version_status not null default 'SUBMITTED',
  header_snapshot jsonb not null,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  unique(report_id,version_number)
);
create table public.report_version_barangays (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.report_versions(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id),
  data_snapshot jsonb not null,
  unique(report_version_id,barangay_id)
);
create table public.remarks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  report_version_id uuid references public.report_versions(id),
  author_id uuid not null references public.profiles(id),
  remark_type text not null default 'REVIEW',
  body text not null,
  created_at timestamptz not null default now()
);
create table public.sitreps (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  reporting_cycle_id uuid not null unique references public.reporting_cycles(id),
  sitrep_number integer not null,
  cutoff_at timestamptz not null,
  prepared_by text,
  recipients text[],
  remarks text,
  status public.sitrep_status not null default 'DRAFT',
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.sitrep_reports (
  id uuid primary key default gen_random_uuid(),
  sitrep_id uuid not null references public.sitreps(id) on delete cascade,
  lgu_id uuid not null references public.lgus(id),
  report_version_id uuid not null references public.report_versions(id),
  included_at timestamptz not null default now(),
  unique(sitrep_id,lgu_id),
  unique(sitrep_id,report_version_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  action_url text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  lgu_id uuid,
  incident_id uuid,
  report_id uuid,
  report_version_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.distribution_logs (
  id uuid primary key default gen_random_uuid(),
  sitrep_id uuid not null references public.sitreps(id),
  recipient text not null,
  delivery_method text not null default 'SECURE_ACCESS',
  status text not null default 'RECORDED',
  sent_by uuid not null references public.profiles(id),
  sent_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create index idx_barangays_lgu on public.barangays(lgu_id);
create index idx_reports_lgu_cycle on public.reports(lgu_id,reporting_cycle_id);
create index idx_reports_status on public.reports(status);
create index idx_versions_report on public.report_versions(report_id,version_number desc);
create index idx_vbarangays_version on public.report_version_barangays(report_version_id);
create index idx_notifications_user on public.notifications(user_id,created_at desc);
create index idx_audit_created on public.audit_logs(created_at desc);

-- Auto-create a pending profile from Supabase Auth metadata.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,full_name,office_position,requested_lgu_name)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'office_position',new.raw_user_meta_data->>'requested_lgu_name')
 on conflict(id) do nothing;
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.my_role() returns public.user_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.my_lgu() returns uuid language sql stable security definer set search_path=public as $$ select lgu_id from public.profiles where id=auth.uid() $$;
create or replace function public.is_ops() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select role in ('pswdo','admin') from public.profiles where id=auth.uid()),false) $$;
create or replace function public.is_authorized_viewer() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select approved and role in ('pswdo','viewer','admin') from public.profiles where id=auth.uid()),false) $$;

create or replace function public.audit(p_action text,p_entity_type text,p_entity_id uuid default null,p_report_id uuid default null,p_version_id uuid default null,p_details jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path=public as $$
declare v_lgu uuid; v_incident uuid;
begin
 if p_report_id is not null then select lgu_id,incident_id into v_lgu,v_incident from public.reports where id=p_report_id; end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,lgu_id,incident_id,report_id,report_version_id,details) values(auth.uid(),p_action,p_entity_type,p_entity_id,v_lgu,v_incident,p_report_id,p_version_id,p_details);
end $$;

-- Carries previous cumulative values forward for the same barangay without assuming additive semantics.
create or replace function public.get_previous_barangay_values(p_report_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.reports; result jsonb:='{}'; rec record;
begin
 select * into r from public.reports where id=p_report_id;
 if r.id is null then return result; end if;
 for rec in
   select rvb.barangay_id,rvb.data_snapshot
   from public.report_versions rv
   join public.reports pr on pr.id=rv.report_id
   join public.report_version_barangays rvb on rvb.report_version_id=rv.id
   join public.reporting_cycles pc on pc.id=pr.reporting_cycle_id
   where pr.lgu_id=r.lgu_id and pr.incident_id=r.incident_id and pc.cutoff_at < (select cutoff_at from public.reporting_cycles where id=r.reporting_cycle_id)
     and rv.status in ('VALIDATED','INCLUDED_IN_SITREP')
   order by pc.cutoff_at desc, rv.version_number desc
 loop
   if not (result ? rec.barangay_id::text) then result:=result||jsonb_build_object(rec.barangay_id::text,rec.data_snapshot); end if;
 end loop;
 return result;
end $$;

-- Server-side validation. CUM rules are intentionally conservative: carry forward previous CUM, never silently reset/decrease, and ensure NOW <= CUM.
create or replace function public.validate_report_version(p_version_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_report public.reports; v_version public.report_versions; issues jsonb:='[]'; rec record; prev jsonb; k text; now_key text; cum numeric; nowv numeric; prevcum numeric; af numeric; ap numeric;
begin
 select * into v_version from public.report_versions where id=p_version_id;
 select * into v_report from public.reports where id=v_version.report_id;
 if not (public.is_ops() or (public.my_role()='lgu' and public.my_lgu()=v_report.lgu_id)) then raise exception 'Not authorized'; end if;
 for rec in select rvb.*,b.name barangay_name from public.report_version_barangays rvb join public.barangays b on b.id=rvb.barangay_id where rvb.report_version_id=p_version_id loop
   select x.data_snapshot into prev from public.report_versions pv join public.reports pr on pr.id=pv.report_id join public.reporting_cycles pc on pc.id=pr.reporting_cycle_id join public.report_version_barangays x on x.report_version_id=pv.id and x.barangay_id=rec.barangay_id where pr.lgu_id=v_report.lgu_id and pr.incident_id=v_report.incident_id and pc.cutoff_at < (select cutoff_at from public.reporting_cycles where id=v_report.reporting_cycle_id) and pv.status in ('VALIDATED','INCLUDED_IN_SITREP') order by pc.cutoff_at desc,pv.version_number desc limit 1;
   for k in select jsonb_object_keys(rec.data_snapshot) loop
     if (rec.data_snapshot->>k) ~ '^-?[0-9]+(\.[0-9]+)?$' and (rec.data_snapshot->>k)::numeric < 0 then issues:=issues||jsonb_build_array(jsonb_build_object('severity','RED','barangay_name',rec.barangay_name,'field',k,'message','Negative values are not allowed.')); end if;
     if right(k,4)='_cum' then
       now_key:=left(k,length(k)-4)||'_now'; cum:=coalesce(nullif(rec.data_snapshot->>k,'')::numeric,0); nowv:=coalesce(nullif(rec.data_snapshot->>now_key,'')::numeric,0); prevcum:=coalesce(nullif(prev->>k,'')::numeric,0);
       if nowv>cum then issues:=issues||jsonb_build_array(jsonb_build_object('severity','RED','barangay_name',rec.barangay_name,'field',k,'message',format('NOW (%s) cannot be greater than CUM (%s).',nowv,cum))); end if;
       if cum<prevcum then issues:=issues||jsonb_build_array(jsonb_build_object('severity','RED','barangay_name',rec.barangay_name,'field',k,'message',format('CUM cannot decrease below previous validated CUM (%s).',prevcum))); end if;
     end if;
   end loop;
   af:=coalesce(nullif(rec.data_snapshot->>'affected_families','')::numeric,0); ap:=coalesce(nullif(rec.data_snapshot->>'affected_persons','')::numeric,0);
   if af>ap and ap>0 then issues:=issues||jsonb_build_array(jsonb_build_object('severity','ORANGE','barangay_name',rec.barangay_name,'field','affected_families','message','Affected families are greater than affected persons; verify the entry.')); end if;
 end loop;
 return issues;
end $$;

create or replace function public.validate_current_report(p_report_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.reports; temp_version uuid; result jsonb;
begin
 select * into r from public.reports where id=p_report_id;
 if not (public.is_ops() or (public.my_role()='lgu' and public.my_lgu()=r.lgu_id)) then raise exception 'Not authorized'; end if;
 insert into public.report_versions(report_id,version_number,status,header_snapshot,submitted_by) values(p_report_id,-1,'SUBMITTED',to_jsonb(r),auth.uid()) returning id into temp_version;
 insert into public.report_version_barangays(report_version_id,barangay_id,data_snapshot) select temp_version,barangay_id,data from public.barangay_reports where report_id=p_report_id;
 result:=public.validate_report_version(temp_version);
 delete from public.report_versions where id=temp_version;
 return result;
end $$;

create or replace function public.submit_report(p_report_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.reports; vno integer; vid uuid; issues jsonb; red_count integer;
begin
 select * into r from public.reports where id=p_report_id for update;
 if public.my_role()<>'lgu' or public.my_lgu()<>r.lgu_id then raise exception 'LGU users may submit only their assigned LGU.'; end if;
 if r.status not in ('DRAFT','RETURNED_FOR_CORRECTION') then raise exception 'This report is not editable/submittable.'; end if;
 if not exists(select 1 from public.barangay_reports where report_id=p_report_id) then raise exception 'No affected barangays were added. Use Zero Report when appropriate.'; end if;
 select coalesce(max(version_number),0)+1 into vno from public.report_versions where report_id=p_report_id and version_number>0;
 insert into public.report_versions(report_id,version_number,status,header_snapshot,submitted_by) values(p_report_id,vno,'SUBMITTED',to_jsonb(r),auth.uid()) returning id into vid;
 insert into public.report_version_barangays(report_version_id,barangay_id,data_snapshot) select vid,barangay_id,data from public.barangay_reports where report_id=p_report_id;
 issues:=public.validate_report_version(vid);
 select count(*) into red_count from jsonb_array_elements(issues) x where x->>'severity'='RED';
 if red_count>0 then delete from public.report_versions where id=vid; raise exception 'Submission blocked by % validation error(s).',red_count; end if;
 update public.reports set status=(case when r.status='RETURNED_FOR_CORRECTION' then 'RESUBMITTED' else 'SUBMITTED' end)::public.report_status,submitted_at=now(),submitted_by=auth.uid(),validation_error_count=red_count,updated_at=now() where id=p_report_id;
 perform public.audit('REPORT_SUBMITTED','report_version',vid,p_report_id,vid,jsonb_build_object('version',vno));
 insert into public.notifications(user_id,title,message,action_url) select id,r.lgu_id::text||' submitted a DROMIC report',(select name from public.lgus where id=r.lgu_id)||' submitted SitRep cycle report.','/review/'||p_report_id from public.profiles where role in ('pswdo','admin') and approved;
 return jsonb_build_object('report_version_id',vid,'version_number',vno,'issues',issues);
end $$;

create or replace function public.submit_zero_report(p_report_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.reports; vno integer; vid uuid;
begin
 select * into r from public.reports where id=p_report_id for update;
 if public.my_role()<>'lgu' or public.my_lgu()<>r.lgu_id then raise exception 'Not authorized'; end if;
 delete from public.barangay_reports where report_id=p_report_id;
 select coalesce(max(version_number),0)+1 into vno from public.report_versions where report_id=p_report_id and version_number>0;
 update public.reports set zero_report=true,status=(case when status='RETURNED_FOR_CORRECTION' then 'RESUBMITTED' else 'SUBMITTED' end)::public.report_status,submitted_at=now(),submitted_by=auth.uid(),updated_at=now() where id=p_report_id;
 insert into public.report_versions(report_id,version_number,status,header_snapshot,submitted_by) select id,vno,'SUBMITTED',to_jsonb(reports),auth.uid() from public.reports where id=p_report_id returning id into vid;
 perform public.audit('ZERO_REPORT_SUBMITTED','report_version',vid,p_report_id,vid,jsonb_build_object('version',vno));
end $$;

create or replace function public.return_report_for_correction(p_version_id uuid,p_remark text) returns void language plpgsql security definer set search_path=public as $$
declare v public.report_versions; r public.reports;
begin
 if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;
 select * into v from public.report_versions where id=p_version_id; select * into r from public.reports where id=v.report_id;
 update public.report_versions set status='RETURNED' where id=p_version_id;
 update public.reports set status='RETURNED_FOR_CORRECTION',updated_at=now() where id=r.id;
 insert into public.remarks(report_id,report_version_id,author_id,remark_type,body) values(r.id,p_version_id,auth.uid(),'CORRECTION',p_remark);
 insert into public.notifications(user_id,title,message,action_url) select id,'Report returned for correction',p_remark,'/report/'||r.id from public.profiles where lgu_id=r.lgu_id and role='lgu' and approved;
 perform public.audit('REPORT_RETURNED','report_version',p_version_id,r.id,p_version_id,jsonb_build_object('remark',p_remark));
end $$;

create or replace function public.approve_report_version(p_version_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v public.report_versions; r public.reports; issues jsonb; red_count integer;
begin
 if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;
 select * into v from public.report_versions where id=p_version_id; select * into r from public.reports where id=v.report_id;
 issues:=public.validate_report_version(p_version_id); select count(*) into red_count from jsonb_array_elements(issues) x where x->>'severity'='RED';
 if red_count>0 then raise exception 'Validation blocked: % error(s) remain.',red_count; end if;
 update public.report_versions set status='VALIDATED',validated_by=auth.uid(),validated_at=now() where id=p_version_id;
 update public.reports set status='VALIDATED',validated_by=auth.uid(),validated_at=now(),validation_error_count=0,updated_at=now() where id=r.id;
 insert into public.notifications(user_id,title,message,action_url) select id,'Report validated','PSWDO validated your DROMIC report.','/report/'||r.id from public.profiles where lgu_id=r.lgu_id and role='lgu' and approved;
 perform public.audit('REPORT_VALIDATED','report_version',p_version_id,r.id,p_version_id,'{}');
end $$;

create or replace function public.create_sitrep_from_cycle(p_cycle_id uuid,p_prepared_by text) returns public.sitreps language plpgsql security definer set search_path=public as $$
declare c public.reporting_cycles; s public.sitreps;
begin
 if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;
 select * into c from public.reporting_cycles where id=p_cycle_id;
 insert into public.sitreps(incident_id,reporting_cycle_id,sitrep_number,cutoff_at,prepared_by) values(c.incident_id,c.id,c.sitrep_number,c.cutoff_at,p_prepared_by) on conflict(reporting_cycle_id) do update set prepared_by=excluded.prepared_by returning * into s;
 insert into public.sitrep_reports(sitrep_id,lgu_id,report_version_id)
 select s.id,r.lgu_id,rv.id from public.reports r join lateral (select * from public.report_versions x where x.report_id=r.id and x.status='VALIDATED' order by x.version_number desc limit 1) rv on true where r.reporting_cycle_id=p_cycle_id
 on conflict(sitrep_id,lgu_id) do nothing;
 perform public.audit('SITREP_GENERATED','sitrep',s.id,null,null,jsonb_build_object('cycle',p_cycle_id));
 return s;
end $$;

create or replace function public.get_sitrep_consolidation(p_sitrep_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_authorized_viewer() then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(x order by x->>'lgu_name'),'[]'::jsonb) into result from (
  select jsonb_build_object('lgu_id',l.id,'lgu_name',l.name,'report_version_id',rv.id,'version_number',rv.version_number,'barangays',coalesce((select jsonb_agg(jsonb_build_object('barangay_id',b.id,'barangay_name',b.name,'data',rvb.data_snapshot) order by b.name) from public.report_version_barangays rvb join public.barangays b on b.id=rvb.barangay_id where rvb.report_version_id=rv.id),'[]'::jsonb)) x
  from public.sitrep_reports sr join public.lgus l on l.id=sr.lgu_id join public.report_versions rv on rv.id=sr.report_version_id where sr.sitrep_id=p_sitrep_id
 ) q;
 return result;
end $$;

create or replace function public.finalize_sitrep(p_sitrep_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;
 update public.sitreps set status='FINALIZED',finalized_at=now(),finalized_by=auth.uid() where id=p_sitrep_id and status='DRAFT';
 update public.report_versions rv set status='INCLUDED_IN_SITREP' from public.sitrep_reports sr where sr.sitrep_id=p_sitrep_id and rv.id=sr.report_version_id;
 update public.reports r set status='INCLUDED_IN_SITREP' from public.sitrep_reports sr join public.report_versions rv on rv.id=sr.report_version_id where sr.sitrep_id=p_sitrep_id and r.id=rv.report_id;
 perform public.audit('SITREP_FINALIZED','sitrep',p_sitrep_id,null,null,'{}');
end $$;

-- RLS
alter table public.lgus enable row level security; alter table public.barangays enable row level security; alter table public.profiles enable row level security; alter table public.incidents enable row level security; alter table public.reporting_cycles enable row level security; alter table public.reports enable row level security; alter table public.barangay_reports enable row level security; alter table public.report_versions enable row level security; alter table public.report_version_barangays enable row level security; alter table public.remarks enable row level security; alter table public.sitreps enable row level security; alter table public.sitrep_reports enable row level security; alter table public.notifications enable row level security; alter table public.audit_logs enable row level security; alter table public.distribution_logs enable row level security;

create policy "authenticated view LGU master" on public.lgus for select to authenticated using(true);
create policy "authenticated view barangay master" on public.barangays for select to authenticated using(true);
create policy "own profile or admin" on public.profiles for select to authenticated using(id=auth.uid() or public.my_role()='admin');
create policy "admin updates profiles" on public.profiles for update to authenticated using(public.my_role()='admin') with check(public.my_role()='admin');
create policy "approved view incidents" on public.incidents for select to authenticated using((select approved from public.profiles where id=auth.uid()));
create policy "ops manage incidents" on public.incidents for all to authenticated using(public.is_ops()) with check(public.is_ops());
create policy "approved view cycles" on public.reporting_cycles for select to authenticated using((select approved from public.profiles where id=auth.uid()));
create policy "ops manage cycles" on public.reporting_cycles for all to authenticated using(public.is_ops()) with check(public.is_ops());
create policy "report select by role" on public.reports for select to authenticated using(public.is_authorized_viewer() or (public.my_role()='lgu' and lgu_id=public.my_lgu()));
create policy "LGU creates own report" on public.reports for insert to authenticated with check(public.my_role()='lgu' and lgu_id=public.my_lgu() and created_by=auth.uid());
create policy "LGU updates editable own report" on public.reports for update to authenticated using(public.my_role()='lgu' and lgu_id=public.my_lgu() and status in ('DRAFT','RETURNED_FOR_CORRECTION')) with check(lgu_id=public.my_lgu());
create policy "ops update reports" on public.reports for update to authenticated using(public.is_ops()) with check(public.is_ops());
create policy "barangay report select" on public.barangay_reports for select to authenticated using(exists(select 1 from public.reports r where r.id=report_id and (public.is_authorized_viewer() or (public.my_role()='lgu' and r.lgu_id=public.my_lgu()))));
create policy "LGU manage current barangays" on public.barangay_reports for all to authenticated using(exists(select 1 from public.reports r where r.id=report_id and public.my_role()='lgu' and r.lgu_id=public.my_lgu() and r.status in ('DRAFT','RETURNED_FOR_CORRECTION'))) with check(exists(select 1 from public.reports r where r.id=report_id and r.lgu_id=public.my_lgu() and r.status in ('DRAFT','RETURNED_FOR_CORRECTION')));
create policy "versions view" on public.report_versions for select to authenticated using(exists(select 1 from public.reports r where r.id=report_id and (public.is_authorized_viewer() or (public.my_role()='lgu' and r.lgu_id=public.my_lgu()))));
create policy "version barangays view" on public.report_version_barangays for select to authenticated using(exists(select 1 from public.report_versions rv join public.reports r on r.id=rv.report_id where rv.id=report_version_id and (public.is_authorized_viewer() or (public.my_role()='lgu' and r.lgu_id=public.my_lgu()))));
create policy "remarks view" on public.remarks for select to authenticated using(exists(select 1 from public.reports r where r.id=report_id and (public.is_ops() or (public.my_role()='lgu' and r.lgu_id=public.my_lgu()))));
create policy "sitrep view" on public.sitreps for select to authenticated using(public.is_authorized_viewer());
create policy "sitrep reports view" on public.sitrep_reports for select to authenticated using(public.is_authorized_viewer());
create policy "own notifications" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "admin audit view" on public.audit_logs for select to authenticated using(public.my_role()='admin' or public.my_role()='pswdo');
create policy "distribution view" on public.distribution_logs for select to authenticated using(public.is_authorized_viewer());

-- Admin/bootstrap utilities intentionally not granted through the public client.
create or replace function public.bootstrap_admin(p_email text) returns void language plpgsql security definer set search_path=public as $$ begin update public.profiles set role='admin',approved=true where lower(email)=lower(p_email); end $$;
revoke all on function public.bootstrap_admin(text) from public,anon,authenticated;

-- Controlled master-data fallback for LGUs whose barangay list is incomplete in the source workbook.
create or replace function public.create_barangay_for_my_lgu(p_name text) returns public.barangays language plpgsql security definer set search_path=public as $$
declare b public.barangays; lid uuid;
begin
 if public.my_role()<>'lgu' then raise exception 'LGU account required'; end if;
 lid:=public.my_lgu(); if lid is null then raise exception 'No LGU is assigned to this account'; end if;
 if length(trim(p_name))<2 then raise exception 'Barangay name is required'; end if;
 insert into public.barangays(lgu_id,name) values(lid,upper(trim(p_name))) on conflict(lgu_id,name) do update set active=true returning * into b;
 perform public.audit('BARANGAY_MASTER_ADDED','barangay',b.id,null,null,jsonb_build_object('name',b.name,'lgu_id',lid));
 return b;
end $$;

create or replace function public.distribute_sitrep(p_sitrep_id uuid,p_recipients text[],p_method text default 'SECURE_ACCESS') returns integer language plpgsql security definer set search_path=public as $$
declare recipient text; c integer:=0; s public.sitreps;
begin
 if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;
 select * into s from public.sitreps where id=p_sitrep_id;
 if s.status not in ('FINALIZED','DISTRIBUTED') then raise exception 'Finalize the SitRep before distribution.'; end if;
 foreach recipient in array p_recipients loop
   if length(trim(recipient))>0 then insert into public.distribution_logs(sitrep_id,recipient,delivery_method,sent_by) values(p_sitrep_id,trim(recipient),p_method,auth.uid()); c:=c+1; end if;
 end loop;
 update public.sitreps set status='DISTRIBUTED',recipients=p_recipients where id=p_sitrep_id;
 perform public.audit('SITREP_DISTRIBUTED','sitrep',p_sitrep_id,null,null,jsonb_build_object('recipients',p_recipients,'method',p_method));
 return c;
end $$;
