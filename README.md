-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

create table requests (
  id uuid default gen_random_uuid() primary key,
  meal text not null,
  requested_by text not null,
  upvotes text[] default '{}',
  downvotes text[] default '{}',
  created_at timestamp with time zone default now()
);

-- Allow anyone with the anon key to read/write (no auth required)
alter table requests enable row level security;

create policy "Public read" on requests for select using (true);
create policy "Public insert" on requests for insert with check (true);
create policy "Public update" on requests for update using (true);
create policy "Public delete" on requests for delete using (true);
