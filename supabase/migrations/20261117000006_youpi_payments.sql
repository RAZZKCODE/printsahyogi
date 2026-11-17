-- YouPI PG (self-hosted UPI gateway) wallet top-ups.
-- Flow: the Next.js server creates a `payments` row (create_topup_payment), asks YouPI for a
-- checkout URL, and later a signed YouPI webhook marks the row paid and credits the wallet
-- (complete_topup_payment). Every function here is callable only with the service role key.

alter table public.payments alter column provider set default 'youpi';

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('created', 'observed', 'review', 'paid', 'failed', 'expired', 'cancelled', 'refunded'));

alter table public.payments add column if not exists utr text;
alter table public.payments add column if not exists checkout_url text;
alter table public.payments add column if not exists updated_at timestamptz not null default now();

create trigger set_updated_at before update on public.payments
for each row execute function private.set_updated_at();

-- Every webhook delivery we accepted (signature valid), for audit and de-duplication.
create table public.payment_webhook_events (
  delivery_id text primary key,
  provider text not null default 'youpi',
  event text not null,
  order_id text,
  payment_id uuid references public.payments(id) on delete set null,
  outcome text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index payment_webhook_events_payment_id_idx on public.payment_webhook_events(payment_id);
alter table public.payment_webhook_events enable row level security;
create policy "Admins read webhook events" on public.payment_webhook_events
  for select to authenticated using ((select private.is_admin()));

-- Create a pending wallet top-up for a user. The amount always comes from `topup_packs`.
create or replace function public.create_topup_payment(p_user uuid, p_pack_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.topup_packs;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_user and not is_blocked) then
    return jsonb_build_object('ok', false, 'message', 'Account not found or blocked.');
  end if;
  select * into v_pack from public.topup_packs where id = p_pack_id and is_active;
  if not found then return jsonb_build_object('ok', false, 'message', 'Top-up pack not found.'); end if;

  insert into public.payments (user_id, purpose, amount, wallet_credit, provider, status, metadata)
  values (p_user, 'wallet_topup', v_pack.pay_amount, v_pack.credit_amount, 'youpi', 'created',
          jsonb_build_object('pack_id', v_pack.id, 'pack_label', v_pack.label))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'payment_id', v_id, 'amount', v_pack.pay_amount, 'wallet_credit', v_pack.credit_amount);
end;
$$;

-- Mark a verified, settled payment as paid and credit the wallet. Safe to call more than once.
create or replace function public.complete_topup_payment(p_payment_id uuid, p_amount_paise bigint, p_utr text, p_provider_payment_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_balance numeric;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then return jsonb_build_object('ok', false, 'outcome', 'unknown_order'); end if;
  if v_payment.status = 'paid' then return jsonb_build_object('ok', true, 'outcome', 'already_paid'); end if;
  if v_payment.status = 'refunded' then return jsonb_build_object('ok', false, 'outcome', 'refunded'); end if;
  if round(v_payment.amount * 100)::bigint <> p_amount_paise then
    update public.payments set status = 'review',
      metadata = metadata || jsonb_build_object('amount_mismatch_paise', p_amount_paise)
    where id = p_payment_id;
    return jsonb_build_object('ok', false, 'outcome', 'amount_mismatch');
  end if;
  if p_utr is not null and exists (select 1 from public.payments where utr = p_utr and id <> p_payment_id) then
    update public.payments set status = 'review',
      metadata = metadata || jsonb_build_object('duplicate_utr', p_utr)
    where id = p_payment_id;
    return jsonb_build_object('ok', false, 'outcome', 'duplicate_utr');
  end if;

  update public.payments
     set status = 'paid', paid_at = now(), utr = p_utr,
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id)
   where id = p_payment_id;

  if v_payment.purpose = 'wallet_topup' then
    perform set_config('app.trusted_profile_write', 'on', true);
    update public.profiles set wallet_balance = wallet_balance + v_payment.wallet_credit
     where id = v_payment.user_id
    returning wallet_balance into v_balance;
    insert into public.wallet_transactions (user_id, direction, amount, balance_after, label, source, payment_id)
    values (v_payment.user_id, 'credit', v_payment.wallet_credit, v_balance,
            'Wallet top-up via UPI' || coalesce(' · UTR ' || p_utr, ''), 'topup', v_payment.id);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$$;

revoke execute on function public.create_topup_payment(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.complete_topup_payment(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.create_topup_payment(uuid, uuid) to service_role;
grant execute on function public.complete_topup_payment(uuid, bigint, text, text) to service_role;
