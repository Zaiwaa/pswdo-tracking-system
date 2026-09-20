-- DROMIC V6.1 account and incident administration
-- Run after 010_v6_operations.sql.

alter table public.profiles add column if not exists emergency_operator boolean not null default false;

-- Incident status values are text in current schema. V6.1 uses ACTIVE, CLOSED and INACTIVE.

create or replace function public.admin_update_profile_v6(
  p_user_id uuid,
  p_role text,
  p_lgu_id uuid,
  p_approved boolean,
  p_emergency_operator boolean default false
) returns void
language plpgsql security definer set search_path=public
as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id=auth.uid();
  if me.id is null or (me.role <> 'admin' and coalesce(me.emergency_operator,false)=false) then
    raise exception 'Administrator or Emergency Operator access required';
  end if;
  if p_role not in ('lgu','pswdo','viewer','admin') then raise exception 'Invalid role'; end if;
  update public.profiles set role=p_role,lgu_id=case when p_role='lgu' then p_lgu_id else null end,
    approved=p_approved, emergency_operator=p_emergency_operator where id=p_user_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'ACCOUNT_ACCESS_UPDATED','profile',p_user_id,jsonb_build_object('role',p_role,'approved',p_approved,'emergency_operator',p_emergency_operator));
end $$;

create or replace function public.admin_delete_account_v6(p_user_id uuid) returns void
language plpgsql security definer set search_path=public,auth
as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id=auth.uid();
  if me.id is null or (me.role <> 'admin' and coalesce(me.emergency_operator,false)=false) then
    raise exception 'Administrator or Emergency Operator access required';
  end if;
  if p_user_id=auth.uid() then raise exception 'You cannot delete your current account'; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  select auth.uid(),'ACCOUNT_DELETED','profile',p.id,jsonb_build_object('full_name',p.full_name,'email',p.email,'role',p.role) from public.profiles p where p.id=p_user_id;
  -- Preserve historical report rows; detach references where FK design permits before auth deletion.
  delete from auth.users where id=p_user_id;
end $$;

grant execute on function public.admin_update_profile_v6(uuid,text,uuid,boolean,boolean) to authenticated;
grant execute on function public.admin_delete_account_v6(uuid) to authenticated;
