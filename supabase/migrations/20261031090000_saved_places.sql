create table if not exists public.saved_places (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 place_id uuid references public.places(id) on delete cascade,
 google_place_id text,
 label text check(char_length(label) <= 40),
 saved_at timestamptz not null default now(),
 constraint saved_places_um_lugar check ((place_id is null) <> (google_place_id is null)),
 unique(user_id,place_id), unique(user_id,google_place_id)
);
create index if not exists saved_places_user_idx on public.saved_places(user_id,saved_at desc);
alter table public.saved_places enable row level security;
drop policy if exists "saved_places: dono le" on public.saved_places;
drop policy if exists "saved_places: dono salva" on public.saved_places;
drop policy if exists "saved_places: dono remove" on public.saved_places;
create policy "saved_places: dono le" on public.saved_places for select to authenticated using(auth.uid()=user_id);
create policy "saved_places: dono salva" on public.saved_places for insert to authenticated with check(auth.uid()=user_id);
create policy "saved_places: dono remove" on public.saved_places for delete to authenticated using(auth.uid()=user_id);
