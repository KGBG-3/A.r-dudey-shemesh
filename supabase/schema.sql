-- ardudim.co.il · מערכת העבודות (Supabase / Postgres)
-- The jobs calendar of א.ר דודי שמש: requests from the site's price calculator, Chromagen coordination,
-- contractor and private jobs. Two logins (Moshe and Iliya), listed in public.admins.
-- Visitors (role anon) can only call public_info(), public_days() and request_job().
-- Safe to run again on an existing database: everything is "if not exists" / "create or replace".

begin;

-- ---------- helpers ----------
create or replace function public.norm_phone(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case
           when d ~ '^972' then '0' || substr(d, 4)
           when d ~ '^5[0-9]{8}$' then '0' || d
           else d
         end
  from (select case when x ~ '^00' then substr(x, 3) else x end as d
        from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as x) a) b
$$;

-- a city name without spaces, dashes and quotes, for matching "תל אביב-יפו" with "תל אביב יפו"
create or replace function public.city_key(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select regexp_replace(coalesce(t, ''), '[[:space:]\-–—־"״''׳`]', '', 'g')
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- tables ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key default 'main' check (id = 'main'),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create sequence if not exists public.jobs_ref_seq start with 1001;

-- one row per job, from the first request to the day it is done
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  ref int not null default nextval('public.jobs_ref_seq') unique,   -- the short number customers see (#1001)
  status text not null default 'new'
    check (status in ('new', 'scheduled', 'done', 'cancelled')),   -- new = waiting for a date
  source text not null default 'private'
    check (source in ('site', 'chromagen', 'contractor', 'private')),
  source_name text not null default '',        -- the contractor's name, "עמידר", ...
  title text not null default '',              -- what the job is: "מערכת מלאה 150 ליטר – כרומגן"
  name text not null default '',
  phone text not null default '',
  phone_norm text generated always as (public.norm_phone(phone)) stored,
  city text not null default '',
  address text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  pref_days date[] not null default '{}',      -- the days the customer marked on the site (up to 3)
  pref_window text not null default ''
    check (pref_window in ('', 'morning', 'noon', 'any')),
  price numeric(10, 2),
  quote_code text not null default '',         -- the calculator's ?q= spec
  quote_link text not null default '',
  sale_no text not null default '',            -- Chromagen's מספר מכירה
  ext_link text not null default '',           -- Chromagen's "קישור לעדכון אחרי ביקור"
  call_before boolean not null default false,  -- call the customer half an hour before arriving
  notes text not null default '',
  lang text not null default 'he' check (lang in ('he', 'ru')),
  client_key text,                             -- md5 of the key the visitor's browser sent (site requests)
  ip_hash text,                                -- md5 of the visitor's IP (site requests), for the per-address limit
  confirmed_at timestamptz,                    -- the date confirmation went out on WhatsApp
  reminded_at timestamptz,                     -- the day-before reminder went out
  notified_at timestamptz,                     -- the phones got the new-request alert
  done_at timestamptz,
  gcal_id text,                                -- the copy in the Google Calendar "עבודות דודים"
  gcal_hash text,
  gcal_state text not null default '',
  gcal_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_range check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint jobs_dated check (status not in ('scheduled', 'done') or (starts_at is not null and ends_at is not null))
);
alter sequence public.jobs_ref_seq owned by public.jobs.ref;
alter table public.jobs add column if not exists client_key text;
alter table public.jobs add column if not exists ip_hash text;
create index if not exists jobs_starts_at on public.jobs (starts_at);
create index if not exists jobs_status on public.jobs (status);
create index if not exists jobs_phone_norm on public.jobs (phone_norm);
create index if not exists jobs_created_at on public.jobs (created_at);

-- days off (holidays, vacation): the site does not offer them
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  day_from date not null,
  day_to date,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint blocks_range check (day_to is null or day_to >= day_from)
);

-- the phones that get alerts (Web Push), managed from the admin screen
create table if not exists public.push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  label text not null default '',
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fails int not null default 0
);

-- values only the server function reads (web-push keys, sent lists). No policies: no API access.
create table if not exists public.server_kv (
  k text primary key,
  v jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- row upkeep ----------
create or replace function public.jobs_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if new.status = 'done' and old.status is distinct from 'done' then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  return new;
end $$;
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.jobs_touch();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- ---------- access ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.jobs enable row level security;
alter table public.blocks enable row level security;
alter table public.push_subs enable row level security;
alter table public.server_kv enable row level security;

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists jobs_admin on public.jobs;
drop policy if exists jobs_read on public.jobs;
drop policy if exists jobs_add on public.jobs;
drop policy if exists jobs_edit on public.jobs;
drop policy if exists jobs_remove on public.jobs;
create policy jobs_read on public.jobs for select to authenticated using (public.is_admin());
create policy jobs_add on public.jobs for insert to authenticated with check (public.is_admin());
create policy jobs_edit on public.jobs for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- a job that already has a copy in Google Calendar is cancelled, not deleted, so the copy goes away with it
create policy jobs_remove on public.jobs for delete to authenticated using (public.is_admin() and gcal_id is null);

drop policy if exists blocks_admin on public.blocks;
create policy blocks_admin on public.blocks for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists push_subs_admin on public.push_subs;
create policy push_subs_admin on public.push_subs for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.admins, public.settings, public.jobs, public.blocks, public.push_subs, public.server_kv from anon;
revoke all on public.server_kv from authenticated;
revoke all on sequence public.jobs_ref_seq from anon;
grant usage on schema public to anon, authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.settings, public.jobs, public.blocks, public.push_subs to authenticated;
grant usage on sequence public.jobs_ref_seq to authenticated;

-- ---------- areas ----------
-- the area a city belongs to, from settings.areas ([{name, cities: [...]}, ...]); '' when it is not listed
create or replace function public.area_of(p_city text) returns text
language sql stable security definer set search_path = '' as $$
  with k as (select public.city_key(p_city) as c)
  select coalesce((
    select a ->> 'name'
      from public.settings s, k,
           jsonb_array_elements(coalesce(s.data -> 'areas', '[]'::jsonb)) a,
           jsonb_array_elements_text(coalesce(a -> 'cities', '[]'::jsonb)) city
     where s.id = 'main' and k.c <> ''
       and (public.city_key(city) = k.c
            or (char_length(k.c) >= 3 and char_length(public.city_key(city)) >= 3
                and (starts_with(k.c, public.city_key(city)) or starts_with(public.city_key(city), k.c))))
     order by public.city_key(city) = k.c desc
     limit 1), '');
$$;

-- ---------- public functions (the site) ----------
create or replace function public.public_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', coalesce((
      select jsonb_build_object(
        'areas', s.data -> 'areas', 'windows', s.data -> 'windows', 'workDays', s.data -> 'workDays',
        'daysAhead', s.data -> 'daysAhead', 'minNoticeDays', s.data -> 'minNoticeDays')
      from public.settings s where s.id = 'main'), '{}'::jsonb),
    'now', now());
$$;

-- the days a visitor can mark: for each day, the open windows ([] = closed, full or a day off),
-- and whether a job is already booked that day in the visitor's area ("near"). No personal details.
create or replace function public.public_days(p_city text default '')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'Asia/Jerusalem';
  st jsonb;
  today date := (now() at time zone tz)::date;
  ahead int; notice int; maxday int;
  v_area text := public.area_of(left(coalesce(p_city, ''), 40));
  d date;
  w jsonb;
  n int; v_near boolean; v_blocked boolean;
  result jsonb := '[]'::jsonb;
begin
  select data into st from public.settings where id = 'main';
  if st is null then return result; end if;
  ahead := greatest(1, least(60, coalesce((st ->> 'daysAhead')::int, 14)));
  notice := greatest(0, least(14, coalesce((st ->> 'minNoticeDays')::int, 1)));
  maxday := greatest(1, coalesce((st ->> 'maxPerDay')::int, 4));
  for d in select g::date from generate_series(today + notice, today + ahead, interval '1 day') g loop
    w := coalesce(st -> 'workDays' -> (extract(dow from d)::int)::text, '[]'::jsonb);
    v_blocked := exists (select 1 from public.blocks b where d between b.day_from and coalesce(b.day_to, b.day_from));
    select count(*), coalesce(bool_or(v_area <> '' and public.area_of(j.city) = v_area), false)
      into n, v_near
      from public.jobs j
     where j.status = 'scheduled' and (j.starts_at at time zone tz)::date = d;
    result := result || jsonb_build_array(jsonb_build_object(
      'd', d,
      'w', case when v_blocked or n >= maxday then '[]'::jsonb else w end,
      'full', (not v_blocked and n >= maxday and jsonb_array_length(w) > 0),
      'near', (v_near and not v_blocked and n < maxday and jsonb_array_length(w) > 0)));
  end loop;
  return result;
end $$;

-- a request from the calculator's "בחירת יישוב ומועד": waits in the admin's requests list for a date.
-- p_key is a random key the visitor's browser keeps for the visit: sending again with the same key and phone
-- (a second tap, changed days) updates that request; anyone else gets a request of their own.
-- Limits: 5 requests an hour from one address, 60 an hour in all, 3 a week for one phone.
drop function if exists public.request_job(text, date[], text, text, text, text, numeric, text, text, text, text);
create or replace function public.request_job(
  p_city text, p_days date[], p_window text, p_name text, p_phone text,
  p_title text default '', p_price numeric default null, p_quote text default '', p_link text default '',
  p_lang text default 'he', p_note text default '', p_key text default '')
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  tz constant text := 'Asia/Jerusalem';
  st jsonb;
  today date := (now() at time zone tz)::date;
  v_city text := left(regexp_replace(btrim(left(coalesce(p_city, ''), 200)), '\s+', ' ', 'g'), 40);
  v_name text := left(regexp_replace(btrim(left(coalesce(p_name, ''), 200)), '\s+', ' ', 'g'), 60);
  v_phone text := public.norm_phone(left(coalesce(p_phone, ''), 40));
  v_window text := coalesce(nullif(btrim(left(coalesce(p_window, ''), 20)), ''), 'any');
  v_title text := left(regexp_replace(btrim(left(coalesce(p_title, ''), 400)), '\s+', ' ', 'g'), 120);
  v_quote text := left(btrim(coalesce(p_quote, '')), 80);
  v_link text := left(btrim(coalesce(p_link, '')), 240);
  v_lang text := case when p_lang = 'ru' then 'ru' else 'he' end;
  v_note text := left(btrim(left(coalesce(p_note, ''), 600)), 300);
  v_price numeric := case when p_price between 0 and 200000 then round(p_price, 2) end;
  v_key text := case when coalesce(p_key, '') ~ '^[A-Za-z0-9_-]{16,64}$' then md5(p_key) end;
  v_hdr jsonb;
  v_ip text;
  v_days date[];
  ahead int; notice int;
  v_id uuid; v_ref int;
begin
  select data into st from public.settings where id = 'main';
  if st is null then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if char_length(v_city) < 2 then return jsonb_build_object('ok', false, 'error', 'city'); end if;
  if char_length(v_name) < 2 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if v_phone !~ '^0[2-9][0-9]{7,8}$' and v_phone !~ '^[1-9][0-9]{9,14}$' then
    return jsonb_build_object('ok', false, 'error', 'phone');
  end if;
  if v_window not in ('morning', 'noon', 'any') then return jsonb_build_object('ok', false, 'error', 'window'); end if;
  if cardinality(coalesce(p_days, '{}'::date[])) > 31 then return jsonb_build_object('ok', false, 'error', 'days'); end if;

  ahead := greatest(1, least(60, coalesce((st ->> 'daysAhead')::int, 14)));
  notice := greatest(0, least(14, coalesce((st ->> 'minNoticeDays')::int, 1)));
  select coalesce(array_agg(x order by x), '{}') into v_days
    from (select distinct x from unnest(coalesce(p_days, '{}'::date[])) x
           where x between today + notice and today + ahead
             and jsonb_array_length(coalesce(st -> 'workDays' -> (extract(dow from x)::int)::text, '[]'::jsonb)) > 0) t;
  v_days := v_days[1:3];
  if cardinality(v_days) = 0 then return jsonb_build_object('ok', false, 'error', 'days'); end if;

  if v_link <> '' and v_link !~ '^https://ardudim\.co\.il/' then v_link := ''; end if;
  if v_quote !~ '^[a-z0-9_.-]*$' then v_quote := ''; end if;

  -- the visitor's address as Supabase's proxy reports it (cf-connecting-ip cannot be set by the visitor)
  begin
    v_hdr := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_hdr := '{}'::jsonb;
  end;
  v_ip := coalesce(nullif(btrim(v_hdr ->> 'cf-connecting-ip'), ''), nullif(btrim(v_hdr ->> 'x-real-ip'), ''),
                   nullif(btrim(split_part(coalesce(v_hdr ->> 'x-forwarded-for', ''), ',', 1)), ''));
  v_ip := case when v_ip is null then null else md5('ardudim:' || v_ip) end;

  perform pg_advisory_xact_lock(hashtext('ardudim.request'));

  if v_key is not null then
    select j.id, j.ref into v_id, v_ref from public.jobs j
     where j.source = 'site' and j.status = 'new' and j.client_key = v_key and j.phone_norm = v_phone
       and j.created_at > now() - interval '1 day'
     order by j.created_at desc limit 1;
    if v_id is not null then
      update public.jobs set city = v_city, name = v_name, pref_days = v_days, pref_window = v_window,
             title = case when v_title <> '' then v_title else title end, price = coalesce(v_price, price),
             quote_code = case when v_quote <> '' then v_quote else quote_code end,
             quote_link = case when v_link <> '' then v_link else quote_link end,
             lang = v_lang, notes = case when v_note <> '' then v_note else notes end
       where id = v_id;
      return jsonb_build_object('ok', true, 'ref', v_ref, 'again', true);
    end if;
  end if;

  if v_ip is not null and (select count(*) from public.jobs j
       where j.source = 'site' and j.ip_hash = v_ip and j.created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  if (select count(*) from public.jobs j where j.source = 'site' and j.created_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  if (select count(*) from public.jobs j
       where j.source = 'site' and j.phone_norm = v_phone and j.created_at > now() - interval '7 days') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;

  insert into public.jobs (status, source, title, name, phone, city, pref_days, pref_window,
                           price, quote_code, quote_link, lang, notes, client_key, ip_hash)
  values ('new', 'site', v_title, v_name, v_phone, v_city, v_days, v_window,
          v_price, v_quote, v_link, v_lang, v_note, v_key, v_ip)
  returning ref into v_ref;
  return jsonb_build_object('ok', true, 'ref', v_ref);
end $$;

revoke execute on function public.public_info(), public.public_days(text),
  public.request_job(text, date[], text, text, text, text, numeric, text, text, text, text, text),
  public.is_admin(), public.area_of(text) from public;
revoke execute on function public.is_admin(), public.area_of(text) from anon;
grant execute on function public.public_info(), public.public_days(text),
  public.request_job(text, date[], text, text, text, text, numeric, text, text, text, text, text) to anon, authenticated;
grant execute on function public.is_admin(), public.area_of(text) to authenticated;

-- merge a few settings keys in one statement (admins only, through the row rules above)
create or replace function public.merge_settings(p_patch jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  update public.settings set data = data || p_patch where id = 'main' returning data;
$$;
revoke execute on function public.merge_settings(jsonb) from public, anon;
grant execute on function public.merge_settings(jsonb) to authenticated;

-- ---------- alerts and the Google Calendar copy ----------
-- The Edge Function "notify" (deployed with "Verify JWT" off; it checks every request itself).
create or replace function public.functions_url() returns text
language sql immutable set search_path = '' as $$
  select '__FUNCTIONS_URL__'
$$;

-- every saved change pings the function: it sends the new-request alert and keeps the calendar copy in step.
-- A failure here never blocks the change. The function only reads the row, so a stray call does nothing.
create or replace function public.jobs_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('ardudim.quiet', true), '') = '1' then return null; end if;
  begin
    perform net.http_post(
      url := public.functions_url() || 'notify',
      body := jsonb_build_object('op', 'job', 'id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 8000);
  exception when others then
    null;
  end;
  return null;
end $$;
drop trigger if exists jobs_notify on public.jobs;
create trigger jobs_notify after insert or update of status, source, source_name, title, name, phone, city, address,
  starts_at, ends_at, price, sale_no, ext_link, call_before, notes, quote_link
  on public.jobs for each row execute function public.jobs_notify();

revoke execute on function public.jobs_notify(), public.functions_url(), public.jobs_touch(), public.touch_updated_at()
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant select, insert, update, delete on public.jobs, public.settings, public.blocks, public.push_subs,
      public.server_kv, public.admins to service_role;
  end if;
end $$;

-- live updates for the admin screen
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.jobs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.blocks;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.settings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ---------- first settings ----------
insert into public.settings (id, data) values ('main', $json${
  "business": "א.ר דודי שמש",
  "phone": "054-564-2426",
  "reviewLink": "https://g.page/r/CTh-l4-1sfgzEAE/review",
  "areas": [
    {"name": "פתח תקווה והסביבה", "cities": ["פתח תקווה", "ראש העין", "גבעת שמואל", "קריית אונו", "יהוד-מונוסון", "אור יהודה", "גני תקווה", "סביון", "שוהם", "אלעד", "כפר קאסם"]},
    {"name": "תל אביב ורמת גן", "cities": ["תל אביב-יפו", "רמת גן", "גבעתיים", "בני ברק", "רמת השרון"]},
    {"name": "דרום גוש דן והשפלה", "cities": ["חולון", "בת ים", "אזור", "ראשון לציון", "נס ציונה", "רחובות", "באר יעקב"]},
    {"name": "השרון", "cities": ["הרצליה", "רעננה", "כפר סבא", "הוד השרון", "כוכב יאיר-צור יגאל", "נתניה", "קדימה-צורן", "אבן יהודה", "תל מונד"]},
    {"name": "השומרון", "cities": ["אריאל", "אלקנה", "עץ אפרים", "שערי תקווה", "אורנית", "קרני שומרון", "יקיר", "נופים", "ברקן", "ברוכין", "עלי זהב", "פדואל"]}
  ],
  "windows": {
    "morning": {"he": "בוקר", "ru": "Утро", "from": "08:00", "to": "12:00"},
    "noon": {"he": "צהריים", "ru": "День", "from": "12:00", "to": "16:00"}
  },
  "workDays": {"0": ["morning", "noon"], "1": ["morning", "noon"], "2": ["morning", "noon"], "3": ["morning", "noon"],
               "4": ["morning", "noon"], "5": ["morning"], "6": []},
  "daysAhead": 14,
  "minNoticeDays": 1,
  "maxPerDay": 4,
  "jobHours": 2,
  "notify": {"site": true, "eveningHour": 20},
  "gcal": {"enabled": false, "url": "", "token": "", "calendar": "", "calendarName": "עבודות דודים"},
  "templates": {
    "confirm": "שלום {שם}, כאן א.ר דודי שמש.\nקבענו לכם ביקור ביום {יום} {תאריך}, בין {משעה} ל-{עד}.\nנתקשר חצי שעה לפני שאנחנו מגיעים.\nאם משהו משתנה, אפשר לכתוב לנו כאן.",
    "remind": "שלום {שם}, תזכורת מא.ר דודי שמש: מחר, יום {יום} {תאריך}, אנחנו מגיעים בין {משעה} ל-{עד}.\nנתקשר חצי שעה לפני. אם משהו השתנה, כתבו לנו כאן.",
    "onway": "שלום {שם}, אנחנו בדרך אליכם ונגיע בעוד כחצי שעה.\nא.ר דודי שמש",
    "request": "שלום {שם}, קיבלנו את הבקשה מהאתר ({עבודה}, {יישוב}).\nנחזור אליכם בהקדם לתאם יום ושעה.\nא.ר דודי שמש",
    "review": "שלום {שם}, תודה שבחרתם בא.ר דודי שמש.\nנשמח אם תכתבו לנו ביקורת קצרה בגוגל, זה עוזר לנו מאוד:\n{ביקורת}"
  }
}$json$::jsonb)
on conflict (id) do nothing;

-- ---------- a guard: the functions address must be filled in ----------
do $$
begin
  if public.functions_url() !~ '^https?://' then
    raise exception 'צריך למלא את כתובת הפרויקט בשורה של functions_url() לפני ההרצה';
  end if;
end $$;

-- ---------- the two logins ----------
-- Create the users first (Authentication → Users → Add user, "Auto Confirm User"), then run this file.
-- Running it again after adding a user later is fine.
insert into public.admins (user_id, name)
select u.id, case lower(u.email) when 'moshe@ardudim.co.il' then 'משה' when 'iliya@ardudim.co.il' then 'אבא' else '' end
  from auth.users u
 where lower(u.email) in ('moshe@ardudim.co.il', 'iliya@ardudim.co.il')
on conflict (user_id) do nothing;

commit;

-- ---------- extensions for the web call and the hourly check (Supabase) ----------
-- Outside the transaction above, so a project without them still gets everything else.
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net not enabled: %', sqlerrm;
end $$;
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;
  -- every hour; the function itself decides when it is time for the evening list (Israel time)
  perform cron.schedule('ardudim-hourly', '0 * * * *',
    $job$ select net.http_post(url := public.functions_url() || 'notify', body := '{"op":"hourly"}'::jsonb, timeout_milliseconds := 8000) $job$);
exception when others then
  raise notice 'pg_cron not enabled: %', sqlerrm;
end $$;
