create table if not exists public.deutschquest_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    displayable_name text not null default '',
    updated_at timestamptz not null default now()
);

create table if not exists public.deutschquest_sections (
    id text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    primary key (id, user_id)
);

create table if not exists public.deutschquest_folders (
    id text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    level text not null,
    name text not null,
    description text not null default '',
    color text not null default '#6366f1',
    created_at timestamptz not null default now(),
    primary key (id, user_id)
);

create table if not exists public.deutschquest_flashcards (
    id text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    folder_id text not null,
    german text not null,
    spanish text not null,
    example text not null default '',
    example_spanish text,
    kind text not null check (kind in ('Sustantivo', 'Verbo', 'Expresion')),
    note text,
    created_at timestamptz not null default now(),
    primary key (id, user_id),
    foreign key (folder_id, user_id) references public.deutschquest_folders(id, user_id) on delete cascade
);

alter table public.deutschquest_profiles enable row level security;
alter table public.deutschquest_sections enable row level security;
alter table public.deutschquest_folders enable row level security;
alter table public.deutschquest_flashcards enable row level security;

create or replace function public.handle_deutschquest_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.deutschquest_profiles (id, displayable_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'displayable_name', split_part(new.email, '@', 1), '')
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_deutschquest_auth_user_created on auth.users;

create trigger on_deutschquest_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_deutschquest_new_user();

create policy "Users can read their deutschquest profile"
on public.deutschquest_profiles
for select
using (auth.uid() = id);

create policy "Users can create their deutschquest profile"
on public.deutschquest_profiles
for insert
with check (auth.uid() = id);

create policy "Users can update their deutschquest profile"
on public.deutschquest_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read their deutschquest sections"
on public.deutschquest_sections
for select
using (auth.uid() = user_id);

create policy "Users can create their deutschquest sections"
on public.deutschquest_sections
for insert
with check (auth.uid() = user_id);

create policy "Users can update their deutschquest sections"
on public.deutschquest_sections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their deutschquest sections"
on public.deutschquest_sections
for delete
using (auth.uid() = user_id);

create policy "Users can read their deutschquest folders"
on public.deutschquest_folders
for select
using (auth.uid() = user_id);

create policy "Users can create their deutschquest folders"
on public.deutschquest_folders
for insert
with check (auth.uid() = user_id);

create policy "Users can update their deutschquest folders"
on public.deutschquest_folders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their deutschquest folders"
on public.deutschquest_folders
for delete
using (auth.uid() = user_id);

create policy "Users can read their deutschquest flashcards"
on public.deutschquest_flashcards
for select
using (auth.uid() = user_id);

create policy "Users can create their deutschquest flashcards"
on public.deutschquest_flashcards
for insert
with check (
    auth.uid() = user_id
    and exists (
        select 1
        from public.deutschquest_folders
        where deutschquest_folders.id = folder_id
        and deutschquest_folders.user_id = auth.uid()
    )
);

create policy "Users can update their deutschquest flashcards"
on public.deutschquest_flashcards
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their deutschquest flashcards"
on public.deutschquest_flashcards
for delete
using (auth.uid() = user_id);

create index if not exists deutschquest_sections_user_id_idx
on public.deutschquest_sections(user_id);

create index if not exists deutschquest_folders_user_id_idx
on public.deutschquest_folders(user_id);

create index if not exists deutschquest_flashcards_user_id_idx
on public.deutschquest_flashcards(user_id);

create index if not exists deutschquest_flashcards_folder_id_idx
on public.deutschquest_flashcards(folder_id);
