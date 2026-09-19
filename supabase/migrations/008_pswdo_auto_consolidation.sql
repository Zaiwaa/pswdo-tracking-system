-- DROMIC V5.3
-- When PSWDO validates an LGU version, automatically include that exact version
-- in the current DRAFT provincial SitRep. Finalized SitReps remain immutable.

create or replace function public.approve_report_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.report_versions;
  r public.reports;
  c public.reporting_cycles;
  s public.sitreps;
  issues jsonb;
  red_count integer;
  validator_name text;
begin
  if not public.is_ops() then raise exception 'PSWDO authorization required'; end if;

  select * into v from public.report_versions where id=p_version_id;
  if v.id is null then raise exception 'Report version not found'; end if;
  select * into r from public.reports where id=v.report_id;
  select * into c from public.reporting_cycles where id=r.reporting_cycle_id;

  issues:=public.validate_report_version(p_version_id);
  select count(*) into red_count from jsonb_array_elements(issues) x where x->>'severity'='RED';
  if red_count>0 then raise exception 'Validation blocked: % error(s) remain.',red_count; end if;

  update public.report_versions
     set status='VALIDATED',validated_by=auth.uid(),validated_at=now()
   where id=p_version_id;
  update public.reports
     set status='VALIDATED',validated_by=auth.uid(),validated_at=now(),validation_error_count=0,updated_at=now()
   where id=r.id;

  -- Ensure the cycle has a DRAFT PSWDO main report. The validator becomes the
  -- initial preparer only when the SitRep did not exist yet.
  select full_name into validator_name from public.profiles where id=auth.uid();
  select * into s from public.sitreps where reporting_cycle_id=r.reporting_cycle_id;

  if s.id is null then
    insert into public.sitreps(incident_id,reporting_cycle_id,sitrep_number,cutoff_at,prepared_by)
    values(c.incident_id,c.id,c.sitrep_number,c.cutoff_at,coalesce(validator_name,'PSWDO'))
    returning * into s;
  end if;

  -- Do not alter a finalized/distributed historical SitRep.
  if s.status='DRAFT' then
    insert into public.sitrep_reports(sitrep_id,lgu_id,report_version_id,included_at)
    values(s.id,r.lgu_id,p_version_id,now())
    on conflict(sitrep_id,lgu_id)
    do update set report_version_id=excluded.report_version_id,included_at=now();
  end if;

  insert into public.notifications(user_id,title,message,action_url)
  select id,'Report validated','PSWDO validated your DROMIC report.','/report/'||r.id
    from public.profiles where lgu_id=r.lgu_id and role='lgu' and approved;

  perform public.audit('REPORT_VALIDATED','report_version',p_version_id,r.id,p_version_id,
    jsonb_build_object('auto_consolidated',s.status='DRAFT','sitrep_id',s.id));
end $$;
