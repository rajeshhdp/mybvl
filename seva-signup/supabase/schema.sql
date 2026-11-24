-- North Fort Worth Bhakti Center · Weekly Seva Signup
-- Run this whole file once in Supabase: SQL Editor -> New query -> Run.
--
-- BEFORE RUNNING: replace admin@example.com below with your admin email
-- (the same one you create under Authentication -> Users).

------------------------------------------------------------------ tables
create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),   -- single row
  program_date date not null default current_date
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  needed      int  not null default 1 check (needed between 1 and 100),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.signups (
  id         uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 60),
  created_at timestamptz not null default now()
);
-- No duplicate names (any capitalisation) on the same service.
create unique index if not exists signups_unique_name
  on public.signups (service_id, lower(name));

------------------------------------------------------------ admin check
-- Only this email counts as admin. Change it before running!
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'admin@example.com'
$$;

------------------------------------------------------- row level security
alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.signups  enable row level security;

-- Everyone (devotees) can read.
create policy "read settings" on public.settings for select to anon, authenticated using (true);
create policy "read services" on public.services for select to anon, authenticated using (true);
create policy "read signups"  on public.signups  for select to anon, authenticated using (true);

-- Only the admin can write. Devotees can NOT insert directly; they must
-- use sign_up() below, which enforces the duplicate and capacity rules.
create policy "admin writes settings" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin writes services" on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes signups" on public.signups for delete to authenticated
  using (public.is_admin());

------------------------------------------------------------ devotee signup
create or replace function public.sign_up(p_service_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_needed int;
  v_count  int;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'INVALID_NAME';
  end if;

  -- Lock the service row so two people can't grab the last spot together.
  select needed into v_needed from services where id = p_service_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if exists (select 1 from signups
             where service_id = p_service_id and lower(name) = lower(v_name)) then
    raise exception 'DUPLICATE';
  end if;

  select count(*) into v_count from signups where service_id = p_service_id;
  if v_count >= v_needed then raise exception 'FULL'; end if;

  insert into signups (service_id, name) values (p_service_id, v_name);
end $$;

revoke all on function public.sign_up(uuid, text) from public;
grant execute on function public.sign_up(uuid, text) to anon, authenticated;

------------------------------------------------------------- weekly reset
-- Clears every signup and sets the next program date in one step.
create or replace function public.reset_week(p_date date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  delete from signups where true;
  update settings set program_date = p_date where id = 1;
end $$;

revoke all on function public.reset_week(date) from public;
grant execute on function public.reset_week(date) to authenticated;

---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.settings, public.services, public.signups;

------------------------------------------------------------ starter services
insert into public.services (name, description, needed, sort_order)
select * from (values
  ('Kirtan',                  'Lead or accompany the congregational chanting of the holy names.', 2, 1),
  ('Bhagavad Gita Reading',   'Read a short passage from the Bhagavad Gita for everyone.',        1, 2),
  ('Class / Discussion',      'Present the topic or facilitate the group discussion.',            1, 3),
  ('Prasadam Preparation',    'Cook or bring offered-with-love prasadam for the group.',          3, 4),
  ('Prasadam Distribution',   'Serve prasadam to all the guests with a smile.',                   3, 5),
  ('Setup & Decorations',     'Arrange the space, seating, altar and flowers before the program.', 3, 6),
  ('Cleanup',                 'Help tidy the hall and wash up after prasadam.',                   3, 7),
  ('Kids Activities',         'Lead a story, craft or game for the children.',                   2, 8),
  ('Welcome Team',            'Greet devotees and guests warmly as they arrive.',                 2, 9)
) as v(name, description, needed, sort_order)
where not exists (select 1 from public.services);
