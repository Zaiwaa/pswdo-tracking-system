-- DROMIC authentication/profile diagnostic.
-- Replace YOUR_EMAIL@example.com in the two places below before running.

-- 1) Show whether the account exists in Supabase Auth and public.profiles.
select
  u.id as auth_user_id,
  u.email as auth_email,
  u.email_confirmed_at,
  p.id as profile_id,
  p.email as profile_email,
  p.full_name,
  p.role,
  p.approved,
  p.lgu_id,
  p.requested_lgu_name
from auth.users u
left join public.profiles p on p.id=u.id
where lower(u.email)=lower('YOUR_EMAIL@example.com');

-- 2) Repair a missing profile for that account if necessary.
insert into public.profiles(id,email,full_name,office_position,requested_lgu_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name',''),
  u.raw_user_meta_data->>'office_position',
  u.raw_user_meta_data->>'requested_lgu_name'
from auth.users u
where lower(u.email)=lower('YOUR_EMAIL@example.com')
on conflict(id) do nothing;

-- 3) For the FIRST PSWDO administrator only, run this separately after replacing the email:
-- select public.bootstrap_admin('YOUR_EMAIL@example.com');
