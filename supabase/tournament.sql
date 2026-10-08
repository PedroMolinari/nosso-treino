-- Rode no SQL Editor DEPOIS do schema.sql. Não altera nada que já existe.
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  days int not null default 20 check (days > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz default now()
);
create table meal_records (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  description text default '',
  foods text default '',
  photo_path text,
  points int not null default 0 check (points between -50 and 50),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table daily_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  exercises text[] not null default '{}',
  habits text[] not null default '{}',
  notes text default '',
  unique (tournament_id, user_id, date)
);

alter table tournaments enable row level security;
alter table meal_records enable row level security;
alter table daily_entries enable row level security;

create policy "ver torneios" on tournaments for select to authenticated using (true);
create policy "criar torneio" on tournaments for insert to authenticated with check (created_by = auth.uid());

create policy "ver refeicoes" on meal_records for select to authenticated using (true);
create policy "criar minhas refeicoes" on meal_records for insert to authenticated with check (user_id = auth.uid());
create policy "editar minhas refeicoes" on meal_records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir minhas refeicoes" on meal_records for delete to authenticated using (user_id = auth.uid());

create policy "ver registros diarios" on daily_entries for select to authenticated using (true);
create policy "criar meus registros" on daily_entries for insert to authenticated with check (user_id = auth.uid());
create policy "editar meus registros" on daily_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir meus registros" on daily_entries for delete to authenticated using (user_id = auth.uid());

-- Bloqueia registros fora dos dias do torneio.
create function check_in_period() returns trigger language plpgsql as $$
declare t tournaments%rowtype;
begin
  select * into t from tournaments where id = new.tournament_id;
  if new.date < t.start_date or new.date >= t.start_date + t.days then
    raise exception 'Data fora do período do torneio';
  end if;
  return new;
end $$;
create trigger meal_period before insert or update on meal_records for each row execute function check_in_period();
create trigger entry_period before insert or update on daily_entries for each row execute function check_in_period();

-- Bucket privado; caminho: torneio/participante/data/refeicao. Todos logados veem; cada um só grava na própria pasta.
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false) on conflict do nothing;
create policy "ver fotos" on storage.objects for select to authenticated using (bucket_id = 'meal-photos');
create policy "enviar minhas fotos" on storage.objects for insert to authenticated with check (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "trocar minhas fotos" on storage.objects for update to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "apagar minhas fotos" on storage.objects for delete to authenticated using (bucket_id = 'meal-photos' and (storage.foldername(name))[2] = auth.uid()::text);
