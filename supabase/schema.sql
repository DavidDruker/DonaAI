create table if not exists public.google_oauth_sessions (
  session_id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'idle',
  provider text not null default 'gmail',
  detail text not null default '',
  connected_at timestamptz,
  access_token text,
  refresh_token text,
  expires_in integer,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_sessions
add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists google_oauth_sessions_user_id_idx
on public.google_oauth_sessions(user_id);

alter table public.google_oauth_sessions enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_google_oauth_sessions_updated_at on public.google_oauth_sessions;

create trigger set_google_oauth_sessions_updated_at
before update on public.google_oauth_sessions
for each row
execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_name text not null default '',
  tone text not null default 'Direct and warm',
  email_formality text not null default 'Professional',
  email_length text not null default 'Medium',
  default_meeting_minutes integer not null default 30,
  email_signoff text not null default '',
  email_draft_mode text not null default 'preview',
  additional_instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences
add column if not exists email_formality text not null default 'Professional';

alter table public.user_preferences
add column if not exists email_length text not null default 'Medium';

alter table public.user_preferences
add column if not exists additional_instructions text not null default '';

alter table public.user_preferences
add column if not exists email_draft_mode text not null default 'preview';

alter table public.user_preferences enable row level security;

drop policy if exists "Users can read their own preferences" on public.user_preferences;
create policy "Users can read their own preferences"
on public.user_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own preferences" on public.user_preferences;
create policy "Users can insert their own preferences"
on public.user_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
on public.user_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;

create trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create index if not exists contacts_user_id_name_idx on public.contacts(user_id, lower(name));

drop policy if exists "Users can read their own contacts" on public.contacts;
create policy "Users can read their own contacts"
on public.contacts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own contacts" on public.contacts;
create policy "Users can insert their own contacts"
on public.contacts
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own contacts" on public.contacts;
create policy "Users can update their own contacts"
on public.contacts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own contacts" on public.contacts;
create policy "Users can delete their own contacts"
on public.contacts
for delete
using (auth.uid() = user_id);

drop trigger if exists set_contacts_updated_at on public.contacts;

create trigger set_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();
