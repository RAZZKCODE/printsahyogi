-- Row level security: every table is locked down. Users see only their own rows,
-- catalog tables are publicly readable when active, admins can manage everything.

do $$
declare t text;
begin
  foreach t in array array[
    'plans', 'features', 'tools', 'topup_packs', 'credit_packs', 'profiles', 'payments',
    'subscriptions', 'wallet_transactions', 'coin_transactions', 'user_feature_credits',
    'usage_logs', 'referrals', 'feature_suggestions', 'support_tickets', 'support_messages',
    'app_settings', 'announcements', 'admin_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Admin write access (insert / update / delete) on every table except the audit log,
-- which admins may only append to.
do $$
declare t text;
begin
  foreach t in array array[
    'plans', 'features', 'tools', 'topup_packs', 'credit_packs', 'profiles', 'payments',
    'subscriptions', 'wallet_transactions', 'coin_transactions', 'user_feature_credits',
    'usage_logs', 'referrals', 'feature_suggestions', 'support_tickets', 'support_messages',
    'app_settings', 'announcements'
  ] loop
    execute format('create policy "Admins insert" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "Admins delete" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- Catalog: anyone can read active rows, admins read all.
do $$
declare t text;
begin
  foreach t in array array['plans', 'features', 'topup_packs', 'credit_packs'] loop
    execute format('create policy "Read active rows" on public.%I for select to anon, authenticated using (is_active or (select private.is_admin()))', t);
  end loop;
end;
$$;

create policy "Read tools" on public.tools
  for select to anon, authenticated using (true);

create policy "Read live announcements" on public.announcements
  for select to anon, authenticated
  using (
    (is_active and starts_at <= now() and (ends_at is null or ends_at > now()))
    or (select private.is_admin())
  );

create policy "Read public settings" on public.app_settings
  for select to anon, authenticated using (is_public or (select private.is_admin()));

-- Profiles
create policy "Read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Own-row read access for user data tables
do $$
declare t text;
begin
  foreach t in array array[
    'payments', 'subscriptions', 'wallet_transactions', 'coin_transactions',
    'user_feature_credits', 'usage_logs', 'feature_suggestions', 'support_tickets'
  ] loop
    execute format('create policy "Read own rows" on public.%I for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()))', t);
  end loop;
end;
$$;

create policy "Read own referrals" on public.referrals
  for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()) or (select private.is_admin()));

-- Things users can create themselves
create policy "Log own usage" on public.usage_logs
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "Suggest a feature" on public.feature_suggestions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and admin_note is null);

create policy "Open own ticket" on public.support_tickets
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and assigned_to is null);

create policy "Read ticket messages" on public.support_messages
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))
  );

create policy "Reply on own ticket" on public.support_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and not is_staff
    and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = (select auth.uid()))
  );

-- Audit log: admins read and append, nobody edits.
create policy "Admins read audit log" on public.admin_audit_logs
  for select to authenticated using ((select private.is_admin()));

create policy "Admins append audit log" on public.admin_audit_logs
  for insert to authenticated
  with check ((select private.is_admin()) and admin_id = (select auth.uid()));
