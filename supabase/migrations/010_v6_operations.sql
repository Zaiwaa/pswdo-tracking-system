-- V6: provincial emergency assistance, relief inventory/distribution and damaged-house summaries
alter table public.profiles add column if not exists emergency_operator boolean not null default false;

create table if not exists public.relief_items (
 id uuid primary key default gen_random_uuid(), name text not null unique, unit text not null default 'pcs', category text not null default 'Relief Item', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.relief_transactions (
 id uuid primary key default gen_random_uuid(), incident_id uuid references public.incidents(id), lgu_id uuid references public.lgus(id), item_id uuid not null references public.relief_items(id), transaction_type text not null check(transaction_type in ('RECEIVED','RELEASED_TO_LGU','DISTRIBUTED','ADJUSTMENT')), quantity numeric not null check(quantity>0), distribution_date date not null default current_date, reference_no text, recipient text, remarks text, recorded_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.ffp_distribution_reports (
 id uuid primary key default gen_random_uuid(), incident_id uuid references public.incidents(id), lgu_id uuid not null references public.lgus(id), barangay_id uuid references public.barangays(id), distribution_date date not null default current_date, families_served integer not null default 0, packs_distributed integer not null default 0, source text, reference_no text, remarks text, recorded_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);

insert into public.relief_items(name,unit,category) values
 ('Family Food Pack','packs','Food'),('Sleeping Kit','kits','Shelter/NFI'),('Water Filter','units','WASH'),('Family Tent','tents','Shelter'),('Hygiene Kit','kits','WASH') on conflict(name) do nothing;

alter table public.relief_items enable row level security; alter table public.relief_transactions enable row level security; alter table public.ffp_distribution_reports enable row level security;
drop policy if exists "relief items read" on public.relief_items; create policy "relief items read" on public.relief_items for select to authenticated using(true);
drop policy if exists "ops manage relief items" on public.relief_items; create policy "ops manage relief items" on public.relief_items for all to authenticated using(public.is_ops()) with check(public.is_ops());
drop policy if exists "authorized read relief tx" on public.relief_transactions; create policy "authorized read relief tx" on public.relief_transactions for select to authenticated using(public.is_authorized_viewer() or (public.my_role()='lgu' and lgu_id=public.my_lgu()));
drop policy if exists "ops manage relief tx" on public.relief_transactions; create policy "ops manage relief tx" on public.relief_transactions for all to authenticated using(public.is_ops()) with check(public.is_ops());
drop policy if exists "authorized read ffp" on public.ffp_distribution_reports; create policy "authorized read ffp" on public.ffp_distribution_reports for select to authenticated using(public.is_authorized_viewer() or (public.my_role()='lgu' and lgu_id=public.my_lgu()));
drop policy if exists "ops manage ffp" on public.ffp_distribution_reports; create policy "ops manage ffp" on public.ffp_distribution_reports for all to authenticated using(public.is_ops()) with check(public.is_ops());

-- Provincial emergency operators may edit LGU working copies, but every action remains attributable to their own account.
drop policy if exists "ops emergency manage current barangays" on public.barangay_reports;
create policy "ops emergency manage current barangays" on public.barangay_reports for all to authenticated
 using(exists(select 1 from public.reports r where r.id=report_id and public.is_ops() and r.status in ('DRAFT','RETURNED_FOR_CORRECTION')))
 with check(exists(select 1 from public.reports r where r.id=report_id and public.is_ops() and r.status in ('DRAFT','RETURNED_FOR_CORRECTION')));

create or replace function public.admin_set_emergency_operator(p_user_id uuid,p_enabled boolean) returns void language plpgsql security definer set search_path=public as $$
begin if public.my_role()<>'admin' then raise exception 'Administrator required'; end if; update public.profiles set emergency_operator=p_enabled,updated_at=now() where id=p_user_id; perform public.audit('EMERGENCY_OPERATOR_UPDATED','profile',p_user_id,null,null,jsonb_build_object('enabled',p_enabled)); end $$;
grant execute on function public.admin_set_emergency_operator(uuid,boolean) to authenticated;

create or replace function public.create_assisted_lgu_report(p_lgu_id uuid,p_cycle_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare me public.profiles; cyc public.reporting_cycles; rid uuid; inc uuid;
begin select * into me from public.profiles where id=auth.uid(); if me.role not in ('admin','pswdo') or not me.approved then raise exception 'Provincial authorization required'; end if; select * into cyc from public.reporting_cycles where id=p_cycle_id; if cyc.id is null then raise exception 'Reporting cycle not found'; end if; inc:=cyc.incident_id;
 insert into public.reports(incident_id,reporting_cycle_id,lgu_id,prepared_by,office_position,status,created_by) values(inc,p_cycle_id,p_lgu_id,me.full_name,coalesce(me.office_position,'PSWDO Emergency Operator'),'DRAFT',auth.uid()) on conflict(reporting_cycle_id,lgu_id) do update set updated_at=now() returning id into rid;
 insert into public.barangay_reports(report_id,barangay_id) select rid,id from public.barangays where lgu_id=p_lgu_id and active=true on conflict(report_id,barangay_id) do nothing;
 perform public.audit('ASSISTED_LGU_REPORT_OPENED','report',rid,rid,null,jsonb_build_object('on_behalf_of_lgu',p_lgu_id,'operator',auth.uid())); return rid; end $$;
grant execute on function public.create_assisted_lgu_report(uuid,uuid) to authenticated;

create or replace view public.relief_stock_summary as
 select i.id,i.name,i.unit,i.category,coalesce(sum(case when t.transaction_type in ('RECEIVED','ADJUSTMENT') then t.quantity when t.transaction_type='RELEASED_TO_LGU' then -t.quantity else 0 end),0) as available
 from public.relief_items i left join public.relief_transactions t on t.item_id=i.id where i.active=true group by i.id,i.name,i.unit,i.category;
grant select on public.relief_stock_summary to authenticated;
