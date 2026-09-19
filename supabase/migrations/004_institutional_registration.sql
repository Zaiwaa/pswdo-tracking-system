-- V4: Separate LGU, PSWDO and DSWD/PDRRMO registration behavior.
-- Safe to run after 001, 002 and 003.

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
  -- Never allow public sign-up metadata to create an administrator.
  if reg_type = 'pswdo' then
    resolved_role := 'pswdo';
    resolved_approved := false; -- System Administrator authorization required.
    requested_name := 'PSWDO';
  elsif reg_type = 'viewer' then
    resolved_role := 'viewer';
    resolved_approved := true; -- Per current business rule: no LGU approval queue.
    requested_name := coalesce(institution,'DSWD / PDRRMO');
  else
    resolved_role := 'lgu';
    resolved_approved := false; -- PSWDO focal verification required.
  end if;

  insert into public.profiles(
    id,email,full_name,office_position,requested_lgu_name,role,lgu_id,approved
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'office_position',
    requested_name,
    resolved_role,
    null,
    resolved_approved
  )
  on conflict (id) do update set
    email=excluded.email,
    full_name=excluded.full_name,
    office_position=excluded.office_position,
    requested_lgu_name=excluded.requested_lgu_name,
    updated_at=now();

  return new;
end;
$$;

-- Existing pending accounts can be normalized from their registration metadata.
update public.profiles p
set role='viewer', approved=true, lgu_id=null,
    requested_lgu_name=coalesce(nullif(u.raw_user_meta_data->>'institution',''),'DSWD / PDRRMO'),
    updated_at=now()
from auth.users u
where p.id=u.id
  and u.raw_user_meta_data->>'registration_type'='viewer';

update public.profiles p
set role='pswdo', approved=false, lgu_id=null,
    requested_lgu_name='PSWDO', updated_at=now()
from auth.users u
where p.id=u.id
  and u.raw_user_meta_data->>'registration_type'='pswdo'
  and p.role <> 'admin';

-- Keep LGU public registrations pending until PSWDO approval.
update public.profiles p
set role='lgu', approved=false, lgu_id=null, updated_at=now()
from auth.users u
where p.id=u.id
  and coalesce(u.raw_user_meta_data->>'registration_type','lgu')='lgu'
  and p.role <> 'admin';
