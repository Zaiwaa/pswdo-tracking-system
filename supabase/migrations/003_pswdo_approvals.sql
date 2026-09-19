-- V2: PSWDO-controlled LGU approvals and automatic approval for institutional roles.
-- Run AFTER 001_schema.sql and 002_admin_profile_management.sql.

create or replace function public.pswdo_list_lgu_registrations()
returns setof public.profiles
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id=auth.uid() and role in ('pswdo','admin') and approved=true
  ) then
    raise exception 'Only authorized PSWDO/System Administrators can review LGU registrations.' using errcode='42501';
  end if;
  return query
    select p.* from public.profiles p
    where p.role='lgu'
    order by p.approved asc, p.created_at desc;
end;
$$;
revoke all on function public.pswdo_list_lgu_registrations() from public, anon;
grant execute on function public.pswdo_list_lgu_registrations() to authenticated;

create or replace function public.pswdo_review_lgu_registration(
  p_user_id uuid,
  p_lgu_id uuid,
  p_approved boolean,
  p_note text default null
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
begin
  select * into v_actor from public.profiles where id=auth.uid();
  if v_actor.id is null or v_actor.role not in ('pswdo','admin') or not v_actor.approved then
    raise exception 'Only authorized PSWDO/System Administrators can approve LGU registrations.' using errcode='42501';
  end if;
  select * into v_target from public.profiles where id=p_user_id;
  if v_target.id is null then raise exception 'User profile not found.'; end if;
  if v_target.role <> 'lgu' then raise exception 'This workflow may approve LGU accounts only.'; end if;
  if p_approved and p_lgu_id is null then raise exception 'Choose an LGU before approval.'; end if;

  update public.profiles
  set lgu_id = case when p_approved then p_lgu_id else lgu_id end,
      approved = p_approved
  where id=p_user_id
  returning * into v_target;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,lgu_id,details)
  values(auth.uid(),case when p_approved then 'LGU_ACCOUNT_APPROVED' else 'LGU_ACCOUNT_UNAPPROVED' end,
         'profile',p_user_id,v_target.lgu_id,
         jsonb_build_object('note',p_note,'approved',p_approved,'lgu_id',v_target.lgu_id));

  insert into public.notifications(user_id,title,message,action_url)
  values(p_user_id,
    case when p_approved then 'LGU account approved' else 'LGU account access updated' end,
    case when p_approved then 'PSWDO approved your DROMIC account. You may now sign in and report for your assigned LGU.'
         else coalesce(nullif(p_note,''),'Your DROMIC LGU account approval was removed. Contact PSWDO for assistance.') end,
    '/');
  return v_target;
end;
$$;
revoke all on function public.pswdo_review_lgu_registration(uuid,uuid,boolean,text) from public, anon;
grant execute on function public.pswdo_review_lgu_registration(uuid,uuid,boolean,text) to authenticated;

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_role public.user_role,
  p_lgu_id uuid default null,
  p_approved boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
begin
  select * into v_actor from public.profiles where id=auth.uid();
  if v_actor.id is null or v_actor.role <> 'admin' or not v_actor.approved then
    raise exception 'Only an approved System Administrator can manage institutional roles.' using errcode='42501';
  end if;
  if p_role='lgu' and p_approved and p_lgu_id is null then
    raise exception 'An approved LGU User must be assigned to an LGU.';
  end if;
  if p_role <> 'lgu' then
    p_lgu_id := null;
    p_approved := true;
  end if;
  if p_user_id=auth.uid() and p_role<>'admin' then
    raise exception 'You cannot remove your own System Administrator role.';
  end if;
  update public.profiles set role=p_role,lgu_id=p_lgu_id,approved=p_approved
  where id=p_user_id returning * into v_target;
  if v_target.id is null then raise exception 'User profile not found.'; end if;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,lgu_id,details)
  values(auth.uid(),'USER_ACCESS_UPDATED','profile',p_user_id,v_target.lgu_id,
    jsonb_build_object('role',v_target.role,'approved',v_target.approved,'lgu_id',v_target.lgu_id));
  return v_target;
end;
$$;
