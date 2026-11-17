-- Seed data mirroring the current app constants
-- (src/tools/account/mock-store.ts and src/lib/navigation.ts).

insert into public.plans (id, name, price, coin_cost, period, duration_days, daily_card_credits, daily_bg_removal_credits, unlimited_cards, is_popular, sort_order, features) values
  ('free', 'Free', 0, 0, 'free', 0, 1, 1, false, false, 0, '["1 Credit / Day per Card", "1 Credit / Day on Background removal"]'),
  ('pro', 'Pro', 69, 69, 'month', 30, 10, 10, false, false, 1, '["10 Credits / Day per Card — 90 Total", "10 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"]'),
  ('pro-plus', 'Pro Plus', 99, 99, 'month', 30, 30, 30, false, true, 2, '["30 Credits / Day per Card — 270 Total", "30 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"]'),
  ('ultra', 'Ultra', 149, 149, 'month', 30, 999, 40, true, false, 3, '["Unlimited Credits / Day on All Cards", "40 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"]'),
  ('pro-yearly', 'Pro Yearly', 599, 599, 'year', 365, 20, 20, false, false, 4, '["20 Credits / Day per Card — 180 Total", "20 Credits / Day on Background Removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"]'),
  ('pro-plus-yearly', 'Pro Plus Yearly', 899, 899, 'year', 365, 40, 40, false, false, 5, '["40 Credits / Day per Card — 360 Total", "40 Credits / Day on Background removal", "Zero ads — faster workflow, no distractions", "Access to All Premium Features"]');

insert into public.features (key, label, category, card_type, sort_order) values
  ('bg_removal',    'Background Removal', 'bg_removal', null,                0),
  ('aadhaar_crop',  'Aadhar Auto Crop',   'card_crop',  'Aadhaar Card',      1),
  ('ayushman_crop', 'Ayushman Auto Crop', 'card_crop',  'Ayushman Card',     2),
  ('pan_crop',      'Pan Auto Crop',      'card_crop',  'PAN Card',          3),
  ('phc_crop',      'Phc Auto Crop',      'card_crop',  'Health Card (PHC)', 4),
  ('voter_crop',    'Voter Auto Crop',    'card_crop',  'Voter ID Card',     5),
  ('eshram_crop',   'Eshram Auto Crop',   'card_crop',  'e-Shram Card',      6),
  ('abha_crop',     'Abha Auto Crop',     'card_crop',  'ABHA Card',         7),
  ('ration_crop',   'Ration Auto Crop',   'card_crop',  'Ration Card',       8),
  ('maha_crop',     'Maha Auto Crop',     'card_crop',  'MahaSarathi Card',  9);

insert into public.tools (slug, title, subtitle, group_name, feature_key, is_live, sort_order) values
  ('collage', 'Collage', null, 'PHOTO TOOLS', null, true, 1),
  ('compress-image', 'Compress Image', null, 'PHOTO TOOLS', null, false, 2),
  ('passport-photo', 'Passport photo', null, 'PHOTO TOOLS', null, true, 3),
  ('postcard-photo', 'Postcard photo', null, 'PHOTO TOOLS', null, true, 4),
  ('pan-card-resizer', 'Pan Card Resizer', null, 'PHOTO TOOLS', null, true, 5),
  ('aadhaar-crop', 'Aadhaar crop', null, 'CARD CROP & PRINT', 'aadhaar_crop', true, 10),
  ('aadhaar-crop-a4-double-side-glossy', 'Aadhaar crop (A4 Double-side-glossy)', 'A4 · Double-side glossy', 'CARD CROP & PRINT', 'aadhaar_crop', true, 11),
  ('ayushman-crop', 'Ayushman crop', null, 'CARD CROP & PRINT', 'ayushman_crop', false, 12),
  ('abha-card-crop', 'Abha card crop', null, 'CARD CROP & PRINT', 'abha_crop', false, 13),
  ('e-shram-card-crop', 'E Shram card crop', null, 'CARD CROP & PRINT', 'eshram_crop', false, 14),
  ('id-card-crop', 'ID Card Crop', null, 'CARD CROP & PRINT', null, false, 15),
  ('mahasarathi-card', 'MahaSarathi Card', null, 'CARD CROP & PRINT', 'maha_crop', false, 16),
  ('pan-card-crop', 'Pan card crop', null, 'CARD CROP & PRINT', 'pan_crop', false, 17),
  ('punjab-health-card', 'Punjab health Card', null, 'CARD CROP & PRINT', 'phc_crop', false, 18),
  ('multi-card-print', 'Multi Card Print', null, 'CARD CROP & PRINT', null, false, 19),
  ('ration-card-crop', 'Ration Card crop', null, 'CARD CROP & PRINT', 'ration_crop', false, 20),
  ('voter-card-crop', 'Voter card crop', null, 'CARD CROP & PRINT', 'voter_crop', false, 21),
  ('aadhaar-printout', 'Aadhaar (printout)', null, 'PRINT & PDF', null, false, 30),
  ('crop-pdf-to-image', 'Crop PDF to Image', null, 'PRINT & PDF', null, false, 31),
  ('pdf-image-extractor', 'PDF Image Extractor', null, 'PRINT & PDF', null, false, 32),
  ('card-dashboard', 'Card Dashboard', null, 'MORE', null, true, 40),
  ('plans', 'Plans', null, 'MORE', null, false, 41),
  ('shop', 'Shop', null, 'MORE', null, false, 42),
  ('suggest-a-feature', 'Suggest a Feature', null, 'MORE', null, false, 43),
  ('support', 'Support', null, 'MORE', null, false, 44);

insert into public.topup_packs (label, pay_amount, credit_amount, sort_order) values
  ('Starter', 19, 19, 1),
  ('Popular', 49, 49, 2),
  ('Super Saver', 99, 109, 3);

insert into public.app_settings (key, value, description, is_public) values
  ('elite_level_coins', '500', 'Print Coins needed for Elite level', true),
  ('referral_join_coins', '10', 'Coins given to a new user who signs up with a referral code', true),
  ('referral_upgrade_coins', '30', 'Coins given to the referrer when the referred user upgrades', true),
  ('default_card_rate', '50', 'Default price per card print (INR) for new users', true),
  ('free_daily_credits', '1', 'Daily credits per feature on the Free plan', true),
  ('maintenance_mode', 'false', 'Show maintenance screen to non-admin users', true);
