-- Additive. Keep v1 available for a stopped rollback to the previous Edge bundle.
begin;
alter table public.workboard_messaging_budget_policy_v1
  add column requests_per_person_day integer not null default 2500 check (requests_per_person_day between 1 and 8000),
  add column units_per_person_day integer not null default 220000 check (units_per_person_day between 304 and 300000);

create table public.workboard_messaging_actor_request_usage_v2 (
  person_id text primary key check (person_id ~ '^p_[0-9a-f]{32}$'),
  utc_day date not null,
  requests integer not null check (requests > 0),
  units integer not null check (units > 0)
);
alter table public.workboard_messaging_actor_request_usage_v2 enable row level security;
revoke all on public.workboard_messaging_actor_request_usage_v2 from public,anon,authenticated,service_role;
grant select,insert,update on public.workboard_messaging_actor_request_usage_v2 to service_role;

create function public.workboard_reserve_messaging_request_v2(p_units integer,p_person_id text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $reserve$
declare
  policy public.workboard_messaging_budget_policy_v1%rowtype;
  now_utc timestamp:=timezone('UTC',clock_timestamp());
  today date:=now_utc::date;
  retry_after integer:=greatest(1,least(3600,ceil(extract(epoch from (today+1)::timestamp-now_utc))::integer));
begin
  if p_units is null or p_units not between 1 and 304 or p_person_id is null or p_person_id !~ '^p_[0-9a-f]{32}$'
  then return jsonb_build_object('status','unavailable'); end if;
  select * into policy from public.workboard_messaging_budget_policy_v1 where singleton;
  if not found then return jsonb_build_object('status','unavailable'); end if;

  begin
    insert into public.workboard_messaging_request_usage_v1 as usage(utc_day,requests,units)
    values(today,1,p_units)
    on conflict (utc_day) do update set requests=usage.requests+1,units=usage.units+excluded.units
    where usage.requests<policy.requests_per_day and usage.units+excluded.units<=policy.units_per_day;
    if not found then return jsonb_build_object('status','limit','retryAfter',retry_after); end if;

    insert into public.workboard_messaging_actor_request_usage_v2 as usage(person_id,utc_day,requests,units)
    values(p_person_id,today,1,p_units)
    on conflict (person_id) do update
      set utc_day=excluded.utc_day,
          requests=case when usage.utc_day<excluded.utc_day then 1 else usage.requests+1 end,
          units=case when usage.utc_day<excluded.utc_day then excluded.units else usage.units+excluded.units end
    where usage.utc_day<excluded.utc_day or (usage.utc_day=excluded.utc_day
      and usage.requests<policy.requests_per_person_day and usage.units+excluded.units<=policy.units_per_person_day);
    -- Roll back the reservation against the shared budget if this actor is limited.
    if not found then raise sqlstate 'WB001'; end if;
  exception when sqlstate 'WB001' then
    return jsonb_build_object('status','limit','retryAfter',retry_after);
  end;
  return jsonb_build_object('status','ok');
end;
$reserve$;

revoke all on function public.workboard_reserve_messaging_request_v2(integer,text) from public,anon,authenticated,service_role;
grant execute on function public.workboard_reserve_messaging_request_v2(integer,text) to service_role;
commit;
