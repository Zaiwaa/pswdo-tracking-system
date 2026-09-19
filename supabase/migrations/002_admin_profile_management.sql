-- Reliable admin-only profile management for role/LGU approvals.
-- Run this AFTER 001_schema.sql.

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_role public.user_role,
  p_lgu_id uuid default null,
  p_approved boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_target public.profiles;
begin
  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.id is null or v_actor.role <> 'admin' or not v_actor.approved then
    raise exception 'Only an approved System Administrator can manage user accounts.' using errcode='42501';
  end if;

  if p_role = 'lgu' and p_lgu_id is null and p_approved then
    raise exception 'An approved LGU User must be assigned to an LGU.' using errcode='23514';
  end if;

  if p_role <> 'lgu' then
    p_lgu_id := null;
  end if;

  -- Prevent an administrator from accidentally removing their own admin access.
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own System Administrator role. Use another administrator account.' using errcode='42501';
  end if;

  update public.profiles
  set role = p_role,
      lgu_id = p_lgu_id,
      approved = p_approved
  where id = p_user_id
  returning * into v_target;

  if v_target.id is null then
    raise exception 'User profile not found.' using errcode='P0002';
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, lgu_id, details)
  values (
    auth.uid(),
    'USER_ACCESS_UPDATED',
    'profile',
    p_user_id,
    v_target.lgu_id,
    jsonb_build_object('role', v_target.role, 'approved', v_target.approved, 'lgu_id', v_target.lgu_id)
  );

  return v_target;
end;
$$;

revoke all on function public.admin_update_profile(uuid, public.user_role, uuid, boolean) from public, anon;
grant execute on function public.admin_update_profile(uuid, public.user_role, uuid, boolean) to authenticated;
