-- Account actions that move coins or wallet money. They run as security definer
-- functions so prices and balances are checked on the server, never trusted from the browser.

alter table public.referrals add column referred_name text;

-- Let trusted functions change protected profile columns by setting a transaction-local flag.
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or current_setting('app.trusted_profile_write', true) = 'on' then
    return new;
  end if;

  if not private.is_admin() then
    new.role := old.role;
    new.plan_id := old.plan_id;
    new.plan_expires_at := old.plan_expires_at;
    new.wallet_balance := old.wallet_balance;
    new.coins := old.coins;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.is_blocked := old.is_blocked;
    new.phone_verified := old.phone_verified;
    new.email := old.email;
    new.auth_provider := old.auth_provider;
  elsif new.role is distinct from old.role and not exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'super_admin'
  ) then
    raise exception 'Only a super admin can change roles';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function private.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_settings where key = p_key), p_default);
$$;

-- Apply a referral code for a user. Returns null on success or an error message.
create or replace function private.apply_referral(p_user uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_referrer uuid;
  v_name text;
  v_coins integer := private.setting_int('referral_join_coins', 10);
  v_balance integer;
begin
  if v_code !~ '^PS[A-Z0-9]{4,10}$' then return 'Enter a valid code, e.g. PS8X2K.'; end if;
  if exists (select 1 from public.referrals where referred_id = p_user) then return 'You have already claimed a referral code.'; end if;
  select id into v_referrer from public.profiles where referral_code = v_code;
  if v_referrer is null then return 'This referral code does not exist.'; end if;
  if v_referrer = p_user then return 'You can''t use your own referral code.'; end if;

  perform set_config('app.trusted_profile_write', 'on', true);
  update public.profiles set referred_by = v_referrer, coins = coins + v_coins
  where id = p_user returning coins, full_name into v_balance, v_name;

  insert into public.referrals (referrer_id, referred_id, code, join_coins_awarded, referred_name)
  values (v_referrer, p_user, v_code, v_coins, nullif(split_part(coalesce(v_name, ''), ' ', 1), ''));
  insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source)
  values (p_user, 'earned', v_coins, v_balance, 'Referral code ' || v_code || ' claimed', 'referral_join');
  return null;
end;
$$;

-- First plan of a referred user rewards the referrer once.
create or replace function private.reward_referrer(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals;
  v_bonus integer := private.setting_int('referral_upgrade_coins', 30);
  v_balance integer;
begin
  select * into v_ref from public.referrals where referred_id = p_user and not upgraded for update;
  if not found then return; end if;

  perform set_config('app.trusted_profile_write', 'on', true);
  update public.referrals set upgraded = true, upgrade_coins_awarded = v_bonus, upgraded_at = now() where id = v_ref.id;
  update public.profiles set coins = coins + v_bonus where id = v_ref.referrer_id returning coins into v_balance;
  insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source)
  values (v_ref.referrer_id, 'earned', v_bonus, v_balance, 'Referral bonus: ' || coalesce(v_ref.referred_name, 'a friend') || ' upgraded', 'referral_upgrade');
end;
$$;

-- New users: create profile, then apply an optional referral code from sign-up metadata.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url, auth_provider, referral_code, card_rate)
  values (
    new.id,
    coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''), ''),
    new.email,
    coalesce(nullif(new.phone, ''), nullif(v_meta->>'phone', '')),
    coalesce(nullif(v_meta->>'avatar_url', ''), nullif(v_meta->>'picture', '')),
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    private.generate_referral_code(),
    private.setting_int('default_card_rate', 50)
  );

  if coalesce(v_meta->>'referral_code', '') <> '' then
    perform private.apply_referral(new.id, v_meta->>'referral_code');
  end if;
  return new;
end;
$$;

-- RPC: claim a friend's referral code after sign-up.
create or replace function public.claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_error text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please log in first.'); end if;
  v_error := private.apply_referral(v_uid, p_code);
  if v_error is not null then return jsonb_build_object('ok', false, 'message', v_error); end if;
  return jsonb_build_object('ok', true, 'message', private.setting_int('referral_join_coins', 10) || ' Print Coins added to your wallet!');
end;
$$;

-- RPC: redeem a membership plan with Print Coins.
create or replace function public.redeem_plan(p_plan_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_plan public.plans;
  v_coins integer;
  v_expires timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please log in first.'); end if;
  select * into v_plan from public.plans where id = p_plan_id and is_active and period <> 'free';
  if not found then return jsonb_build_object('ok', false, 'message', 'Plan not found.'); end if;

  select coins into v_coins from public.profiles where id = v_uid for update;
  if v_coins < v_plan.coin_cost then
    return jsonb_build_object('ok', false, 'message', 'You need ' || (v_plan.coin_cost - v_coins) || ' more Print Coins to redeem ' || v_plan.name || '.');
  end if;

  v_expires := now() + make_interval(days => v_plan.duration_days);
  perform set_config('app.trusted_profile_write', 'on', true);
  update public.profiles
  set coins = coins - v_plan.coin_cost, plan_id = v_plan.id, plan_expires_at = v_expires
  where id = v_uid;

  update public.subscriptions set status = 'cancelled' where user_id = v_uid and status = 'active';
  insert into public.subscriptions (user_id, plan_id, source, coins_spent, expires_at)
  values (v_uid, v_plan.id, 'coins', v_plan.coin_cost, v_expires);
  insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source)
  values (v_uid, 'redeemed', v_plan.coin_cost, v_coins - v_plan.coin_cost, 'Redeemed ' || v_plan.name || ' membership', 'plan_redeem');

  perform private.reward_referrer(v_uid);
  return jsonb_build_object('ok', true, 'message', v_plan.name || ' activated for ' || v_plan.duration_days || ' days.');
end;
$$;

-- RPC: buy extra credits for a feature from the wallet balance.
create or replace function public.buy_credit_pack(p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.credit_packs;
  v_label text;
  v_balance numeric;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Please log in first.'); end if;
  select * into v_pack from public.credit_packs where id = p_pack_id and is_active;
  if not found then return jsonb_build_object('ok', false, 'message', 'Credit pack not found.'); end if;
  select label into v_label from public.features where key = v_pack.feature_key;

  select wallet_balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < v_pack.price then
    return jsonb_build_object('ok', false, 'message', 'Wallet balance is low. Top up at least ₹' || trim(to_char(v_pack.price - v_balance, 'FM999999990.##')) || '.');
  end if;

  perform set_config('app.trusted_profile_write', 'on', true);
  update public.profiles set wallet_balance = wallet_balance - v_pack.price where id = v_uid;
  insert into public.user_feature_credits (user_id, feature_key, bonus_credits)
  values (v_uid, v_pack.feature_key, v_pack.credits)
  on conflict (user_id, feature_key)
  do update set bonus_credits = public.user_feature_credits.bonus_credits + excluded.bonus_credits, updated_at = now();
  insert into public.wallet_transactions (user_id, direction, amount, balance_after, label, source)
  values (v_uid, 'debit', v_pack.price, v_balance - v_pack.price, v_pack.credits || ' credits · ' || v_label, 'credit_purchase');

  return jsonb_build_object('ok', true, 'message', v_pack.credits || ' credits added to ' || v_label || '.');
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

revoke execute on function public.claim_referral(text) from public, anon;
revoke execute on function public.redeem_plan(text) from public, anon;
revoke execute on function public.buy_credit_pack(uuid) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.redeem_plan(text) to authenticated;
grant execute on function public.buy_credit_pack(uuid) to authenticated;

-- Credit packs shown in "Add Credits" (same prices the UI used before).
insert into public.credit_packs (feature_key, credits, price, sort_order)
select f.key, p.credits, p.price, p.sort_order
from public.features f
cross join (values (5, 10, 1), (15, 25, 2), (40, 59, 3)) as p(credits, price, sort_order);
