create table if not exists public.google_oauth_sessions (
  session_id text primary key,
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
