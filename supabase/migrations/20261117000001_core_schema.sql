-- PrintSathi core schema: users, plans, wallet, coins, credits, usage, referrals,
-- support, and admin tables. Money/coin balances are changed only by the server
-- (service role) or by admins; normal users can read their own rows.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Catalog tables (managed from the admin panel)
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  coin_cost integer not null default 0 check (coin_cost >= 0),
  period text not null check (period in ('free', 'month', 'year')),
  duration_days integer not null default 0 check (duration_days >= 0),
  daily_card_credits integer not null default 1 check (daily_card_credits >= 0),
  daily_bg_removal_credits integer not null default 1 check (daily_bg_removal_credits >= 0),
  unlimited_cards boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  is_popular boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.features (
  key text primary key,
  label text not null,
  category text not null check (category in ('card_crop', 'bg_removal', 'photo', 'pdf')),
  card_type text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tools (
  slug text primary key,
  title text not null,
  subtitle text,
  group_name text not null,
  feature_key text references public.features(key) on delete set null,
  is_live boolean not null default false,
  is_premium boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topup_packs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  pay_amount numeric(10,2) not null check (pay_amount > 0),
  credit_amount numeric(10,2) not null check (credit_amount > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null references public.features(key) on delete cascade,
  credits integer not null check (credits > 0),
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index credit_packs_feature_key_idx on public.credit_packs(feature_key);
create index tools_feature_key_idx on public.tools(feature_key);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  phone_verified boolean not null default false,
  avatar_url text,
  auth_provider text not null default 'email',
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  plan_id text not null default 'free' references public.plans(id),
  plan_expires_at timestamptz,
  card_rate numeric(10,2) not null default 50 check (card_rate >= 0),
  wallet_balance numeric(12,2) not null default 0 check (wallet_balance >= 0),
  coins integer not null default 0 check (coins >= 0),
  referral_code text not null unique,
  referred_by uuid references public.profiles(id) on delete set null,
  is_blocked boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_plan_id_idx on public.profiles(plan_id);
create index profiles_referred_by_idx on public.profiles(referred_by);
create index profiles_email_idx on public.profiles(lower(email));

-- ---------------------------------------------------------------------------
-- Money, coins, plans
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('wallet_topup', 'plan', 'credits')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'INR',
  wallet_credit numeric(10,2) not null default 0,
  plan_id text references public.plans(id),
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_user_id_idx on public.payments(user_id, created_at desc);
create index payments_plan_id_idx on public.payments(plan_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  source text not null check (source in ('coins', 'payment', 'admin', 'promo')),
  payment_id uuid references public.payments(id) on delete set null,
  coins_spent integer not null default 0,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions(user_id, created_at desc);
create index subscriptions_plan_id_idx on public.subscriptions(plan_id);
create index subscriptions_payment_id_idx on public.subscriptions(payment_id);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('credit', 'debit')),
  amount numeric(10,2) not null check (amount > 0),
  balance_after numeric(12,2),
  label text not null,
  source text not null check (source in ('topup', 'credit_purchase', 'plan', 'refund', 'bonus', 'admin_adjustment')),
  payment_id uuid references public.payments(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_id_idx on public.wallet_transactions(user_id, created_at desc);
create index wallet_transactions_payment_id_idx on public.wallet_transactions(payment_id);
create index wallet_transactions_created_by_idx on public.wallet_transactions(created_by);

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('earned', 'redeemed')),
  amount integer not null check (amount > 0),
  balance_after integer,
  label text not null,
  source text not null check (source in ('referral_join', 'referral_upgrade', 'plan_redeem', 'bonus', 'admin_adjustment')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index coin_transactions_user_id_idx on public.coin_transactions(user_id, created_at desc);
create index coin_transactions_created_by_idx on public.coin_transactions(created_by);

create table public.user_feature_credits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null references public.features(key) on delete cascade,
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);
create index user_feature_credits_feature_key_idx on public.user_feature_credits(feature_key);

create table public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text references public.features(key) on delete set null,
  tool_slug text references public.tools(slug) on delete set null,
  card_type text,
  quantity integer not null default 1 check (quantity > 0),
  credits_used integer not null default 1 check (credits_used >= 0),
  created_at timestamptz not null default now()
);
create index usage_logs_user_created_idx on public.usage_logs(user_id, created_at desc);
create index usage_logs_user_feature_idx on public.usage_logs(user_id, feature_key, created_at desc);
create index usage_logs_feature_key_idx on public.usage_logs(feature_key);
create index usage_logs_tool_slug_idx on public.usage_logs(tool_slug);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null,
  join_coins_awarded integer not null default 0,
  upgraded boolean not null default false,
  upgrade_coins_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  upgraded_at timestamptz,
  check (referrer_id <> referred_id)
);
create index referrals_referrer_id_idx on public.referrals(referrer_id);

-- ---------------------------------------------------------------------------
-- Feedback and support
-- ---------------------------------------------------------------------------

create table public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 200),
  description text check (char_length(description) <= 5000),
  status text not null default 'new' check (status in ('new', 'under_review', 'planned', 'done', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feature_suggestions_user_id_idx on public.feature_suggestions(user_id);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 200),
  category text not null default 'general' check (category in ('general', 'payment', 'plan', 'bug', 'account')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_id_idx on public.support_tickets(user_id, created_at desc);
create index support_tickets_assigned_to_idx on public.support_tickets(assigned_to);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  is_staff boolean not null default false,
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_id_idx on public.support_messages(ticket_id, created_at);
create index support_messages_sender_id_idx on public.support_messages(sender_id);

-- ---------------------------------------------------------------------------
-- Admin tables
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index app_settings_updated_by_idx on public.app_settings(updated_by);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  kind text not null default 'banner' check (kind in ('banner', 'popup')),
  cta_label text,
  cta_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_created_by_idx on public.announcements(created_by);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_admin_id_idx on public.admin_audit_logs(admin_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions and triggers
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'super_admin')
      and not is_blocked
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'plans', 'features', 'tools', 'topup_packs', 'credit_packs', 'profiles',
    'feature_suggestions', 'support_tickets', 'app_settings', 'announcements'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t
    );
  end loop;
end;
$$;

create or replace function private.generate_referral_code()
returns text
language plpgsql
set search_path = ''
as $$
declare v_code text;
begin
  loop
    v_code := 'PS' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Normal users may only change their own name, phone, avatar and card rate.
-- Role, plan, balances, coins, blocking etc. are reverted unless the change
-- comes from an admin or from the server (service role, where auth.uid() is null).
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
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

create trigger protect_profile_columns
before update on public.profiles
for each row execute function private.protect_profile_columns();

-- Create a profile for every new auth user and apply an optional referral code
-- passed in sign-up metadata as { "referral_code": "PSXXXX" }.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_ref_code text := upper(trim(coalesce(v_meta->>'referral_code', '')));
  v_referrer uuid;
  v_join_coins integer;
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url, auth_provider, referral_code)
  values (
    new.id,
    coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''), ''),
    new.email,
    coalesce(nullif(new.phone, ''), nullif(v_meta->>'phone', '')),
    nullif(v_meta->>'avatar_url', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    private.generate_referral_code()
  );

  if v_ref_code <> '' then
    select id into v_referrer from public.profiles where referral_code = v_ref_code and id <> new.id;
    if v_referrer is not null then
      select (value #>> '{}')::integer into v_join_coins
      from public.app_settings where key = 'referral_join_coins';
      v_join_coins := coalesce(v_join_coins, 10);

      update public.profiles set referred_by = v_referrer, coins = coins + v_join_coins where id = new.id;
      insert into public.referrals (referrer_id, referred_id, code, join_coins_awarded)
      values (v_referrer, new.id, v_ref_code, v_join_coins);
      insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source)
      values (new.id, 'earned', v_join_coins, v_join_coins, 'Referral code ' || v_ref_code || ' claimed', 'referral_join');
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Functions in the private schema are not exposed through the API.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
