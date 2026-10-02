# Just Us — Auth migration runbook

Follow these steps **in order**. The live app keeps working until step 8.

## 1. Run `migrations/005_auth.sql`
Supabase dashboard → SQL Editor → paste → Run.
It only *adds* things (the `auth_id` column, helper functions, policies for signed-in users).

## 2. Create the two Auth accounts
Dashboard → Authentication → Users → **Add user → Create new user**, once for each of you.
- Use an email you can receive mail at (or any address you'll remember).
- Use a long, unique password from a password manager (12+ characters).
- Tick **Auto Confirm User**.

## 3. Link each Auth account to its `users` row
SQL Editor — replace the two emails:

```sql
UPDATE public.users
SET auth_id = (SELECT id FROM auth.users WHERE email = 'KAM_EMAIL_HERE')
WHERE id = 'a0000000-0000-0000-0000-000000000001';   -- Kam

UPDATE public.users
SET auth_id = (SELECT id FROM auth.users WHERE email = 'NONO_EMAIL_HERE')
WHERE id = 'b0000000-0000-0000-0000-000000000002';   -- Nono

-- check: both rows should show an auth_id
SELECT id, name, auth_id FROM public.users;
```

## 4. Turn off public sign-ups
Dashboard → Authentication → Sign In / Providers (or "Settings") →
turn **off** "Allow new users to sign up". Otherwise anyone with the anon key could create an account.
(Your two accounts already exist, so sign-in keeps working.)

## 5. Deploy the new app version
Push/deploy as usual. Nothing needs new env vars.

## 6. Sign in on each device
Open the app → **Get started** → email + password → choose a 4-digit PIN for that device.
Do this on **both** your laptop and your phone (each person on their own device).

## 7. Test everything while the old policies still exist
Messages both ways, read ticks, online/last-seen, a voice call and a video call.
Calls use a *private* channel that needs the `realtime.messages` policies from step 1.

## 8. Run `migrations/006_lockdown.sql`
This removes all anon access and drops the old `pin_hash` column.
**This is the point of no return for the old app version.**

## 9. Verify the lockdown
From any terminal (replace the values with the ones in `.env.local`):

```
curl "https://<project>.supabase.co/rest/v1/messages?select=*" -H "apikey: <ANON_KEY>"
```
Expected: `[]` or a permission error — **not** your messages.
Then confirm the app still works on both devices.

## 10. Rotate the TURN password (see the TODO in `app/call/page.tsx`)

---

### Day-to-day behaviour
- New device → email + password once, then a PIN for that device.
- Opening the app → PIN. 5 wrong PINs sign that device out.
- Forgot PIN → "Forgot PIN?" on the lock screen → sign in again → pick a new PIN.
- Change PIN → chat header ⚙ → Settings.
- Forgot password → reset it in the dashboard (Authentication → Users). There's no email-reset screen yet.
- The PIN is a *local lock*, not a server credential: it protects an unlocked phone, while the password/session protects the data.
