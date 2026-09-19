-- V5: required contact details + reliable PSWDO submission notifications.
-- Run after migrations 001-004.

alter table public.profiles add column if not exists contact_number text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  reg_type text := coalesce(new.raw_user_meta_data->>'registration_type','lgu');
  institution text := nullif(new.raw_user_meta_data->>'institution','');
  resolved_role public.user_role := 'lgu';
  resolved_approved boolean := false;
  requested_name text := nullif(new.raw_user_meta_data->>'requested_lgu_name','');
begin
  if reg_type = 'pswdo' then
    resolved_role := 'pswdo'; resolved_approved := false; requested_name := 'PSWDO';
  elsif reg_type = 'viewer' then
    resolved_role := 'viewer'; resolved_approved := true; requested_name := coalesce(institution,'DSWD / PDRRMO');
  else
    resolved_role := 'lgu'; resolved_approved := false;
  end if;

  insert into public.profiles(id,email,full_name,office_position,contact_number,requested_lgu_name,role,lgu_id,approved)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),new.raw_user_meta_data->>'office_position',new.raw_user_meta_data->>'contact_number',requested_name,resolved_role,null,resolved_approved)
  on conflict (id) do update set
    email=excluded.email,
    full_name=excluded.full_name,
    office_position=excluded.office_position,
    contact_number=coalesce(excluded.contact_number,public.profiles.contact_number),
    requested_lgu_name=excluded.requested_lgu_name,
    updated_at=now();
  return new;
end;
$$;

create or replace function public.update_my_contact_profile(p_full_name text,p_office_position text,p_contact_number text)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare v public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if length(trim(coalesce(p_full_name,'')))=0 then raise exception 'Full name is required.'; end if;
  if length(trim(coalesce(p_contact_number,'')))=0 then raise exception 'Contact number is required.'; end if;
  update public.profiles
  set full_name=trim(p_full_name),office_position=nullif(trim(coalesce(p_office_position,'')),''),contact_number=trim(p_contact_number),updated_at=now()
  where id=auth.uid() returning * into v;
  return v;
end;
$$;
revoke all on function public.update_my_contact_profile(text,text,text) from public,anon;
grant execute on function public.update_my_contact_profile(text,text,text) to authenticated;

create or replace function public.submit_report(p_report_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.reports; vno integer; vid uuid; issues jsonb; red_count integer; me public.profiles; lgu_name text;
begin
 select * into r from public.reports where id=p_report_id for update;
 select * into me from public.profiles where id=auth.uid();
 if me.role<>'lgu' or me.lgu_id<>r.lgu_id then raise exception 'LGU users may submit only their assigned LGU.'; end if;
 if length(trim(coalesce(me.email,'')))=0 or length(trim(coalesce(me.contact_number,'')))=0 then raise exception 'Complete your profile email and contact number before submitting.'; end if;
 if r.status not in ('DRAFT','RETURNED_FOR_CORRECTION') then raise exception 'This report is not editable/submittable.'; end if;
 if not exists(select 1 from public.barangay_reports where report_id=p_report_id) then raise exception 'No affected barangays were added. Use Zero Report when appropriate.'; end if;
 select coalesce(max(version_number),0)+1 into vno from public.report_versions where report_id=p_report_id and version_number>0;
 insert into public.report_versions(report_id,version_number,status,header_snapshot,submitted_by) values(p_report_id,vno,'SUBMITTED',to_jsonb(r),auth.uid()) returning id into vid;
 insert into public.report_version_barangays(report_version_id,barangay_id,data_snapshot) select vid,barangay_id,data from public.barangay_reports where report_id=p_report_id;
 issues:=public.validate_report_version(vid);
 select count(*) into red_count from jsonb_array_elements(issues) x where x->>'severity'='RED';
 if red_count>0 then delete from public.report_versions where id=vid; raise exception 'Submission blocked by % validation error(s). Correct the red fields and try again.',red_count; end if;
 update public.reports set status=(case when r.status='RETURNED_FOR_CORRECTION' then 'RESUBMITTED' else 'SUBMITTED' end)::public.report_status,submitted_at=now(),submitted_by=auth.uid(),validation_error_count=red_count,updated_at=now() where id=p_report_id;
 select name into lgu_name from public.lgus where id=r.lgu_id;
 perform public.audit('REPORT_SUBMITTED','report_version',vid,p_report_id,vid,jsonb_build_object('version',vno));
 insert into public.notifications(user_id,title,message,action_url)
 select id,'New LGU report submitted',lgu_name||' submitted a DROMIC report and it is ready for PSWDO review.','/review/'||p_report_id
 from public.profiles where role in ('pswdo','admin') and approved=true;
 return jsonb_build_object('report_version_id',vid,'version_number',vno,'issues',issues);
end $$;

create or replace function public.submit_zero_report(p_report_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.reports; vno integer; vid uuid; me public.profiles; lgu_name text;
begin
 select * into r from public.reports where id=p_report_id for update;
 select * into me from public.profiles where id=auth.uid();
 if me.role<>'lgu' or me.lgu_id<>r.lgu_id then raise exception 'LGU users may submit only their assigned LGU.'; end if;
 if length(trim(coalesce(me.email,'')))=0 or length(trim(coalesce(me.contact_number,'')))=0 then raise exception 'Complete your profile email and contact number before submitting.'; end if;
 if r.status not in ('DRAFT','RETURNED_FOR_CORRECTION') then raise exception 'This report is not editable/submittable.'; end if;
 delete from public.barangay_reports where report_id=p_report_id;
 select coalesce(max(version_number),0)+1 into vno from public.report_versions where report_id=p_report_id and version_number>0;
 update public.reports set zero_report=true,status=(case when status='RETURNED_FOR_CORRECTION' then 'RESUBMITTED' else 'SUBMITTED' end)::public.report_status,submitted_at=now(),submitted_by=auth.uid(),updated_at=now() where id=p_report_id;
 insert into public.report_versions(report_id,version_number,status,header_snapshot,submitted_by) select id,vno,'SUBMITTED',to_jsonb(reports),auth.uid() from public.reports where id=p_report_id returning id into vid;
 select name into lgu_name from public.lgus where id=r.lgu_id;
 perform public.audit('ZERO_REPORT_SUBMITTED','report_version',vid,p_report_id,vid,jsonb_build_object('version',vno));
 insert into public.notifications(user_id,title,message,action_url)
 select id,'New LGU zero report submitted',lgu_name||' submitted a ZERO / NO AFFECTED POPULATION report for this reporting cycle.','/review/'||p_report_id
 from public.profiles where role in ('pswdo','admin') and approved=true;
end $$;
