-- Additive. Apply before deploying the Edge revision that requires both RPCs.
begin;
create table public.workboard_messaging_budget_policy_v1 (
  singleton boolean primary key default true check (singleton),
  requests_per_day integer not null check (requests_per_day between 1 and 12000),
  units_per_day integer not null check (units_per_day between 304 and 600000),
  sends_per_minute integer not null check (sends_per_minute between 1 and 60),
  sends_per_day integer not null check (sends_per_day between sends_per_minute and 500)
);
insert into public.workboard_messaging_budget_policy_v1
  (requests_per_day,units_per_day,sends_per_minute,sends_per_day) values (8000,480000,20,180);

create table public.workboard_messaging_request_usage_v1 (
  utc_day date primary key,
  requests integer not null check (requests > 0),
  units integer not null check (units > 0)
);

create table public.workboard_messaging_send_usage_v1 (
  person_id text primary key check (person_id ~ '^p_[0-9a-f]{32}$'),
  utc_day date not null,
  utc_minute timestamp not null,
  daily integer not null check (daily > 0),
  burst integer not null check (burst > 0)
);

alter table public.workboard_messaging_budget_policy_v1 enable row level security;
alter table public.workboard_messaging_request_usage_v1 enable row level security;
alter table public.workboard_messaging_send_usage_v1 enable row level security;
revoke all on public.workboard_messaging_budget_policy_v1,public.workboard_messaging_request_usage_v1,public.workboard_messaging_send_usage_v1
  from public,anon,authenticated,service_role;
grant select on public.workboard_messaging_budget_policy_v1 to service_role;
grant select,insert,update on public.workboard_messaging_request_usage_v1,public.workboard_messaging_send_usage_v1 to service_role;

create function public.workboard_reserve_messaging_request_v1(p_units integer)
returns jsonb language plpgsql volatile security invoker set search_path='' as $reserve$
declare
  policy public.workboard_messaging_budget_policy_v1%rowtype;
  now_utc timestamp:=timezone('UTC',clock_timestamp());
  today date:=now_utc::date;
begin
  if p_units is null or p_units not between 1 and 304 then return jsonb_build_object('status','unavailable'); end if;
  select * into policy from public.workboard_messaging_budget_policy_v1 where singleton;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  insert into public.workboard_messaging_request_usage_v1 as usage(utc_day,requests,units)
  values(today,1,p_units)
  on conflict (utc_day) do update set requests=usage.requests+1,units=usage.units+excluded.units
  where usage.requests<policy.requests_per_day and usage.units+excluded.units<=policy.units_per_day;
  if found then return jsonb_build_object('status','ok'); end if;
  return jsonb_build_object('status','limit','retryAfter',greatest(1,least(3600,ceil(extract(epoch from (today+1)::timestamp-now_utc))::integer)));
end;
$reserve$;

create function public.workboard_reserve_messaging_send_v1(p_person_id text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $reserve$
declare
  policy public.workboard_messaging_budget_policy_v1%rowtype;
  now_utc timestamp:=timezone('UTC',clock_timestamp());
  today date:=now_utc::date;
  minute_start timestamp:=date_trunc('minute',now_utc);
  usage public.workboard_messaging_send_usage_v1%rowtype;
  retry_at timestamp;
begin
  if p_person_id is null or p_person_id !~ '^p_[0-9a-f]{32}$' then return jsonb_build_object('status','unavailable'); end if;
  select * into policy from public.workboard_messaging_budget_policy_v1 where singleton;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  insert into public.workboard_messaging_send_usage_v1 as counter(person_id,utc_day,utc_minute,daily,burst)
  values(p_person_id,today,minute_start,1,1)
  on conflict (person_id) do update
    set utc_day=greatest(counter.utc_day,excluded.utc_day),
        utc_minute=greatest(counter.utc_minute,excluded.utc_minute),
        daily=case when counter.utc_day<excluded.utc_day then 1 else counter.daily+1 end,
        burst=case when counter.utc_minute<excluded.utc_minute then 1 else counter.burst+1 end
  where (counter.utc_day<excluded.utc_day or counter.daily<policy.sends_per_day)
    and (counter.utc_minute<excluded.utc_minute or counter.burst<policy.sends_per_minute);
  if found then return jsonb_build_object('status','ok'); end if;
  select * into strict usage from public.workboard_messaging_send_usage_v1 where person_id=p_person_id;
  retry_at:=case when usage.utc_day>=today and usage.daily>=policy.sends_per_day
    then (usage.utc_day+1)::timestamp else usage.utc_minute+interval '1 minute' end;
  return jsonb_build_object('status','limit','retryAfter',greatest(1,least(3600,ceil(extract(epoch from retry_at-now_utc))::integer)));
end;
$reserve$;

revoke all on function public.workboard_reserve_messaging_request_v1(integer), public.workboard_reserve_messaging_send_v1(text)
  from public,anon,authenticated,service_role;
grant execute on function public.workboard_reserve_messaging_request_v1(integer), public.workboard_reserve_messaging_send_v1(text)
  to service_role;
commit;
