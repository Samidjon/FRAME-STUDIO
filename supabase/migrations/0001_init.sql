-- =====================================================================
-- Senitukang Studio — initial schema
--
-- Security model
--   * The browser only ever uses the anon key; every table has RLS enabled.
--   * Owners have full CRUD on their own rows (owner_id = auth.uid()).
--   * Projects are private by default. A project becomes world-readable only
--     when the owner explicitly publishes it (visibility = 'public' AND
--     published_at IS NOT NULL — enforced by a CHECK constraint too).
--   * Storage: bucket "assets" is private and namespaced by `${uid}/...`;
--     bucket "thumbnails" is public-read with owner-only writes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Keep a client-supplied timestamp (used for offline-first "newer wins"
  -- merging) unless the client did not change it; never allow timestamps far
  -- in the future.
  if tg_op = 'INSERT' then
    new.updated_at := least(coalesce(new.updated_at, now()), now() + interval '5 minutes');
  elsif new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  else
    new.updated_at := least(new.updated_at, now() + interval '5 minutes');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique
               check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 64),
  bio          text check (char_length(bio) <= 280),
  avatar_url   text check (char_length(avatar_url) <= 512),
  created_at   timestamptz not null default now()
);

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base  text;
  cand  text;
  n     int := 0;
begin
  base := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then base := base || 'user'; end if;
  base := left(base, 18);
  cand := base;
  while exists (select 1 from public.profiles p where p.username = cand) loop
    n := n + 1;
    cand := base || '_' || substr(md5(random()::text), 1, 4);
    exit when n > 20;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    cand,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 64)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id             text primary key check (char_length(id) between 1 and 64),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  name           text not null default 'Untitled' check (char_length(name) <= 120),
  doc            jsonb not null,
  schema_version int  not null default 1,
  visibility     text not null default 'private' check (visibility in ('private', 'public')),
  published_at   timestamptz,
  category       text check (char_length(category) <= 40),
  tags           text[] not null default '{}' check (cardinality(tags) <= 12),
  thumbnail_path text,
  favorite       boolean not null default false,
  origin_id      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Documents are capped at ~5 MB (images live in Storage, not in the doc).
  constraint projects_doc_size check (pg_column_size(doc) < 5 * 1024 * 1024),
  -- Publishing requires an explicit consent timestamp.
  constraint projects_publish_consent check (visibility = 'private' or published_at is not null)
);

create index if not exists projects_owner_idx on public.projects (owner_id, updated_at desc);
create index if not exists projects_public_idx on public.projects (published_at desc) where visibility = 'public';
create index if not exists projects_tags_idx on public.projects using gin (tags);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before insert or update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------
create table if not exists public.assets (
  id           text primary key check (char_length(id) between 1 and 64),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  -- Not a foreign key: assets may be uploaded before their project is synced.
  project_id   text,
  kind         text not null check (kind in ('image', 'logo', 'svg', 'font', 'texture')),
  name         text not null check (char_length(name) <= 120),
  mime         text not null check (char_length(mime) <= 64),
  size         bigint not null check (size >= 0 and size <= 41943040),
  width        int,
  height       int,
  font_family  text,
  favorite     boolean not null default false,
  folder       text check (char_length(folder) <= 64),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  -- Storage paths must live inside the owner's folder.
  constraint assets_path_owner check (storage_path like owner_id::text || '/%')
);

create index if not exists assets_owner_idx on public.assets (owner_id, created_at desc);

-- ---------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index if not exists likes_project_idx on public.likes (project_id);

-- ---------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  is_public  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  project_id    text not null references public.projects (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, project_id)
);

create index if not exists collections_owner_idx on public.collections (owner_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.assets           enable row level security;
alter table public.likes            enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;

-- profiles: public read (username / display name / bio are public by design),
-- owner insert/update/delete.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "profiles owner insert" on public.profiles;
create policy "profiles owner insert" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "profiles owner delete" on public.profiles;
create policy "profiles owner delete" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- projects
drop policy if exists "projects owner all" on public.projects;
create policy "projects owner all" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "projects public read" on public.projects;
create policy "projects public read" on public.projects
  for select to anon, authenticated
  using (visibility = 'public' and published_at is not null);

-- assets: strictly owner-only.
drop policy if exists "assets owner all" on public.assets;
create policy "assets owner all" on public.assets
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- likes: users manage their own likes on published projects; likes on
-- published projects are readable by everyone (for counts).
drop policy if exists "likes read public" on public.likes;
create policy "likes read public" on public.likes
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.projects p
      where p.id = likes.project_id and p.visibility = 'public' and p.published_at is not null
    )
  );

drop policy if exists "likes insert own" on public.likes;
create policy "likes insert own" on public.likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = likes.project_id and p.visibility = 'public' and p.published_at is not null
    )
  );

drop policy if exists "likes delete own" on public.likes;
create policy "likes delete own" on public.likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- collections
drop policy if exists "collections owner all" on public.collections;
create policy "collections owner all" on public.collections
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "collections public read" on public.collections;
create policy "collections public read" on public.collections
  for select to anon, authenticated using (is_public);

drop policy if exists "collection items owner all" on public.collection_items;
create policy "collection items owner all" on public.collection_items
  for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_items.collection_id and c.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.collections c where c.id = collection_items.collection_id and c.owner_id = (select auth.uid()))
    -- Only published projects or your own projects can be collected.
    and exists (
      select 1 from public.projects p
      where p.id = collection_items.project_id
        and (p.owner_id = (select auth.uid()) or (p.visibility = 'public' and p.published_at is not null))
    )
  );

drop policy if exists "collection items public read" on public.collection_items;
create policy "collection items public read" on public.collection_items
  for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_items.collection_id and c.is_public));

-- Table privileges (RLS still applies on top of these).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.projects, public.likes, public.collections, public.collection_items to anon;
grant select, insert, update, delete on public.profiles, public.projects, public.assets, public.likes, public.collections, public.collection_items to authenticated;

-- =====================================================================
-- Public gallery view (security_invoker → callers' RLS applies, so only
-- published projects are ever visible through it).
-- =====================================================================
create or replace view public.public_gallery
with (security_invoker = true)
as
select
  p.id,
  p.owner_id,
  p.name,
  p.doc,
  p.schema_version,
  p.category,
  p.tags,
  p.thumbnail_path,
  p.published_at,
  p.created_at,
  p.updated_at,
  pr.username       as author_username,
  pr.display_name   as author_display_name,
  (select count(*) from public.likes l where l.project_id = p.id)::int as like_count
from public.projects p
left join public.profiles pr on pr.id = p.owner_id
where p.visibility = 'public' and p.published_at is not null;

grant select on public.public_gallery to anon, authenticated;

-- =====================================================================
-- Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assets', 'assets', false, 41943040,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'font/woff', 'font/woff2', 'font/ttf', 'font/otf', 'font/truetype', 'font/opentype', 'application/octet-stream']),
  ('thumbnails', 'thumbnails', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- assets bucket: owner-only, path must start with `${auth.uid()}/`
drop policy if exists "assets bucket owner read" on storage.objects;
create policy "assets bucket owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "assets bucket owner insert" on storage.objects;
create policy "assets bucket owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "assets bucket owner update" on storage.objects;
create policy "assets bucket owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "assets bucket owner delete" on storage.objects;
create policy "assets bucket owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- thumbnails bucket: public read, owner-only writes under `${auth.uid()}/`
drop policy if exists "thumbnails public read" on storage.objects;
create policy "thumbnails public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'thumbnails');

drop policy if exists "thumbnails owner insert" on storage.objects;
create policy "thumbnails owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "thumbnails owner update" on storage.objects;
create policy "thumbnails owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "thumbnails owner delete" on storage.objects;
create policy "thumbnails owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
