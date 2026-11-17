# Demo users (Supabase project: printsathi)

Created by `supabase/seed_demo_users.sql`. Re-running that file deletes and recreates all of them.
Emails use the reserved `.test` domain, so no mail is ever sent to them (password reset will not work for these).

**Password for every demo account:** `Demo@12345`

| Email | Name | Plan | Status | Coins | Wallet |
| --- | --- | --- | --- | --- | --- |
| amit.free@demo.printsathi.test | Amit Sharma | Free | active, referred by Neha (pending) | 12 | ₹0 |
| priya.pro@demo.printsathi.test | Priya Verma | Pro (monthly) | active till 17 Dec 2026, referred by Neha | 45 | ₹60 |
| rahul.proplus@demo.printsathi.test | Rahul Yadav | Pro Plus (monthly) | active, referred by Sunita, open support ticket | 120 | ₹149 |
| sunita.ultra@demo.printsathi.test | Sunita Gupta | Ultra (monthly) | active, heaviest card usage | 260 | ₹320 |
| vikas.yearly@demo.printsathi.test | Vikas Singh | Pro Yearly | active till 17 Nov 2027 | 80 | ₹95 |
| neha.plusyearly@demo.printsathi.test | Neha Kushwaha | Pro Plus Yearly | active till 17 Nov 2027, 2 referrals (Elite level) | 540 | ₹510 |
| rohit.expired@demo.printsathi.test | Rohit Patel | Pro (expired) | plan expired 12 Nov 2026 — shows as Free | 5 | ₹10 |
| kiran.blocked@demo.printsathi.test | Kiran Joshi | Free | **blocked** | 0 | ₹0 |
| demo.admin@demo.printsathi.test | Demo Admin | Ultra | **admin** role (can open /admin, cannot change roles) | 0 | ₹0 |

Each active user also has 60 days of card-print history (for the Card Dashboard), a paid plan payment,
a wallet top-up, and coin history. There are 2 support tickets and 2 feature suggestions for the admin panel.

To remove all demo data:

```sql
delete from auth.users where email like '%@demo.printsathi.test';
```
