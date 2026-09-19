-- DROMIC V5.4 collaboration, notifications, profile photos, incident/cycle alerts,
-- chat, no-change submissions and report update/version history support.

alter table public.profiles add column if not exists avatar_url text;

-- Chat
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_pair_time on public.chat_messages(sender_id,recipient_id,created_at desc);
alter table public.chat_messages enable row level security;
drop policy if exists "chat participants view" on public.chat_messages;
create policy "chat participants view" on public.chat_messages for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists "chat sender insert" on public.chat_messages;
create policy "chat sender insert" on public.chat_messages for insert to authenticated with check(sender_id=auth.uid());
drop policy if exists "chat recipient update" on public.chat_messages;
create policy "chat recipient update" on public.chat_messages for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());

create or replace function public.list_chat_contacts()
returns table(id uuid,full_name text,email text,role public.user_role,lgu_name text,avatar_url text)
language sql security definer set search_path=public as $$
  select p.id,p.full_name,p.email,p.role,l.name,p.avatar_url
  from public.profiles p left join public.lgus l on l.id=p.lgu_id
  where p.approved=true and p.id<>auth.uid()
  order by case p.role when 'pswdo' then 1 when 'admin' then 2 when 'lgu' then 3 else 4 end,p.full_name;
$$;
grant execute on function public.list_chat_contacts() to authenticated;

create or replace function public.send_chat_message(p_recipient_id uuid,p_body text)
returns public.chat_messages language plpgsql security definer set search_path=public as $$
declare m public.chat_messages; sender_name text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_recipient_id=auth.uid() then raise exception 'Choose another user'; end if;
 if length(trim(coalesce(p_body,'')))=0 then raise exception 'Message cannot be empty'; end if;
 if not exists(select 1 from public.profiles where id=p_recipient_id and approved) then raise exception 'Recipient unavailable'; end if;
 insert into public.chat_messages(sender_id,recipient_id,body) values(auth.uid(),p_recipient_id,trim(p_body)) returning * into m;
 select coalesce(nullif(full_name,''),email,'DROMIC user') into sender_name from public.profiles where id=auth.uid();
 insert into public.notifications(user_id,title,message,action_url) values(p_recipient_id,'New DROMIC message',sender_name||' sent you a message.','/chat?user='||auth.uid());
 return m;
end $$;
grant execute on function public.send_chat_message(uuid,text) to authenticated;

-- Profile update now also accepts an avatar URL.
create or replace function public.update_my_contact_profile(p_full_name text,p_office_position text,p_contact_number text,p_avatar_url text default null)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if length(trim(coalesce(p_full_name,'')))=0 then raise exception 'Full name is required.'; end if;
  if length(trim(coalesce(p_contact_number,'')))=0 then raise exception 'Contact number is required.'; end if;
  update public.profiles set full_name=trim(p_full_name),office_position=nullif(trim(coalesce(p_office_position,'')),''),contact_number=trim(p_contact_number),avatar_url=coalesce(nullif(trim(coalesce(p_avatar_url,'')),''),avatar_url),updated_at=now()
  where id=auth.uid() returning * into v;
  return v;
end $$;
grant execute on function public.update_my_contact_profile(text,text,text,text) to authenticated;

-- Storage bucket for profile images. Safe to re-run.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "profile photos public read" on storage.objects;
create policy "profile photos public read" on storage.objects for select using(bucket_id='profile-photos');
drop policy if exists "users upload own profile photo" on storage.objects;
create policy "users upload own profile photo" on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users update own profile photo" on storage.objects;
create policy "users update own profile photo" on storage.objects for update to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

-- Broadcast incident and reporting-cycle creation to every approved account.
create or replace function public.notify_all_new_incident() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(user_id,title,message,action_url)
 select id,'New incident created',NEW.name||' has been created in DROMIC.','/' from public.profiles where approved=true;
 return NEW;
end $$;
drop trigger if exists trg_notify_all_new_incident on public.incidents;
create trigger trg_notify_all_new_incident after insert on public.incidents for each row execute function public.notify_all_new_incident();

create or replace function public.notify_all_new_cycle() returns trigger language plpgsql security definer set search_path=public as $$
declare inc_name text;
begin
 select name into inc_name from public.incidents where id=NEW.incident_id;
 insert into public.notifications(user_id,title,message,action_url)
 select id,'New SitRep reporting cycle','SitRep '||NEW.sitrep_number||' for '||coalesce(inc_name,'the active incident')||' is now open.','/' from public.profiles where approved=true;
 return NEW;
end $$;
drop trigger if exists trg_notify_all_new_cycle on public.reporting_cycles;
create trigger trg_notify_all_new_cycle after insert on public.reporting_cycles for each row execute function public.notify_all_new_cycle();

-- LGU can explicitly submit an unchanged update. A complete new report version is retained.
create or replace function public.submit_no_change_report(p_report_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.reports; me public.profiles; prev public.report_versions; vno integer; vid uuid; lgu_name text;
begin
 select * into r from public.reports where id=p_report_id for update;
 select * into me from public.profiles where id=auth.uid();
 if me.role<>'lgu' or me.lgu_id<>r.lgu_id then raise exception 'LGU users may submit only their assigned LGU.'; end if;
 if length(trim(coalesce(me.email,'')))=0 or length(trim(coalesce(me.contact_number,'')))=0 then raise exception 'Complete your profile email and contact number before submitting.'; end if;
 select * into prev from public.report_versions where report_id=p_report_id order by version_number desc limit 1;
 if prev.id is null then raise exception 'Submit the first report normally before using No Change.'; end if;
 select coalesce(max(version_number),0)+1 into vno from public.report_versions where report_id=p_report_id;
 insert into public.report_versions(report_id,version_number,status,header_snapshot,submitted_by)
 values(p_report_id,vno,'SUBMITTED',jsonb_set(prev.header_snapshot,'{no_change}', 'true'::jsonb, true),auth.uid()) returning id into vid;
 insert into public.report_version_barangays(report_version_id,barangay_id,data_snapshot)
 select vid,barangay_id,data_snapshot from public.report_version_barangays where report_version_id=prev.id;
 update public.reports set status='SUBMITTED',submitted_at=now(),submitted_by=auth.uid(),updated_at=now() where id=p_report_id;
 select name into lgu_name from public.lgus where id=r.lgu_id;
 insert into public.notifications(user_id,title,message,action_url)
 select id,'LGU submitted NO CHANGE',lgu_name||' reported no change from its previous DROMIC submission.','/review/'||p_report_id from public.profiles where role in ('pswdo','admin') and approved=true;
 perform public.audit('NO_CHANGE_SUBMITTED','report_version',vid,p_report_id,vid,jsonb_build_object('version',vno,'copied_from',prev.id));
 return jsonb_build_object('report_version_id',vid,'version_number',vno);
end $$;
grant execute on function public.submit_no_change_report(uuid) to authenticated;

-- Re-open the working copy for a changed update while keeping all submitted versions immutable.
create or replace function public.start_report_update(p_report_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.reports;
begin
 select * into r from public.reports where id=p_report_id for update;
 if public.my_role()<>'lgu' or public.my_lgu()<>r.lgu_id then raise exception 'Not authorized'; end if;
 if r.status not in ('SUBMITTED','RESUBMITTED','VALIDATED','INCLUDED_IN_SITREP') then raise exception 'This report is already editable.'; end if;
 update public.reports set status='DRAFT',zero_report=false,updated_at=now() where id=p_report_id;
 perform public.audit('REPORT_UPDATE_STARTED','report',p_report_id,p_report_id,null,'{}'::jsonb);
end $$;
grant execute on function public.start_report_update(uuid) to authenticated;

-- PSWDO + admins are both operations managers; policy in 001 already uses is_ops().
-- This explicit helper makes the intent clear to the UI.
create or replace function public.can_manage_operations() returns boolean language sql stable security definer set search_path=public as $$
 select public.is_ops();
$$;
grant execute on function public.can_manage_operations() to authenticated;

-- Bulk-import official Pangasinan PSGC barangays from JSON supplied by the PSWDO UI.
create or replace function public.import_pangasinan_barangays(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; bname text; parent text; normalized_parent text; lid uuid; bcount integer:=0; lcount integer:=0;
begin
 if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;
 for item in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
   bname:=coalesce(item->>'name',item->>'barangay',item->>'barangay_name',item->>'area_name');
   parent:=coalesce(item->>'municipality',item->>'city',item->>'city_municipality',item->>'municipality_city',item->>'parent_name');
   if bname is null or parent is null then continue; end if;
   normalized_parent:=regexp_replace(parent,'^(Municipality of |City of )','','i');
   select id into lid from public.lgus where lower(regexp_replace(name,'^City of ','','i'))=lower(normalized_parent) limit 1;
   if lid is null then
     insert into public.lgus(code,name,kind,active) values(upper(regexp_replace(normalized_parent,'[^A-Za-z0-9]+','_','g')),case when lower(parent) like 'city of %' then 'City of '||normalized_parent else normalized_parent end,case when lower(parent) like 'city of %' then 'City' else 'Municipality' end,true)
     on conflict(name) do update set active=true returning id into lid;
     lcount:=lcount+1;
   end if;
   insert into public.barangays(lgu_id,name,active) values(lid,bname,true) on conflict(lgu_id,name) do update set active=true;
   bcount:=bcount+1;
 end loop;
 return jsonb_build_object('barangays',bcount,'lgus',(select count(*) from public.lgus where active));
end $$;
grant execute on function public.import_pangasinan_barangays(jsonb) to authenticated;

create or replace function public.notify_all_new_sitrep() returns trigger language plpgsql security definer set search_path=public as $$
declare inc_name text;
begin
 select name into inc_name from public.incidents where id=NEW.incident_id;
 insert into public.notifications(user_id,title,message,action_url)
 select id,'New provincial SitRep created','Provincial SitRep '||NEW.sitrep_number||' for '||coalesce(inc_name,'the incident')||' has been created.','/sitrep'
 from public.profiles where approved=true;
 return NEW;
end $$;
drop trigger if exists trg_notify_all_new_sitrep on public.sitreps;
create trigger trg_notify_all_new_sitrep after insert on public.sitreps for each row execute function public.notify_all_new_sitrep();
