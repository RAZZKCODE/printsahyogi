-- Admin dashboard RPCs. Every function checks private.is_admin() on the server,
-- runs in one transaction, and writes an admin_audit_logs row.
-- Plain catalog edits (plans, tools, packs, settings, announcements, tickets) go
-- straight to the tables through the existing "Admins insert/update/delete" RLS policies.

create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Dashboard numbers in one round trip.
create or replace function public.admin_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := date_trunc('day', now()) - make_interval(days => v_days - 1);
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from public.profiles),
    'users_new_period',   (select count(*) from public.profiles where created_at >= v_since),
    'users_new_today',    (select count(*) from public.profiles where created_at >= date_trunc('day', now())),
    'users_blocked',      (select count(*) from public.profiles where is_blocked),
    'users_paid',         (select count(*) from public.profiles where plan_id <> 'free' and (plan_expires_at is null or plan_expires_at > now())),
    'revenue_total',      (select coalesce(sum(amount), 0) from public.payments where status = 'paid'),
    'revenue_period',     (select coalesce(sum(amount), 0) from public.payments where status = 'paid' and paid_at >= v_since),
    'revenue_today',      (select coalesce(sum(amount), 0) from public.payments where status = 'paid' and paid_at >= date_trunc('day', now())),
    'wallet_outstanding', (select coalesce(sum(wallet_balance), 0) from public.profiles),
    'coins_outstanding',  (select coalesce(sum(coins), 0) from public.profiles),
    'usage_period',       (select coalesce(sum(quantity), 0) from public.usage_logs where created_at >= v_since),
    'tickets_open',       (select count(*) from public.support_tickets where status in ('open', 'in_progress')),
    'suggestions_new',    (select count(*) from public.feature_suggestions where status = 'new'),
    'referrals_total',    (select count(*) from public.referrals),
    'plan_breakdown', coalesce((
      select jsonb_object_agg(plan_id, n) from (
        select plan_id, count(*) n from public.profiles group by plan_id
      ) s), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'signups', coalesce(u.n, 0), 'revenue', coalesce(p.total, 0), 'usage', coalesce(l.q, 0)) order by d)
      from generate_series(v_since, date_trunc('day', now()), interval '1 day') d
      left join (select date_trunc('day', created_at) as bucket, count(*) n from public.profiles where created_at >= v_since group by 1) u on u.bucket = d
      left join (select date_trunc('day', paid_at) as bucket, sum(amount) total from public.payments where status = 'paid' and paid_at >= v_since group by 1) p on p.bucket = d
      left join (select date_trunc('day', created_at) as bucket, sum(quantity) q from public.usage_logs where created_at >= v_since group by 1) l on l.bucket = d
    ), '[]'::jsonb),
    'top_tools', coalesce((
      select jsonb_agg(jsonb_build_object('slug', tool_slug, 'count', q) order by q desc) from (
        select tool_slug, sum(quantity) q from public.usage_logs
        where created_at >= v_since and tool_slug is not null
        group by tool_slug order by q desc limit 8
      ) t), '[]'::jsonb)
  );
end;
$$;

-- Credit (positive) or debit (negative) a user's wallet.
create or replace function public.admin_adjust_wallet(p_user uuid, p_amount numeric, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_balance numeric;
  v_new numeric;
begin
  if p_amount is null or p_amount = 0 then return jsonb_build_object('ok', false, 'message', 'Enter an amount other than 0.'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'message', 'Please enter a reason.'); end if;
  select wallet_balance into v_balance from public.profiles where id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'User not found.'); end if;
  v_new := v_balance + p_amount;
  if v_new < 0 then return jsonb_build_object('ok', false, 'message', 'Balance cannot go below ₹0 (current ₹' || v_balance || ').'); end if;

  update public.profiles set wallet_balance = v_new where id = p_user;
  insert into public.wallet_transactions (user_id, direction, amount, balance_after, label, source, created_by)
  values (p_user, case when p_amount > 0 then 'credit' else 'debit' end, abs(p_amount), v_new, 'Admin: ' || trim(p_reason), 'admin_adjustment', v_admin);
  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, details)
  values (v_admin, 'wallet_adjust', 'profiles', p_user::text, jsonb_build_object('amount', p_amount, 'reason', p_reason, 'balance_after', v_new));
  return jsonb_build_object('ok', true, 'message', 'Wallet updated. New balance ₹' || v_new || '.');
end;
$$;

-- Add (positive) or remove (negative) Print Coins.
create or replace function public.admin_adjust_coins(p_user uuid, p_amount integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_coins integer;
  v_new integer;
begin
  if p_amount is null or p_amount = 0 then return jsonb_build_object('ok', false, 'message', 'Enter an amount other than 0.'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'message', 'Please enter a reason.'); end if;
  select coins into v_coins from public.profiles where id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'User not found.'); end if;
  v_new := v_coins + p_amount;
  if v_new < 0 then return jsonb_build_object('ok', false, 'message', 'Coins cannot go below 0 (current ' || v_coins || ').'); end if;

  update public.profiles set coins = v_new where id = p_user;
  insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source, created_by)
  values (p_user, case when p_amount > 0 then 'earned' else 'redeemed' end, abs(p_amount), v_new, 'Admin: ' || trim(p_reason), 'admin_adjustment', v_admin);
  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, details)
  values (v_admin, 'coins_adjust', 'profiles', p_user::text, jsonb_build_object('amount', p_amount, 'reason', p_reason, 'balance_after', v_new));
  return jsonb_build_object('ok', true, 'message', 'Coins updated. New balance ' || v_new || ' PC.');
end;
$$;

-- Give a user a plan for N days (or move them back to Free).
create or replace function public.admin_set_plan(p_user uuid, p_plan_id text, p_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_plan public.plans;
  v_days integer;
  v_expires timestamptz;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then return jsonb_build_object('ok', false, 'message', 'Plan not found.'); end if;
  if not exists (select 1 from public.profiles where id = p_user) then return jsonb_build_object('ok', false, 'message', 'User not found.'); end if;

  update public.subscriptions set status = 'cancelled' where user_id = p_user and status = 'active';
  if v_plan.period = 'free' then
    update public.profiles set plan_id = 'free', plan_expires_at = null where id = p_user;
  else
    v_days := coalesce(nullif(p_days, 0), v_plan.duration_days, 30);
    v_expires := now() + make_interval(days => v_days);
    update public.profiles set plan_id = v_plan.id, plan_expires_at = v_expires where id = p_user;
    insert into public.subscriptions (user_id, plan_id, source, expires_at) values (p_user, v_plan.id, 'admin', v_expires);
  end if;

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, details)
  values (v_admin, 'plan_set', 'profiles', p_user::text, jsonb_build_object('plan_id', p_plan_id, 'days', v_days));
  return jsonb_build_object('ok', true, 'message', case when v_plan.period = 'free' then 'User moved to the Free plan.' else v_plan.name || ' given for ' || v_days || ' days.' end);
end;
$$;

revoke execute on function private.require_admin() from public, anon, authenticated;
revoke execute on function public.admin_stats(integer) from public, anon;
revoke execute on function public.admin_adjust_wallet(uuid, numeric, text) from public, anon;
revoke execute on function public.admin_adjust_coins(uuid, integer, text) from public, anon;
revoke execute on function public.admin_set_plan(uuid, text, integer) from public, anon;
grant execute on function public.admin_stats(integer) to authenticated;
grant execute on function public.admin_adjust_wallet(uuid, numeric, text) to authenticated;
grant execute on function public.admin_adjust_coins(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_plan(uuid, text, integer) to authenticated;

-- Keep the tools table in sync with tools that are now built in code.
update public.tools set is_live = true where slug in ('suggest-a-feature', 'support');

-- Make yourself the first super admin (run once in the SQL editor, with your login email):
--   update public.profiles set role = 'super_admin' where lower(email) = lower('you@example.com');
