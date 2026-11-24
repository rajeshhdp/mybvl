# Weekly Seva Signup · North Fort Worth Bhakti Center

Two pages, no devotee accounts:

- **`/`** – devotees see the upcoming program date and seva cards, tap **Sign Up**, type their name, done.
- **`/#/admin`** – password-protected: set the date, add/edit/remove services, set volunteers needed, see and remove names, and reset the week.

React + Vite frontend, Supabase (Postgres + Realtime + Auth) backend.

## Setup (about 10 minutes)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up". **Authentication → Users → Add user**: create the admin (email + password, auto-confirm). The password is what you type on the admin page.
3. Open `supabase/schema.sql`, replace `admin@example.com` with your admin email, then run it in **SQL Editor**. It creates the tables, security rules and the nine starter services.
4. Copy `.env.example` to `.env` and fill in the project URL, anon key (Project Settings → API) and admin email.
5. Run:
   ```bash
   npm install
   npm run dev      # local
   npm run build    # outputs dist/ — host on Netlify, Vercel, GitHub Pages, etc.
   ```
   Set the same three `VITE_` variables in your host's environment settings.

Without a `.env`, the app runs in **demo mode** (data kept in your browser only; admin password `krishna`) so you can try it out.

## How it's secured
- Database rules (Row Level Security) let anyone **read**, but only the admin email can change services, the date, or delete signups.
- Devotees can't write to the table directly; they call `sign_up()`, which locks the service row and enforces the volunteer limit and the no-duplicate-name rule (case-insensitive) atomically, so two people can't take the last spot together.
- `reset_week()` clears all signups and sets the new date in one step, admin only.
- The anon key in the frontend is public by design; it is safe because of the rules above. Never put the service-role key in this app.

Known limit: since there's no devotee login, someone could type a fake name. The admin can remove any signup.
