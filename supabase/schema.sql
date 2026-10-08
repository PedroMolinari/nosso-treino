-- Cole no Supabase → SQL Editor → Run.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Usuário',
  weight numeric not null default 70 check (weight > 0),
  daily_kcal int not null default 500 check (daily_kcal > 0),
  weekly_kcal int not null default 2500 check (weekly_kcal > 0),
  weekly_workouts int not null default 4 check (weekly_workouts > 0),
  weekly_minutes int not null default 240 check (weekly_minutes > 0)
);
create table activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  minutes int not null check (minutes > 0 and minutes <= 600),
  intensity text not null,
  date date not null,
  time text,
  note text default '',
  weight_used numeric,
  calories_estimated int not null check (calories_estimated >= 0),
  calories_manual int check (calories_manual >= 0),
  created_at timestamptz default now()
);
create table weight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weight numeric not null check (weight > 0),
  date date not null
);

alter table profiles enable row level security;
alter table activities enable row level security;
alter table weight_records enable row level security;

-- O casal vê os perfis e atividades um do outro; só edita os próprios.
create policy "ver perfis" on profiles for select to authenticated using (true);
create policy "criar meu perfil" on profiles for insert to authenticated with check (id = auth.uid());
create policy "editar meu perfil" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "ver atividades" on activities for select to authenticated using (true);
create policy "criar minhas atividades" on activities for insert to authenticated with check (user_id = auth.uid());
create policy "editar minhas atividades" on activities for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir minhas atividades" on activities for delete to authenticated using (user_id = auth.uid());

-- Histórico de peso é privado.
create policy "ver meu peso" on weight_records for select to authenticated using (user_id = auth.uid());
create policy "criar meu peso" on weight_records for insert to authenticated with check (user_id = auth.uid());

-- Perfil criado automaticamente para cada novo usuário (nome inicial = parte do e-mail antes do @).
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Perfis dos usuários que já existiam antes desta tabela.
insert into profiles (id, name) select id, split_part(email, '@', 1) from auth.users on conflict do nothing;
