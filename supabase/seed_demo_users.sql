-- Demo users for testing the app and admin panel. Safe to re-run: existing demo users are removed first.
-- All demo accounts use the password Demo@12345 and emails on the reserved .test domain (no real mail is sent).

delete from auth.users where email like '%@demo.printsathi.test';

do $$
declare
  v_users jsonb := '[
    {"email":"amit.free@demo.printsathi.test",      "name":"Amit Sharma",   "phone":"9876500001", "plan":"free",            "days":0,   "coins":12,  "wallet":0,   "rate":40,  "city":"Lucknow"},
    {"email":"priya.pro@demo.printsathi.test",      "name":"Priya Verma",   "phone":"9876500002", "plan":"pro",             "days":30,  "coins":45,  "wallet":60,  "rate":50,  "city":"Kanpur"},
    {"email":"rahul.proplus@demo.printsathi.test",  "name":"Rahul Yadav",   "phone":"9876500003", "plan":"pro-plus",        "days":30,  "coins":120, "wallet":149, "rate":50,  "city":"Varanasi"},
    {"email":"sunita.ultra@demo.printsathi.test",   "name":"Sunita Gupta",  "phone":"9876500004", "plan":"ultra",           "days":30,  "coins":260, "wallet":320, "rate":60,  "city":"Patna"},
    {"email":"vikas.yearly@demo.printsathi.test",   "name":"Vikas Singh",   "phone":"9876500005", "plan":"pro-yearly",      "days":365, "coins":80,  "wallet":95,  "rate":30,  "city":"Jaipur"},
    {"email":"neha.plusyearly@demo.printsathi.test","name":"Neha Kushwaha", "phone":"9876500006", "plan":"pro-plus-yearly", "days":365, "coins":540, "wallet":510, "rate":50,  "city":"Bhopal"},
    {"email":"rohit.expired@demo.printsathi.test",  "name":"Rohit Patel",   "phone":"9876500007", "plan":"pro",             "days":-5,  "coins":5,   "wallet":10,  "rate":50,  "city":"Indore"},
    {"email":"kiran.blocked@demo.printsathi.test",  "name":"Kiran Joshi",   "phone":"9876500008", "plan":"free",            "days":0,   "coins":0,   "wallet":0,   "rate":50,  "city":"Agra"},
    {"email":"demo.admin@demo.printsathi.test",     "name":"Demo Admin",    "phone":"9876500009", "plan":"ultra",           "days":30,  "coins":0,   "wallet":0,   "rate":50,  "city":"Delhi"}
  ]';
  u jsonb;
  v_id uuid;
  v_plan public.plans;
  v_payment uuid;
  v_card_types text[] := array['Aadhaar Card','PAN Card','Ayushman Card','Voter ID Card','e-Shram Card','ABHA Card','Health Card (PHC)','Ration Card','MahaSarathi Card'];
  v_feature_keys text[] := array['aadhaar_crop','pan_crop','ayushman_crop','voter_crop','eshram_crop','abha_crop','phc_crop','ration_crop','maha_crop'];
  v_volume integer;
  i integer;
  d integer;
  n integer;
  k integer;
begin
  perform set_config('app.trusted_profile_write', 'on', true);

  for u in select * from jsonb_array_elements(v_users) loop
    v_id := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u->>'email',
      extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
      jsonb_build_object('full_name', u->>'name', 'phone', u->>'phone'), '{"provider":"email","providers":["email"]}',
      now() - (random() * 90 + 20) * interval '1 day', now(), now() - random() * interval '3 days', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', u->>'email', 'email_verified', true), 'email', now(), now(), now());

    select * into v_plan from public.plans where id = u->>'plan';

    update public.profiles set
      phone_verified = (u->>'phone') is not null,
      plan_id = v_plan.id,
      plan_expires_at = case when v_plan.id = 'free' then null else now() + ((u->>'days')::int) * interval '1 day' end,
      coins = (u->>'coins')::int,
      wallet_balance = (u->>'wallet')::numeric,
      card_rate = (u->>'rate')::numeric,
      role = case when u->>'email' like 'demo.admin@%' then 'admin' else 'user' end,
      is_blocked = u->>'email' like 'kiran.blocked@%',
      created_at = (select created_at from auth.users where id = v_id),
      last_seen_at = now() - random() * interval '2 days'
    where id = v_id;

    -- Paid plan: payment + subscription + referral-ready history
    if v_plan.id <> 'free' then
      insert into public.payments (user_id, purpose, amount, plan_id, provider_order_id, provider_payment_id, status, created_at, paid_at)
      values (v_id, 'plan', v_plan.price, v_plan.id, 'order_demo_' || substr(v_id::text, 1, 8), 'pay_demo_' || substr(v_id::text, 1, 8), 'paid',
              now() - (v_plan.duration_days - (u->>'days')::int) * interval '1 day', now() - (v_plan.duration_days - (u->>'days')::int) * interval '1 day')
      returning id into v_payment;
      insert into public.subscriptions (user_id, plan_id, source, payment_id, status, starts_at, expires_at)
      values (v_id, v_plan.id, 'payment', v_payment,
              case when (u->>'days')::int < 0 then 'expired' else 'active' end,
              now() - (v_plan.duration_days - (u->>'days')::int) * interval '1 day',
              now() + ((u->>'days')::int) * interval '1 day');
    end if;

    -- Wallet: a top-up and (if money left over) a credit purchase
    if (u->>'wallet')::numeric > 0 then
      insert into public.payments (user_id, purpose, amount, wallet_credit, provider_order_id, provider_payment_id, status, created_at, paid_at)
      values (v_id, 'wallet_topup', 99, 109, 'order_topup_' || substr(v_id::text, 1, 8), 'pay_topup_' || substr(v_id::text, 1, 8), 'paid', now() - interval '12 days', now() - interval '12 days')
      returning id into v_payment;
      insert into public.wallet_transactions (user_id, direction, amount, balance_after, label, source, payment_id, created_at)
      values (v_id, 'credit', 109, 109, 'Wallet top up (₹10 bonus)', 'topup', v_payment, now() - interval '12 days'),
             (v_id, 'debit', 25, 84, '15 credits · Aadhar Auto Crop', 'credit_purchase', null, now() - interval '6 days');
      insert into public.user_feature_credits (user_id, feature_key, bonus_credits) values (v_id, 'aadhaar_crop', 15);
    end if;

    -- Coins history
    if (u->>'coins')::int > 0 then
      insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source, created_at)
      values (v_id, 'earned', (u->>'coins')::int, (u->>'coins')::int, 'Welcome bonus', 'bonus', now() - interval '15 days');
    end if;

    -- Card prints over the last 60 days (heavier for bigger plans)
    v_volume := case v_plan.id when 'free' then 1 when 'pro' then 3 when 'pro-plus' then 6 when 'pro-yearly' then 5 when 'pro-plus-yearly' then 8 else 10 end;
    if u->>'email' not like 'kiran.blocked@%' and u->>'email' not like 'demo.admin@%' then
      for d in 0..59 loop
        if random() < 0.8 then
          n := floor(random() * v_volume * 2)::int;
          for i in 1..n loop
            k := 1 + floor(power(random(), 2) * 9)::int; -- Aadhaar most common
            insert into public.usage_logs (user_id, feature_key, tool_slug, card_type, quantity, credits_used, created_at)
            values (v_id, v_feature_keys[k], case when k = 1 then 'aadhaar-crop' else null end, v_card_types[k], 1, 1,
                    date_trunc('day', now()) - d * interval '1 day' + (9 + random() * 10) * interval '1 hour');
          end loop;
        end if;
      end loop;
      -- a few background removals today
      insert into public.usage_logs (user_id, feature_key, tool_slug, quantity, credits_used, created_at)
      select v_id, 'bg_removal', 'passport-photo', 1, 1, now() - g * interval '20 minutes' from generate_series(1, least(v_volume, 3)) g;
    end if;
  end loop;

  -- Referrals: Neha referred Priya (upgraded) and Amit (pending); Sunita referred Rahul (upgraded)
  insert into public.referrals (referrer_id, referred_id, code, join_coins_awarded, upgraded, upgrade_coins_awarded, referred_name, created_at, upgraded_at)
  select r.id, f.id, r.referral_code, 10, x.upgraded, case when x.upgraded then 30 else 0 end, split_part(f.full_name, ' ', 1), now() - interval '40 days', case when x.upgraded then now() - interval '30 days' end
  from (values ('neha.plusyearly@', 'priya.pro@', true), ('neha.plusyearly@', 'amit.free@', false), ('sunita.ultra@', 'rahul.proplus@', true)) as x(referrer, friend, upgraded)
  join public.profiles r on r.email like x.referrer || '%'
  join public.profiles f on f.email like x.friend || '%';
  update public.profiles f set referred_by = r.referrer_id from public.referrals r where r.referred_id = f.id and f.email like '%@demo.printsathi.test';
  insert into public.coin_transactions (user_id, direction, amount, balance_after, label, source, created_at)
  select r.referrer_id, 'earned', 30, null, 'Referral bonus: ' || r.referred_name || ' upgraded', 'referral_upgrade', r.upgraded_at
  from public.referrals r join public.profiles p on p.id = r.referrer_id where r.upgraded and p.email like '%@demo.printsathi.test';

  -- Support and feedback
  insert into public.support_tickets (user_id, subject, category, status, priority, created_at)
  select id, 'Aadhaar crop me photo blur aa rahi hai', 'bug', 'open', 'high', now() - interval '2 days' from public.profiles where email like 'rahul.proplus@%';
  insert into public.support_tickets (user_id, subject, category, status, priority, created_at)
  select id, 'Payment ho gaya par plan active nahi hua', 'payment', 'resolved', 'normal', now() - interval '9 days' from public.profiles where email like 'priya.pro@%';
  insert into public.support_messages (ticket_id, sender_id, is_staff, message, created_at)
  select t.id, t.user_id, false, 'Print karte waqt photo blur ho jaati hai, kya resolution badha sakte hain?', t.created_at
  from public.support_tickets t join public.profiles p on p.id = t.user_id where p.email like '%@demo.printsathi.test';
  insert into public.feature_suggestions (user_id, title, description, status, created_at)
  select id, 'Driving licence crop tool', 'DL card ka auto crop bhi add kar do please.', 'new', now() - interval '3 days' from public.profiles where email like 'sunita.ultra@%';
  insert into public.feature_suggestions (user_id, title, description, status, created_at)
  select id, 'Bulk passport photo', 'Ek saath 10 logo ki passport photo sheet.', 'planned', now() - interval '20 days' from public.profiles where email like 'vikas.yearly@%';
end;
$$;
